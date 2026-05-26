import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { extractText } from 'unpdf';
import OpenAI from 'openai';
import { put } from '@vercel/blob';

const AI_PROVIDER = process.env.AI_PROVIDER || 'deepseek';

function getAIClient() {
  if (AI_PROVIDER === 'zai') {
    return new OpenAI({
      baseURL: 'https://api.z.ai/api/paas/v4',
      apiKey: process.env.ZAI_API_KEY || '',
    });
  }
  return new OpenAI({
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: process.env.DEEPSEEK_API_KEY || '',
  });
}

function getModel() {
  return AI_PROVIDER === 'zai' ? 'glm-4-32b-0414-128k' : 'deepseek-chat';
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

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    if (file && (file.size > 5 * 1024 * 1024 || !file.name.toLowerCase().endsWith('.pdf'))) {
      return NextResponse.json({ error: 'PDF under 5MB required' }, { status: 400 });
    }

    if (!file && !linkedinUrl) {
      return NextResponse.json({ error: 'Resume or LinkedIn URL required' }, { status: 400 });
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
Format: {"name":"string","email":"string or null","phone":"string or null","skills":["skill1","skill2"],"experience_years":number,"current_title":"string","field":"string","summary":"1-2 sentence summary","languages":["English"]}
Extract up to 20 skills. If not found, use null.` },
              { role: 'user', content: `Extract profile data:\n\n${pdfText.substring(0, 5000)}` },
            ],
            temperature: 0.1,
            max_tokens: 700,
          });
          const m = (response.choices[0]?.message?.content || '').match(/\{[\s\S]*\}/);
          if (m) resumeProfile = JSON.parse(m[0]);
        } catch (e) {
          console.error('[ResumePreAuth] résumé AI parse failed:', e);
        }
      }
    }

    // 2) LinkedIn → structured profile (ENRICHMENT). NOTE: the actor's input field is
    // `urls` (NOT `profileUrls`) and skills come back as `topSkills` — the old code used
    // the wrong names, so this scrape silently returned nothing for ~everyone.
    let liProfile: Record<string, unknown> | null = null;
    if (linkedinUrl && linkedinUrl.includes('linkedin.com/in/')) {
      try {
        const apifyToken = process.env.APIFY_API_TOKEN;
        if (apifyToken) {
          const runRes = await fetch(
            `https://api.apify.com/v2/acts/harvestapi~linkedin-profile-scraper/run-sync-get-dataset-items?token=${apifyToken}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ urls: [linkedinUrl] }),
              signal: AbortSignal.timeout(35000),
            }
          );
          if (runRes.ok) {
            const items = await runRes.json();
            const pr = Array.isArray(items) ? items[0] : null;
            if (pr) {
              const liName = `${pr.firstName || ''} ${pr.lastName || ''}`.trim() || pr.fullName || null;
              // The actor returns BOTH topSkills (highlighted 3-5) and skills (full list) —
              // union them so we don't lose the full set (esp. for LinkedIn-only users).
              const liSkills = [...new Set([
                ...(Array.isArray(pr.topSkills) ? pr.topSkills : []),
                ...(Array.isArray(pr.skills) ? pr.skills : []),
              ].map((s: { name?: string } | string) => (typeof s === 'object' && s ? s.name : s))
                .filter(Boolean)
                .map((s) => String(s).trim()))].slice(0, 20);
              const liLangs = (Array.isArray(pr.languages) ? pr.languages : [])
                .map((l: { name?: string } | string) => (typeof l === 'object' && l ? l.name : l))
                .filter(Boolean);
              const liLoc = typeof pr.location === 'string' ? pr.location : (pr.location?.linkedinText || pr.location?.text || null);
              liProfile = {
                name: liName,
                email,
                current_title: pr.headline || null,
                field: pr.headline || null,
                skills: liSkills,
                summary: pr.about || '',
                experience_years: 0,
                languages: liLangs,
                location: liLoc,
              };
              if (!pdfText && pr.about) {
                pdfText = `${liName || ''}\n${pr.headline || ''}\n\n${pr.about}\n\nSkills: ${(liSkills as string[]).join(', ')}`;
              }
              console.log(`[ResumePreAuth] LinkedIn scraped for ${email}: ${liName}, ${(liSkills as string[]).length} skills`);
            } else {
              console.warn(`[ResumePreAuth] LinkedIn returned no items for ${email}`);
            }
          }
        }
      } catch (e) {
        console.error('[ResumePreAuth] LinkedIn scraping failed:', e);
      }
    }

    // 3) MERGE — résumé is the base (richer/authoritative); LinkedIn enriches: union
    // skills + languages, prefer the LinkedIn headline as the current title. Never drops
    // résumé detail. Falls back to whichever single source exists.
    const uniq = (arr: unknown[]) => [...new Set(arr.filter(Boolean).map((s) => String(s).trim()).filter((s) => s.length > 0))];
    if (resumeProfile && liProfile) {
      parsedProfile = {
        name: resumeProfile.name || liProfile.name,
        email: resumeProfile.email || liProfile.email || email,
        phone: (resumeProfile.phone as string) || null,
        current_title: liProfile.current_title || resumeProfile.current_title,
        field: resumeProfile.field || liProfile.field,
        skills: uniq([...((resumeProfile.skills as unknown[]) || []), ...((liProfile.skills as unknown[]) || [])]).slice(0, 25),
        languages: uniq([...((resumeProfile.languages as unknown[]) || []), ...((liProfile.languages as unknown[]) || [])]),
        experience_years: (resumeProfile.experience_years as number) || (liProfile.experience_years as number) || 0,
        summary: ((liProfile.summary as string) || '').length > ((resumeProfile.summary as string) || '').length ? liProfile.summary : (resumeProfile.summary || liProfile.summary),
        location: resumeProfile.location || liProfile.location || null,
      };
    } else {
      parsedProfile = resumeProfile || liProfile;
    }

    if (!pdfText && !parsedProfile) {
      return NextResponse.json({ error: 'Could not extract profile data' }, { status: 400 });
    }

    // Upload original PDF to Vercel Blob
    let blobUrl = file ? `uploaded:${file.name}` : linkedinUrl || undefined;
    if (file && buffer) {
      try {
        const blob = await put(`resumes/${user.id}/${file.name}`, buffer, {
          access: 'public',
          contentType: 'application/pdf',
        });
        blobUrl = blob.url;
        console.log(`[ResumePreAuth] Uploaded to Blob: ${blob.url}`);
      } catch (blobErr) {
        console.warn('[ResumePreAuth] Blob upload failed:', blobErr);
      }
    }

    // Save to user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resumeUrl: blobUrl,
        resumeText: pdfText ? pdfText.substring(0, 10000) : undefined,
        resumeFileName: file?.name || undefined,
        parsedProfile: parsedProfile || undefined,
        name: parsedProfile?.name || undefined,
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
          : new OpenAI({ baseURL: 'https://api.deepseek.com/v1', apiKey: process.env.DEEPSEEK_API_KEY || '' });
        const model = p === 'zai' ? 'glm-4-32b-0414-128k' : 'deepseek-chat';
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
        if (parsedProfile.current_title) titles.push(parsedProfile.current_title);
        if (parsedProfile.field) titles.push(parsedProfile.field);
      }
      if (titles.length === 0) {
        if (parsedProfile.current_title) titles.push(parsedProfile.current_title);
        if (parsedProfile.field) titles.push(parsedProfile.field);
      }

      await Promise.all([
        prisma.autoApplyLoop.create({
          data: {
            userId: user.id,
            name: `${titles[0] || 'Auto'} — Auto-Apply`,
            jobTitles: titles,
            keywords: (parsedProfile.skills as string[])?.slice(0, 5).join(', ') || null,
            dailyLimit: 20,
            mode: 'AUTO',
            isActive: true,
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
