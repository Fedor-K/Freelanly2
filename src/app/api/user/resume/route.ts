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
Format: {"name":"string","email":"string or null","phone":"string or null","skills":["skill1","skill2","skill3"],"experience_years":number,"current_title":"string","field":"string","summary":"1-2 sentence professional summary","languages":["English","Spanish"]}
Extract as many skills as you can find (up to 15). If a field is not found, use null.`,
          },
          {
            role: 'user',
            content: `Extract profile data from this resume:\n\n${pdfText.substring(0, 5000)}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 600,
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
