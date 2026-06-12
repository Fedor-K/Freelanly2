import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { deriveCategorySlugs } from '@/lib/loop-routing';

// Vercel: give the batch room (each résumé = one AI call ~2-5s).
export const maxDuration = 300;

const ADMIN_EMAILS = ['fedor.hatla@gmail.com'];

// Backfill for the 2026-06-10/11 Z.ai outage: ~105 users uploaded a real résumé, the text extracted
// fine, but the AI extraction step returned nothing → parsedProfile = null → no skills → the matcher
// rejects them ("zero skill evidence") → zero auto-applies. Z.ai is back; this re-runs the SAME
// extraction on the stored resumeText and, when the user has no loop yet (the original flow skips
// loop creation when parse fails), creates an active AUTO loop so the matcher picks them up.
//
//   /api/admin/reparse-resumes?days=6&limit=8   (admin-gated; call repeatedly until remaining=0)
function aiClient() {
  return new OpenAI({ baseURL: 'https://api.z.ai/api/paas/v4', apiKey: process.env.ZAI_API_KEY || '' });
}

const EXTRACT_SYSTEM = `You extract structured data from resumes. Return ONLY valid JSON, no markdown, no explanation.
Format: {"name":"string","email":"string or null","phone":"string or null","skills":["skill1","skill2"],"experience_years":number,"current_title":"string","field":"string","summary":"1-2 sentence professional summary","languages":["English","Spanish"],"location":"City, Country or null","experience":[{"title":"Job Title","company":"Company Name","dates":"Start - End","description":"Brief description of role and achievements"}],"education":[{"degree":"Degree","institution":"University Name","dates":"Start - End"}],"projects":[{"name":"Project Name","description":"Brief description"}],"certifications":["Cert name (Year)"]}
Extract as many skills as you can find (up to 20). Extract ALL experience roles, education entries, projects, and certifications. If a field is not found, use null or empty array.`;

async function parseResume(resumeText: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await aiClient().chat.completions.create({
      model: 'glm-4-32b-0414-128k',
      temperature: 0.1,
      max_tokens: 1500,
      messages: [
        { role: 'system', content: EXTRACT_SYSTEM },
        { role: 'user', content: `Extract profile data from this resume:\n\n${resumeText.slice(0, 5000)}` },
      ],
    });
    const content = r.choices[0]?.message?.content?.trim() || '';
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const profile = JSON.parse(m[0]) as Record<string, unknown>;
    // Only count it as success if we actually got skills or languages (the whole point of the fix).
    const skills = Array.isArray(profile.skills) ? profile.skills : [];
    const langs = Array.isArray(profile.languages) ? profile.languages : [];
    if (skills.length === 0 && langs.length === 0) return null;
    return profile;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  // Auth: admin session OR ?secret=CRON_SECRET (so this one-off backfill can be driven headless).
  const session = await auth();
  const isAdmin = !!session?.user?.email && ADMIN_EMAILS.includes(session.user.email);
  const secretOk = !!process.env.CRON_SECRET && request.nextUrl.searchParams.get('secret') === process.env.CRON_SECRET;
  if (!isAdmin && !secretOk) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const days = Math.min(30, Math.max(1, parseInt(request.nextUrl.searchParams.get('days') || '6', 10)));
  const limit = Math.min(20, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '8', 10)));
  const since = new Date(Date.now() - days * 86400000);

  const stuck = await prisma.user.findMany({
    where: { resumeText: { not: null }, parsedProfile: { equals: Prisma.DbNull }, createdAt: { gte: since } },
    select: { id: true, name: true, resumeText: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  let parsedOk = 0, parseFailed = 0, loopsCreated = 0;
  for (const u of stuck) {
    const profile = await parseResume(u.resumeText || '');
    if (!profile) { parseFailed++; continue; }

    await prisma.user.update({
      where: { id: u.id },
      data: {
        parsedProfile: profile as object,
        ...(u.name ? {} : (typeof profile.name === 'string' && profile.name ? { name: profile.name } : {})),
      },
    });
    parsedOk++;

    // Create an active loop if the user has none (original flow skips loop creation on parse fail).
    const hasLoop = await prisma.autoApplyLoop.findFirst({ where: { userId: u.id }, select: { id: true } });
    if (!hasLoop) {
      const currentTitle = typeof profile.current_title === 'string' ? profile.current_title : null;
      const field = typeof profile.field === 'string' ? profile.field : null;
      const skills = Array.isArray(profile.skills) ? (profile.skills as unknown[]).map(String) : [];
      const titles = [currentTitle, field].filter((t): t is string => !!t);
      if (titles.length === 0) titles.push('Freelancer');
      await prisma.autoApplyLoop.create({
        data: {
          userId: u.id,
          name: `${titles[0]} — Auto-Apply`,
          jobTitles: titles,
          categorySlugs: deriveCategorySlugs({ jobTitles: titles, currentTitle, field, skills }),
          keywords: skills.slice(0, 5).join(', ') || null,
          dailyLimit: 20,
          mode: 'AUTO',
          isActive: true,
        },
      }).catch(() => {});
      loopsCreated++;
    }
  }

  const remaining = await prisma.user.count({
    where: { resumeText: { not: null }, parsedProfile: { equals: Prisma.DbNull }, createdAt: { gte: since } },
  });

  return NextResponse.json({ found: stuck.length, parsedOk, parseFailed, loopsCreated, remaining, hint: remaining > 0 ? 'call again to continue' : 'done' });
}
