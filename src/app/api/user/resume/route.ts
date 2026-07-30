import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { extractText } from 'unpdf';
import OpenAI from 'openai';
import { put } from '@vercel/blob';
import { mergeCandidateProfiles } from '@/lib/linkedin-profile';
import { deriveCategorySlugs } from '@/lib/loop-routing';
import { firstGitHubUrlFrom } from '@/lib/github-review/extract-username';
import { isLocationBlocked } from '@/lib/region-block';

const AI_PROVIDER = process.env.AI_PROVIDER || 'zai';

function getAIClient() {
  if (AI_PROVIDER === 'zai') {
    return new OpenAI({
      baseURL: 'https://api.z.ai/api/paas/v4',
      apiKey: (process.env.ZAI_KEY_RESUME||process.env.ZAI_API_KEY) || '',
    });
  }
  return new OpenAI({
    baseURL: 'https://api.z.ai/api/paas/v4',
    apiKey: (process.env.ZAI_KEY_RESUME||process.env.ZAI_API_KEY) || '',
  });
}

function getModel() {
  return AI_PROVIDER === 'zai' ? 'glm-4-32b-0414-128k' : 'glm-4-32b-0414-128k';
}

/**
 * Log a résumé-upload FAILURE so we stop being blind to silent "can't update resume" cases.
 * Before this, only success (RESUME_UPLOADED) was logged, so every 400/403/500 was invisible.
 * Uses FUNNEL_STEP (no enum/DB change needed) with a dedicated step.
 * Query: SELECT details->>'reason', count(*) FROM "ActivityLog"
 *        WHERE action='FUNNEL_STEP' AND details->>'step'='resume_upload_failed' GROUP BY 1;
 */
async function logResumeFail(userId: string, reason: string, detail?: string) {
  await prisma.activityLog.create({
    data: { userId, action: 'FUNNEL_STEP', details: { step: 'resume_upload_failed', reason, ...(detail ? { detail: detail.slice(0, 200) } : {}) } },
  }).catch(() => {});
}

/**
 * Coerce a value to a non-empty string or undefined. The AI/merge can emit `location` (or `name`) as
 * an OBJECT (e.g. LinkedIn's {parsed, linkedinText}) — writing that into a String Prisma column throws
 * "Expected String", surfacing as a 500 "Failed to process resume". `as string` is a compile-time cast
 * only, so it never protected the runtime. This does.
 */
function safeStr(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined;
}

