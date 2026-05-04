import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import OpenAI from 'openai';

// Simple PDF text extractor — works without native dependencies
// Extracts readable text from PDF binary by finding text between BT/ET markers
// and decoding parenthesized strings. Not perfect but works for most resumes.
function extractTextFromPDF(buffer: Buffer): string {
  const text = buffer.toString('latin1');
  const textParts: string[] = [];

  // Method 1: Extract text from stream objects
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  while ((match = streamRegex.exec(text)) !== null) {
    const stream = match[1];
    // Extract parenthesized strings (PDF text objects)
    const parenRegex = /\(([^)]*)\)/g;
    let pMatch;
    while ((pMatch = parenRegex.exec(stream)) !== null) {
      const decoded = pMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '')
        .replace(/\\t/g, ' ')
        .replace(/\\\\/g, '\\')
        .replace(/\\([()])/g, '$1');
      if (decoded.trim().length > 1) {
        textParts.push(decoded);
      }
    }
  }

  // Method 2: Try to find raw text content
  const rawTextRegex = /\/Type\s*\/Page[\s\S]*?BT\s*([\s\S]*?)\s*ET/g;
  while ((match = rawTextRegex.exec(text)) !== null) {
    const btContent = match[1];
    const tjRegex = /\(([^)]+)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(btContent)) !== null) {
      textParts.push(tjMatch[1]);
    }
  }

  return textParts.join(' ').replace(/\s+/g, ' ').trim();
}

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
 * Upload PDF resume, extract text, parse with AI
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

    // Extract text from PDF
    const buffer = Buffer.from(await file.arrayBuffer());
    let pdfText: string;
    try {
      pdfText = extractTextFromPDF(buffer);
    } catch {
      return NextResponse.json({ error: 'Could not read PDF. Make sure it contains text (not scanned images).' }, { status: 400 });
    }

    if (!pdfText || pdfText.trim().length < 50) {
      return NextResponse.json({ error: 'PDF appears empty or contains only images. Please upload a text-based PDF.' }, { status: 400 });
    }

    // Parse with AI
    let parsedProfile;
    try {
      const client = getAIClient();
      const response = await client.chat.completions.create({
        model: getModel(),
        messages: [
          {
            role: 'system',
            content: `You extract structured data from resumes. Return ONLY valid JSON, no markdown.
Format: {"name":"string","email":"string","skills":["skill1","skill2"],"experience_years":number,"current_title":"string","field":"string","summary":"1-2 sentence professional summary"}
If a field is not found, use null.`,
          },
          {
            role: 'user',
            content: `Extract profile data from this resume:\n\n${pdfText.substring(0, 4000)}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content?.trim() || '';
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedProfile = JSON.parse(jsonMatch[0]);
      }
    } catch (aiError) {
      console.error('[Resume] AI parsing failed:', aiError);
      // Continue without AI parsing — at least save the text
    }

    // Store resume text and parsed profile on user
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        resumeUrl: `uploaded:${file.name}`,
        name: parsedProfile?.name || undefined,
      },
    });

    console.log(`[Resume] Parsed resume for user ${session.user.id}: ${parsedProfile?.name || 'no name'}, ${parsedProfile?.skills?.length || 0} skills`);

    return NextResponse.json({
      success: true,
      fileName: file.name,
      textLength: pdfText.length,
      profile: parsedProfile || null,
      resumeText: pdfText.substring(0, 500) + (pdfText.length > 500 ? '...' : ''),
    });
  } catch (error) {
    console.error('[API] Error processing resume:', error);
    return NextResponse.json({ error: 'Failed to process resume' }, { status: 500 });
  }
}
