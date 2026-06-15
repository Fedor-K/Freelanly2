import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { extractText } from 'unpdf';
import OpenAI from 'openai';
import { put } from '@vercel/blob';
import { scrapeLinkedInProfile, mergeCandidateProfiles, normalizeLinkedInUrl } from '@/lib/linkedin-profile';
import { deriveCategorySlugs } from '@/lib/loop-routing';

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
      select: { id: true },
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

    // Save to user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resumeUrl: blobUrl,
        resumeText: pdfText ? pdfText.substring(0, 10000) : undefined,
        resumeFileName: file?.name || undefined,
        parsedProfile: parsedProfile == null ? undefined : (parsedProfile as Prisma.InputJsonValue),
        name: parsedProfile?.name || undefined,
        location: (parsedProfile?.location as string) || undefined,
        linkedinUrl: savedLinkedinUrl || undefined,
        image: photoUrl || undefined,
        ...(salaryExpectation ? { salaryExpectation, salaryExpectationAt: new Date() } : {}),
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
            mode: 'AUTO',
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