/**
 * POST /api/user/resume
 * Upload PDF resume, extract text with unpdf, parse with AI
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      await logResumeFail(session.user.id, 'no_file');
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      await logResumeFail(session.user.id, 'file_too_large', `${Math.round(file.size / 1024)}KB`);
      return NextResponse.json({ error: 'File too large. Max 5MB.' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      await logResumeFail(session.user.id, 'not_pdf', file.name.slice(0, 80));
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
    }

    // Extract text from PDF using unpdf (pure JS, no native deps)
    const buffer = new Uint8Array(await file.arrayBuffer());
    let pdfText: string;
    try {
      // Pass a COPY: extractText (pdf.js) detaches the ArrayBuffer, which would
      // otherwise break the Blob put() on the same buffer below.
      const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
      pdfText = typeof text === 'string' ? text : (text as string[]).join('\n');
    } catch (e) {
      console.error('[Resume] PDF extraction failed:', e);
      await logResumeFail(session.user.id, 'pdf_extract_failed', e instanceof Error ? e.message : String(e));
      return NextResponse.json({ error: 'Could not read PDF. Make sure it contains text (not scanned images).' }, { status: 400 });
    }

    if (!pdfText || pdfText.trim().length < 50) {
      await logResumeFail(session.user.id, 'pdf_empty_or_images', `${pdfText?.trim().length ?? 0} chars`);
      return NextResponse.json({ error: 'PDF appears empty or contains only images. Please upload a text-based PDF.' }, { status: 400 });
    }

    console.log(`[Resume] Extracted ${pdfText.length} chars from ${file.name}`);

    // Parse with AI
    let parsedProfile = null;
    try {
      const client = getAIClient();
      const response = await client.chat.completions.create({
        model: getModel(),
        messages: [
          {
            role: 'system',
            content: `You extract structured data from resumes. Return ONLY valid JSON, no markdown, no explanation.
Format: {
  "name":"string",
  "email":"string or null",
  "phone":"string or null",
  "skills":["skill1","skill2"],
  "experience_years":number,
  "current_title":"string",
  "field":"string",
  "summary":"1-2 sentence professional summary",
  "languages":["English","Spanish"],
  "location":"City, Country or null",
  "experience":[{"title":"Job Title","company":"Company Name","dates":"Start - End","description":"Brief description of role and achievements"}],
  "education":[{"degree":"Degree","institution":"University Name","dates":"Start - End"}],
  "projects":[{"name":"Project Name","description":"Brief description"}],
  "certifications":["Cert name (Year)"]
}
Extract as many skills as you can find (up to 20). Extract ALL experience roles, education entries, projects, and certifications. If a field is not found, use null or empty array.
IMPORTANT — "experience_years" is total YEARS OF PROFESSIONAL WORK EXPERIENCE computed from the job-date history (NOT age, NOT birth year, NOT years since graduation, NOT a phone/ID number). It must be plausible (0-45) and never exceed the work-history span — if the jobs span ~10 years, output ~10, never the person's age (e.g. 34). If unknown, use 0.`,
          },
          {
            role: 'user',
            content: `Extract profile data from this resume:\n\n${pdfText.substring(0, 5000)}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 1500,
      });

      const content = response.choices[0]?.message?.content?.trim() || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedProfile = JSON.parse(jsonMatch[0]);
      }
    } catch (aiError) {
      console.error('[Resume] AI parsing failed:', aiError);
    }

    // Upload original PDF to Vercel Blob. allowOverwrite:true is REQUIRED — @vercel/blob v2
    // throws on an existing pathname by default, and our pathname is deterministic
    // (resumes/{userId}/{filename}). A re-upload of the same file would otherwise throw and
    // silently drop the PDF (the user ends up with an "uploaded:" placeholder).
    let blobUrl = `uploaded:${file.name}`;
    try {
      const blob = await put(`resumes/${session.user.id}/${file.name}`, Buffer.from(buffer), {
        access: 'public',
        contentType: 'application/pdf',
        allowOverwrite: true,
      });
      blobUrl = blob.url;
      console.log(`[Resume] Uploaded to Blob: ${blob.url}`);
    } catch (blobErr) {
      console.warn('[Resume] Blob upload failed, storing without original PDF:', blobErr);
      // Never downgrade an already-stored PDF to a placeholder on a transient failure.
      const existing = await prisma.user.findUnique({ where: { id: session.user.id }, select: { resumeUrl: true } });
      if (existing?.resumeUrl?.includes('blob.vercel-storage')) blobUrl = existing.resumeUrl;
    }

    // Merge the résumé profile with whatever's already on the user (e.g. LinkedIn-derived data) —
    // a résumé upload must ENRICH, never WIPE, the LinkedIn part. Résumé is the authoritative base.
    const existingUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { parsedProfile: true, email: true, githubUrl: true, portfolioUrl: true } });
    const existingProfile = (existingUser?.parsedProfile as Record<string, unknown> | null) || null;
    const mergedProfile = parsedProfile
      ? mergeCandidateProfiles(parsedProfile, existingProfile, existingUser?.email || '')
      : existingProfile;

    // Region backstop — same gate as the pre-auth signup path. Email-first signups reach the
    // dashboard before any résumé is parsed, so the blocked country only becomes visible HERE,
    // on the authenticated upload. Without this check a blocked-region user can sign up with email,
    // upload a résumé, get a loop, and start applying (exactly how the Nigeria leak happened).
    const candidateLoc = safeStr((mergedProfile as Record<string, unknown> | null)?.location) ?? null;
    if (isLocationBlocked(candidateLoc)) {
      console.log(`[Resume] region-blocked upload: ${existingUser?.email} (${candidateLoc})`);
      await logResumeFail(session.user.id, 'region_blocked', candidateLoc || 'unknown');
      return NextResponse.json({ error: 'Freelanly isn’t available in your region yet.', regionBlocked: true }, { status: 403 });
    }

    // Store resume data + parsed profile on user
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        resumeUrl: blobUrl,
        resumeText: pdfText.substring(0, 10000),
        resumeFileName: file.name,
        parsedProfile: (mergedProfile as object) || undefined,
        name: safeStr(parsedProfile?.name),
        location: safeStr((mergedProfile as Record<string, unknown> | null)?.location),
        // fill-only-missing: a GitHub link on the résumé (or in portfolioUrl) feeds verification;
        // never overwrite a candidate-entered githubUrl.
        ...(!existingUser?.githubUrl ? (() => { const gh = firstGitHubUrlFrom(existingUser?.portfolioUrl, pdfText); return gh ? { githubUrl: gh } : {}; })() : {}),
      },
    });

    console.log(`[Resume] Parsed for user ${session.user.id}: ${parsedProfile?.name || 'unknown'}, ${parsedProfile?.skills?.length || 0} skills, ${parsedProfile?.experience_years || '?'} years`);

    // Funnel event: résumé upload previously only mutated User state — invisible in ActivityLog.
    await prisma.activityLog.create({
      data: { userId: session.user.id, action: 'RESUME_UPLOADED', details: { source: 'dashboard', parsed: !!parsedProfile, fileName: file.name.slice(0, 80) } },
    }).catch(() => {});

    // Auto-create loop if user doesn't have one
    const existingLoop = await prisma.autoApplyLoop.findFirst({
      where: { userId: session.user.id },
    });
    if (!existingLoop && parsedProfile) {
      // Use AI to determine real job titles to search for
      let titles: string[] = [];
      let keywords = '';
      try {
        const OpenAI = (await import('openai')).default;
        const p = process.env.AI_PROVIDER?.toLowerCase();
        const client = p === 'zai'
          ? new OpenAI({ baseURL: 'https://api.z.ai/api/paas/v4', apiKey: (process.env.ZAI_KEY_RESUME||process.env.ZAI_API_KEY) || '' })
          : new OpenAI({ baseURL: 'https://api.z.ai/api/paas/v4', apiKey: (process.env.ZAI_KEY_RESUME||process.env.ZAI_API_KEY) || '' });
        const model = p === 'zai' ? 'glm-4-32b-0414-128k' : 'glm-4-32b-0414-128k';
        const r = await client.chat.completions.create({
          model, temperature: 0.3, max_tokens: 100,
          messages: [
            { role: 'system', content: 'Based on the resume profile, return exactly 3-5 job titles this person should apply to. Return ONLY a JSON array of strings, nothing else. Example: ["React Developer", "Frontend Engineer", "Full Stack Developer"]' },
            { role: 'user', content: `Name: ${parsedProfile.name}\nTitle: ${parsedProfile.current_title}\nField: ${parsedProfile.field}\nSkills: ${(parsedProfile.skills as string[])?.join(', ')}\nExperience: ${parsedProfile.experience_years} years` },
          ],
        });
        const content = r.choices[0]?.message?.content?.trim() || '';
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0) titles = parsed.slice(0, 5);
      } catch {
        // Fallback to parser output
        if (parsedProfile.current_title) titles.push(parsedProfile.current_title);
        if (parsedProfile.field) titles.push(parsedProfile.field);
      }
      if (titles.length === 0) {
        if (parsedProfile.current_title) titles.push(parsedProfile.current_title);
        if (parsedProfile.field) titles.push(parsedProfile.field);
      }
      keywords = (parsedProfile.skills as string[])?.slice(0, 5).join(', ') || '';

      await Promise.all([
        prisma.autoApplyLoop.create({
          data: {
            userId: session.user.id,
            name: `${titles[0] || 'Auto'} — Auto-Apply`,
            jobTitles: titles,
            categorySlugs: deriveCategorySlugs({ jobTitles: titles, currentTitle: parsedProfile?.current_title, field: parsedProfile?.field, skills: parsedProfile?.skills as string[] }),
            keywords: keywords || null,
            dailyLimit: 20,
            mode: 'MANUAL', // self-apply is the default; auto-send is opt-in (settings toggle)
            isActive: true, // autonomous auto-apply on (TEMP PAUSE from 2026-06-03 lifted 2026-06-08 after matcher quality work: gate, honesty, free-domain)
          },
        }),
        prisma.user.update({
          where: { id: session.user.id },
          data: { needsOnboarding: false },
        }),
      ]);
      console.log(`[Resume] Auto-created loop for user ${session.user.id}: ${titles.join(', ')}`);
    }

    return NextResponse.json({
      success: true,
      fileName: file.name,
      textLength: pdfText.length,
      profile: parsedProfile,
      resumeText: pdfText.substring(0, 500) + (pdfText.length > 500 ? '...' : ''),
    });
  } catch (error) {
    console.error('[API] Error processing resume:', error);
    try {
      const s = await auth();
      if (s?.user?.id) await logResumeFail(s.user.id, 'server_error', error instanceof Error ? error.message : String(error));
    } catch { /* best-effort */ }
    return NextResponse.json({ error: 'Failed to process resume' }, { status: 500 });
  }
}
