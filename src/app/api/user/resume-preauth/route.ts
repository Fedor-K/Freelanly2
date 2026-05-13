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

    // Option 1: PDF resume
    if (file) {
      buffer = new Uint8Array(await file.arrayBuffer());
      try {
        const { text } = await extractText(buffer, { mergePages: true });
        pdfText = typeof text === 'string' ? text : (text as string[]).join('\n');
      } catch {
        // Continue — LinkedIn might still work
      }
    }

    // Option 2: LinkedIn profile scraping
    if (linkedinUrl && linkedinUrl.includes('linkedin.com/in/')) {
      try {
        const apifyToken = process.env.APIFY_API_TOKEN;
        if (apifyToken) {
          const runRes = await fetch(
            `https://api.apify.com/v2/acts/harvestapi~linkedin-profile-scraper/run-sync-get-dataset-items?token=${apifyToken}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ profileUrls: [linkedinUrl] }),
              signal: AbortSignal.timeout(30000),
            }
          );
          if (runRes.ok) {
            const items = await runRes.json();
            const profile = items[0];
            if (profile) {
              parsedProfile = {
                name: profile.fullName || profile.firstName + ' ' + profile.lastName,
                email: email,
                current_title: profile.headline || null,
                field: profile.headline || null,
                skills: (profile.skills || []).map((s: { name?: string }) => s.name || s).filter(Boolean).slice(0, 15),
                summary: profile.about || profile.summary || '',
                experience_years: profile.experience?.length || 0,
                languages: (profile.languages || []).map((l: { name?: string }) => l.name || l).filter(Boolean),
              };
              if (!pdfText && profile.about) {
                pdfText = `${profile.fullName}\n${profile.headline}\n\n${profile.about}\n\nSkills: ${(parsedProfile.skills as string[]).join(', ')}`;
              }
              console.log(`[ResumePreAuth] LinkedIn parsed for ${email}: ${parsedProfile.name}`);
            }
          }
        }
      } catch (e) {
        console.error('[ResumePreAuth] LinkedIn scraping failed:', e);
      }
    }

    if (!pdfText && !parsedProfile) {
      return NextResponse.json({ error: 'Could not extract profile data' }, { status: 400 });
    }

    // Parse PDF with AI (if we have text but no profile yet)
    if (pdfText && !parsedProfile) {
      try {
        const client = getAIClient();
        const response = await client.chat.completions.create({
          model: getModel(),
          messages: [
            {
              role: 'system',
              content: `You extract structured data from resumes. Return ONLY valid JSON, no markdown.
Format: {"name":"string","email":"string or null","phone":"string or null","skills":["skill1","skill2"],"experience_years":number,"current_title":"string","field":"string","summary":"1-2 sentence summary","languages":["English"]}
Extract up to 15 skills. If not found, use null.`,
            },
            { role: 'user', content: `Extract profile data:\n\n${pdfText.substring(0, 5000)}` },
          ],
          temperature: 0.1,
          max_tokens: 600,
        });

        const content = response.choices[0]?.message?.content?.trim() || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsedProfile = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error('[ResumePreAuth] AI parsing failed:', e);
      }
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
      const titles: string[] = [];
      if (parsedProfile.current_title) titles.push(parsedProfile.current_title);
      if (parsedProfile.field) titles.push(parsedProfile.field);

      await prisma.autoApplyLoop.create({
        data: {
          userId: user.id,
          name: `${titles[0] || 'Auto'} — Auto-Apply`,
          jobTitles: titles.slice(0, 5),
          keywords: (parsedProfile.skills as string[])?.slice(0, 5).join(', ') || null,
          dailyLimit: 10,
          mode: 'AUTO',
          isActive: true,
        },
      });

      console.log(`[ResumePreAuth] Created auto-apply loop for ${email}`);
    }

    console.log(`[ResumePreAuth] Resume uploaded for ${email}: ${parsedProfile?.name || 'unknown'}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ResumePreAuth] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
