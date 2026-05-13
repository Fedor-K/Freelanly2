import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import OpenAI from 'openai';

function getAIClient() {
  const p = process.env.AI_PROVIDER?.toLowerCase();
  if (p === 'zai') return { client: new OpenAI({ baseURL: 'https://api.z.ai/api/paas/v4', apiKey: process.env.ZAI_API_KEY || '' }), model: 'glm-4-32b-0414-128k' };
  return { client: new OpenAI({ baseURL: 'https://api.deepseek.com/v1', apiKey: process.env.DEEPSEEK_API_KEY || '' }), model: 'deepseek-chat' };
}

/**
 * POST /api/user/portfolio — Scrape portfolio URL and extract projects
 * Body: { url: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { url } = await request.json();
    if (!url || !url.includes('.')) {
      return NextResponse.json({ error: 'Valid URL required' }, { status: 400 });
    }

    // Scrape the portfolio page
    let pageText = '';
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Freelanly/1.0)' },
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const html = await resp.text();
      // Strip HTML tags, keep text
      pageText = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 8000);
    } catch (e) {
      return NextResponse.json({ error: `Could not fetch URL: ${e}` }, { status: 400 });
    }

    if (pageText.length < 50) {
      return NextResponse.json({ error: 'Page appears empty or blocked' }, { status: 400 });
    }

    // AI extract projects
    const { client, model } = getAIClient();
    let projects: Array<{ title: string; description: string; tech: string[]; url?: string }> = [];

    try {
      const r = await client.chat.completions.create({
        model, temperature: 0.1, max_tokens: 800,
        messages: [
          { role: 'system', content: 'Extract portfolio projects/case studies from this webpage. Return ONLY valid JSON array: [{"title":"Project Name","description":"1-2 sentence description of what was built/achieved","tech":["React","Node.js"],"url":"link if found"}]. Max 8 projects. If no projects found, return [].' },
          { role: 'user', content: pageText },
        ],
      });
      const content = r.choices[0]?.message?.content?.trim() || '[]';
      const match = content.match(/\[[\s\S]*\]/);
      if (match) projects = JSON.parse(match[0]);
    } catch (e) {
      console.error('[Portfolio] AI extraction failed:', e);
    }

    // Save to user
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        caseStudies: projects.length > 0 ? projects : undefined,
        resumeUrl: url, // Also update portfolio URL
      },
    });

    console.log(`[Portfolio] Extracted ${projects.length} projects from ${url} for user ${session.user.id}`);

    return NextResponse.json({
      ok: true,
      projects,
      count: projects.length,
    });
  } catch (error) {
    console.error('[Portfolio] Error:', error);
    return NextResponse.json({ error: 'Failed to process portfolio' }, { status: 500 });
  }
}

/**
 * GET /api/user/portfolio — Get user's indexed projects
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { caseStudies: true },
    });

    return NextResponse.json({
      projects: user?.caseStudies || [],
    });
  } catch (error) {
    console.error('[Portfolio] GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
