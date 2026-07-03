import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { extractText } from 'unpdf';
import OpenAI from 'openai';
import { put } from '@vercel/blob';
import { scrapeLinkedInProfile, mergeCandidateProfiles, normalizeLinkedInUrl, cacheProfilePhotoToBlob } from '@/lib/linkedin-profile';
import { deriveCategorySlugs } from '@/lib/loop-routing';
import { firstGitHubUrlFrom } from '@/lib/github-review/extract-username';
import { isLocationBlocked } from '@/lib/region-block';

const AI_PROVIDER = process.env.AI_PROVIDER || 'zai';

function getAIClient() {
  if (AI_PROVIDER === 'zai') {
    return new OpenAI({
      baseURL: 'https://api.z.ai/api/paas/v4',
      apiKey: process.env.ZAI_API_KEY || '',
    });
  }
  return new OpenAI({
    baseURL: 'https://api.z.ai/api/paas/v4',
    apiKey: process.env.ZAI_API_KEY || '',
  });
}

function getModel() {
  return AI_PROVIDER === 'zai' ? 'glm-4-32b-0414-128k' : 'glm-4-32b-0414-128k';
}

/**
 * POST /api/user/resume-preauth
 * Upload resume during registration (before auth).
 * Requires email in form data to find the user.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const email = (formData.get('email') as string)?.toLowerCase().trim();
    const linkedinUrl = (formData.get('linkedinUrl') as string)?.trim() || null;
    // Self-reported desired pay — captured at signup so recruiters don't have to re-ask CTC
    // (their #1 screening question). Free-text/soft context, never a verified line.
    const salaryExpectation = (formData.get('salaryExpectation') as string)?.trim().slice(0, 60) || null;
    const currentRate = (formData.get('currentRate') as string)?.trim().slice(0, 60) || null;
    const workAuthorization = (formData.get('workAuthorization') as string)?.trim().slice(0, 60) || null;
    const availableFrom = (formData.get('availableFrom') as string)?.trim().slice(0, 60) || null;
    // Affirmative opt-in (GDPR/CCPA) to present the profile to employers & hiring partners. Only a
    // literal 'true' counts as consent; anything else (unchecked) → no consent, no resale eligibility.
    const profileShareConsent = (formData.get('profileShareConsent') as string) === 'true';

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    if (file && (file.size > 5 * 1024 * 1024 || !file.name.toLowerCase().endsWith('.pdf'))) {
      return NextResponse.json({ error: 'PDF under 5MB required' }, { status: 400 });
    }

    // LinkedIn is a COMPLEMENT to the résumé, not a substitute: require BOTH. The résumé is the
    // authoritative base; the LinkedIn URL is the credibility signal + enrichment source.
    if (!file) {
      return NextResponse.json({ error: 'Résumé (PDF) is required' }, { status: 400 });
    }
    if (!linkedinUrl) {
      return NextResponse.json({ error: 'LinkedIn URL is required' }, { status: 400 });
    }
    // Validate it's a REAL personal profile URL (auto-fixes https:/ , linked.com, ?skipRedirect).
    // Rejects the ~19% garbage (bare names, company pages, /me links) that can never be scraped —
    // this is the single chokepoint every registration passes through.
    const normalizedLinkedin = normalizeLinkedInUrl(linkedinUrl);
    if (!normalizedLinkedin) {
      return NextResponse.json({ error: 'Enter your real LinkedIn profile URL, e.g. linkedin.com/in/your-name' }, { status: 400 });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, githubUrl: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let pdfText = '';
    let parsedProfile: Record<string, unknown> | null = null;
    let buffer: Uint8Array | null = null;

    // 1) Résumé PDF → text + AI-structured profile (the rich, authoritative BASE).
    let resumeProfile: Record<string, unknown> | null = null;
    if (file) {
      buffer = new Uint8Array(await file.arrayBuffer());
      try {
        // Pass a COPY: extractText (pdf.js) transfers/detaches the ArrayBuffer to a
        // worker, which would later break the Blob put() on the same buffer.
        const { text } = await extractText(new Uint8Array(buffer!), { mergePages: true });
        pdfText = typeof text === 'string' ? text : (text as string[]).join('\n');
      } catch {
        // Continue — LinkedIn might still work
      }
      if (pdfText) {
        try {
          const client = getAIClient();
          const response = await client.chat.completions.create({
            model: getModel(),
            messages: [
              { role: 'system', content: `You extract structured data from resumes. Return ONLY valid JSON, no markdown.
Format: {"name":"string","email":"string or null","phone":"string or null","location":"City, Country or null","skills":["skill1","skill2"],"experience_years":number,"current_title":"string","field":"string","summary":"1-2 sentence summary","languages":["English"],"experience":[{"title":"Job Title","company":"Company Name","dates":"Start - End","description":"1-2 sentences on the role and achievements"}],"education":[{"degree":"Degree","school":"School Name","dates":"Start - End"}]}
IMPORTANT — "current_title" MUST be a real JOB TITLE from the most recent work experience entry
(e.g. "Localization Project Manager", "Frontend Developer"). NEVER use a LinkedIn headline, tagline,
or personal-brand statement (e.g. "Building X — helping Y", "Helping founders scale") as the title —
if the top line is a slogan, take the title from the experience section instead. "field" is the
candidate's actual profession/domain derived from their work history (e.g. "Localization", "Project
Management", "Frontend Engineering"), not a company pitch.
IMPORTANT — "experience_years" is total YEARS OF PROFESSIONAL WORK EXPERIENCE, computed from the work
history (sum/span of job dates). It is NOT the person's age, NOT a birth year, NOT years since
graduation, and NOT a phone/ID number. Estimate from the experience dates; if the work history can't
support it, prefer a conservative number. It must be plausible (typically 0–45) and never exceed the
candidate's plausible working life — if you'd output something like 34 for someone whose jobs span ~10
years, that's age, not experience: use the ~10. If unknown, use 0.
Extract up to 20 skills and ALL experience + education entries. If not found, use null or [].` },
              { role: 'user', content: `Extract profile data:\n\n${pdfText.substring(0, 6000)}` },
            ],
            temperature: 0.1,
            max_tokens: 1500,
          });
          const m = (response.choices[0]?.message?.content || '').match(/\{[\s\S]*\}/);
          if (m) resumeProfile = JSON.parse(m[0]);
        } catch (e) {
          console.error('[ResumePreAuth] résumé AI parse failed:', e);
        }
      }
    }

    // 2) LinkedIn → structured profile (ENRICHMENT, shared module). Complement, not replacement.
    const { liProfile, resolvedUrl, aboutText, photoUrl } = await scrapeLinkedInProfile(normalizedLinkedin, email);
    const savedLinkedinUrl = resolvedUrl;
    if (!pdfText && aboutText) pdfText = aboutText;

    // 3) MERGE — résumé is the authoritative base; LinkedIn enriches (union skills/langs, gaps).
    parsedProfile = mergeCandidateProfiles(resumeProfile, liProfile, email);
    // Mark the LI scrape as done ONLY when it actually returned a profile, so the backfill job
    // re-targets just the failures (timeout / Apify throttle) instead of re-scraping successes.
    if (parsedProfile && liProfile) {
      parsedProfile._liScraped = true;
      parsedProfile._liScrapedAt = new Date().toISOString();
    }

    if (!pdfText && !parsedProfile) {
      return NextResponse.json({ error: 'Could not extract profile data' }, { status: 400 });
    }

    // Backstop for the age-as-experience mix-up (glm sometimes ignores the prompt): anything implausible
    // as professional tenure is almost certainly age / a birth year / an ID — drop it to null (unknown)
    // rather than ship "34 years experience" for a 34-year-old.
    if (parsedProfile && typeof parsedProfile.experience_years === 'number' && parsedProfile.experience_years > 45) {
      parsedProfile.experience_years = null;
    }

    // REGION BLOCK (registration, owner decision 2026-06-17): reject signups whose résumé/LinkedIn
    // location resolves to a blocked country. This is the precise backstop to the blunt IP geo block
    // (catches VPN users — their profile still says India). Unknown location is NOT blocked here (we
    // don't turn away unclassifiable wanted users). No loop/enrichment is created → the account is inert.
    const candidateLoc = ((parsedProfile?.location as string) || (resumeProfile?.location as string) || null);
    if (isLocationBlocked(candidateLoc)) {
      console.log(`[ResumePreAuth] region-blocked signup: ${email} (${candidateLoc})`);
      return NextResponse.json({ error: 'Freelanly isn’t available in your region yet.', regionBlocked: true }, { status: 403 });
    }

    // Upload original PDF to Vercel Blob. allowOverwrite:true is REQUIRED — @vercel/blob v2
    // throws on an existing pathname by default, and our pathname is deterministic
    // (resumes/{userId}/{filename}). The inline-apply flow can call this more than once per
    // registration (form retry, applying to a second role); without allowOverwrite the second
    // put() throws and clobbers the first (good) Blob URL with an "uploaded:" placeholder.
    let blobUrl = file ? `uploaded:${file.name}` : linkedinUrl || undefined;
    if (file && buffer) {
      try {
        const blob = await put(`resumes/${user.id}/${file.name}`, Buffer.from(buffer), {
          access: 'public',
          contentType: 'application/pdf',
          allowOverwrite: true,
        });
        blobUrl = blob.url;
        console.log(`[ResumePreAuth] Uploaded to Blob: ${blob.url}`);
      } catch (blobErr) {
        console.warn('[ResumePreAuth] Blob upload failed:', blobErr);
        // Never downgrade an already-stored PDF to a placeholder on a transient failure.
        const existing = await prisma.user.findUnique({ where: { id: user.id }, select: { resumeUrl: true } });
        if (existing?.resumeUrl?.includes('blob.vercel-storage')) blobUrl = existing.resumeUrl;
      }
    }

    // IP-geo fallback for location: when the résumé/LinkedIn parse yields no location, derive it from
    // the signup request IP (Vercel headers) so genuine candidates don't fall into the UNKNOWN bucket —
    // which the matcher's MATCH_REGION_BLOCK treats as blocked, silently excluding real (mostly LATAM)
    // users. Write the FULL country name (not the ISO code): the region resolver matches names/cities,
    // and a trailing 2-letter code would collide with US-state abbreviations ("CO" = Colorado, not Colombia).
    let resolvedLocation = (parsedProfile?.location as string) || undefined;
    if (!resolvedLocation) {
      const ipCode = (request.headers.get('x-vercel-ip-country') || '').toUpperCase();
      const ipCity = request.headers.get('x-vercel-ip-city') ? decodeURIComponent(request.headers.get('x-vercel-ip-city')!) : '';
      let countryName = '';
      if (ipCode) { try { countryName = new Intl.DisplayNames(['en'], { type: 'region' }).of(ipCode) || ''; } catch { /* invalid code */ } }
      if (countryName) resolvedLocation = ipCity ? `${ipCity}, ${countryName}` : countryName;
    }

    // Cache the LinkedIn photo to our Blob NOW (the licdn URL is fresh) — storing the raw signed URL
    // means it 403s in ~2 weeks. Fall back to the raw URL if caching fails (fresh for now).
    const cachedImage = photoUrl ? (await cacheProfilePhotoToBlob(photoUrl, user.id)) || photoUrl : undefined;

    // Save to user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resumeUrl: blobUrl,
        resumeText: pdfText ? pdfText.substring(0, 10000) : undefined,
        resumeFileName: file?.name || undefined,
        parsedProfile: parsedProfile == null ? undefined : (parsedProfile as Prisma.InputJsonValue),
        name: parsedProfile?.name || undefined,
        location: resolvedLocation,
        linkedinUrl: savedLinkedinUrl || undefined,
        image: cachedImage,
        ...(salaryExpectation ? { salaryExpectation, salaryExpectationAt: new Date() } : {}),
        ...(currentRate ? { currentRate } : {}),
        ...(workAuthorization ? { workAuthorization } : {}),
        ...(availableFrom ? { availableFrom } : {}),
        ...(profileShareConsent ? { profileShareConsent: true, profileShareConsentAt: new Date() } : {}),
        // fill-only-missing: auto-extract a GitHub link from the résumé text for verification.
        ...(!user.githubUrl ? (() => { const gh = firstGitHubUrlFrom(pdfText); return gh ? { githubUrl: gh } : {}; })() : {}),
      },
    });

    // Auto-create loop for auto-apply
    const existingLoop = await prisma.autoApplyLoop.findFirst({
      where: { userId: user.id },
    });

    if (!existingLoop && parsedProfile) {
      let titles: string[] = [];
      try {
        const OpenAI = (await import('openai')).default;
        const p = process.env.AI_PROVIDER?.toLowerCase();
        const client = p === 'zai'
          ? new OpenAI({ baseURL: 'https://api.z.ai/api/paas/v4', apiKey: process.env.ZAI_API_KEY || '' })
          : new OpenAI({ baseURL: 'https://api.z.ai/api/paas/v4', apiKey: process.env.ZAI_API_KEY || '' });
        const model = p === 'zai' ? 'glm-4-32b-0414-128k' : 'glm-4-32b-0414-128k';
        const r = await client.chat.completions.create({
          model, temperature: 0.3, max_tokens: 100,
          messages: [
            { role: 'system', content: 'Based on the resume profile, return exactly 3-5 job titles this person should apply to. Return ONLY a JSON array of strings. Example: ["React Developer", "Frontend Engineer", "Full Stack Developer"]' },
            { role: 'user', content: `Name: ${parsedProfile.name}\nTitle: ${parsedProfile.current_title}\nField: ${parsedProfile.field}\nSkills: ${(parsedProfile.skills as string[])?.join(', ')}\nExperience: ${parsedProfile.experience_years} years` },
          ],
        });
        const parsed = JSON.parse(r.choices[0]?.message?.content?.trim() || '[]');
        if (Array.isArray(parsed) && parsed.length > 0) titles = parsed.slice(0, 5);
      } catch {
        if (parsedProfile.current_title) titles.push(String(parsedProfile.current_title));
        if (parsedProfile.field) titles.push(String(parsedProfile.field));
      }
      if (titles.length === 0) {
        if (parsedProfile.current_title) titles.push(String(parsedProfile.current_title));
        if (parsedProfile.field) titles.push(String(parsedProfile.field));
      }

      await Promise.all([
        prisma.autoApplyLoop.create({
          data: {
            userId: user.id,
            name: `${titles[0] || 'Auto'} — Auto-Apply`,
            jobTitles: titles,
            categorySlugs: deriveCategorySlugs({ jobTitles: titles, currentTitle: parsedProfile.current_title as string, field: parsedProfile.field as string, skills: parsedProfile.skills as string[] }),
            keywords: (parsedProfile.skills as string[])?.slice(0, 5).join(', ') || null,
            dailyLimit: 20,
            mode: 'MANUAL', // self-apply is the default; auto-send is opt-in (settings toggle)
            isActive: true, // autonomous auto-apply on (TEMP PAUSE from 2026-06-03 lifted 2026-06-08 after matcher quality work: gate, honesty, free-domain)
          },
        }),
        prisma.user.update({
          where: { id: user.id },
          data: { needsOnboarding: false },
        }),
      ]);

      console.log(`[ResumePreAuth] Created auto-apply loop for ${email}: ${titles.join(', ')}`);
    }

    console.log(`[ResumePreAuth] Resume uploaded for ${email}: ${parsedProfile?.name || 'unknown'}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ResumePreAuth] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
