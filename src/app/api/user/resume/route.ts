import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
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
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 5MB.' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
    }

    // Extract text from PDF using unpdf (pure JS, no native deps)
    const buffer = new Uint8Array(await file.arrayBuffer());
    let pdfText: string;
    try {
      const { text } = await extractText(buffer, { mergePages: true });
      pdfText = typeof text === 'string' ? text : (text as string[]).join('\n');
    } catch (e) {
      console.error('[Resume] PDF extraction failed:', e);
      return NextResponse.json({ error: 'Could not read PDF. Make sure it contains text (not scanned images).' }, { status: 400 });
    }

    if (!pdfText || pdfText.trim().length < 50) {
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
Extract as many skills as you can find (up to 20). Extract ALL experience roles, education entries, projects, and certifications. If a field is not found, use null or empty array.`,
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

    // Upload original PDF to Vercel Blob
    let blobUrl = `uploaded:${file.name}`;
    try {
      const blob = await put(`resumes/${session.user.id}/${file.name}`, buffer, {
        access: 'public',
        contentType: 'application/pdf',
      });
      blobUrl = blob.url;
      console.log(`[Resume] Uploaded to Blob: ${blob.url}`);
    } catch (blobErr) {
      console.warn('[Resume] Blob upload failed, storing without original PDF:', blobErr);
    }

    // Store resume data + parsed profile on user
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        resumeUrl: blobUrl,
        resumeText: pdfText.substring(0, 10000),
        resumeFileName: file.name,
        parsedProfile: parsedProfile || undefined,
        name: parsedProfile?.name || undefined,
      },
    });

    console.log(`[Resume] Parsed for user ${session.user.id}: ${parsedProfile?.name || 'unknown'}, ${parsedProfile?.skills?.length || 0} skills, ${parsedProfile?.experience_years || '?'} years`);

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
          ? new OpenAI({ baseURL: 'https://api.z.ai/api/paas/v4', apiKey: process.env.ZAI_API_KEY || '' })
          : new OpenAI({ baseURL: 'https://api.deepseek.com/v1', apiKey: process.env.DEEPSEEK_API_KEY || '' });
        const model = p === 'zai' ? 'glm-4-32b-0414-128k' : 'deepseek-chat';
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
            keywords: keywords || null,
            dailyLimit: 15,
            mode: 'AUTO',
            isActive: true,
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
    return NextResponse.json({ error: 'Failed to process resume' }, { status: 500 });
  }
}
