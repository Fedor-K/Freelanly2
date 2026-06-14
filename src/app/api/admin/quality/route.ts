import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const ADMIN_EMAILS = ['fedor.hatla@gmail.com'];
const PERIOD_HOURS: Record<string, number> = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 };

// Lightweight quality dashboard for the auto-apply pipeline: matching (profession dist + gate
// coverage), score calibration, tag health (over-tagging indicator), and a cover-letter spot-check.
// Measured on CREATED rows (not sent — the matchBreakdown is frozen at queue time, so sent-time lags).
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const period = request.nextUrl.searchParams.get('period') || '24h';
  const since = new Date(Date.now() - (PERIOD_HOURS[period] ?? 24) * 3600000);

  const [gate, profDist, sends, tags, samples] = await Promise.all([
    // Gate coverage: of pairings that REACHED the gate (not pre-gate AI-match rejects), how many carry
    // the gate's profession verdict. This is the 5%→94% health metric after the gate cache/timeout fix.
    prisma.$queryRawUnsafe<Array<{ gate_reached: number; with_prof: number }>>(
      `SELECT CAST(COUNT(*) FILTER (WHERE "matchBreakdown"->>'gateReason' IS DISTINCT FROM 'не прошёл AI-match') AS INT) gate_reached,
              CAST(COUNT(*) FILTER (WHERE "matchBreakdown"->>'gateReason' IS DISTINCT FROM 'не прошёл AI-match' AND "matchBreakdown"->>'profession' IS NOT NULL) AS INT) with_prof
       FROM "AutoApplication" WHERE "createdAt" >= $1 AND status NOT IN ('PENDING','SENDING','REVIEW')`, since),
    // Profession distribution among rows that have the verdict (matching health).
    prisma.$queryRawUnsafe<Array<{ profession: string; n: number }>>(
      `SELECT "matchBreakdown"->>'profession' profession, CAST(COUNT(*) AS INT) n
       FROM "AutoApplication" WHERE "createdAt" >= $1 AND "matchBreakdown"->>'profession' IS NOT NULL GROUP BY 1 ORDER BY 2 DESC`, since),
    // Calibration on SENDS in the period: profession of sends + score↔label divergence + blind sends.
    prisma.$queryRawUnsafe<Array<{ sent: number; exact: number; adjacent: number; score80: number; score80_not_strong: number; no_score: number; no_breakdown: number }>>(
      `SELECT CAST(COUNT(*) AS INT) sent,
              CAST(COUNT(*) FILTER (WHERE "matchBreakdown"->>'profession'='exact') AS INT) exact,
              CAST(COUNT(*) FILTER (WHERE "matchBreakdown"->>'profession'='adjacent') AS INT) adjacent,
              CAST(COUNT(*) FILTER (WHERE "matchScore">=80) AS INT) score80,
              CAST(COUNT(*) FILTER (WHERE "matchScore">=80 AND "matchLabel" IS DISTINCT FROM 'Strong') AS INT) score80_not_strong,
              CAST(COUNT(*) FILTER (WHERE "matchScore" IS NULL) AS INT) no_score,
              CAST(COUNT(*) FILTER (WHERE "matchBreakdown" IS NULL) AS INT) no_breakdown
       FROM "AutoApplication" WHERE "sentAt" >= $1`, since),
    // Tag health: coverage + over-tagging indicator (avg / max categories per active loop).
    prisma.$queryRawUnsafe<Array<{ active: number; tagged: number; untagged: number; avg_tags: number; max_tags: number; over3: number }>>(
      `SELECT CAST(COUNT(*) AS INT) active,
              CAST(COUNT(*) FILTER (WHERE cardinality("categorySlugs")>0) AS INT) tagged,
              CAST(COUNT(*) FILTER (WHERE cardinality("categorySlugs")=0) AS INT) untagged,
              CAST(ROUND(AVG(cardinality("categorySlugs")) FILTER (WHERE cardinality("categorySlugs")>0), 2) AS FLOAT) avg_tags,
              CAST(MAX(cardinality("categorySlugs")) AS INT) max_tags,
              CAST(COUNT(*) FILTER (WHERE cardinality("categorySlugs")>3) AS INT) over3
       FROM "AutoApplyLoop" WHERE "isActive"=true`),
    // Cover-letter spot-check: recent real-CV sends (read the snippet for fabrication/genericness).
    prisma.$queryRawUnsafe<Array<{ name: string; title: string | null; job: string | null; score: number | null; label: string | null; letter: string | null }>>(
      `SELECT u.name, u."parsedProfile"->>'current_title' title, a."jobTitle" job, a."matchScore" score, a."matchLabel" label,
              left(regexp_replace(COALESCE(a."coverLetter",''), '[\r\n]+', ' ', 'g'), 240) letter
       FROM "AutoApplication" a JOIN "User" u ON u.id=a."userId"
       WHERE a.status='SENT' AND a."sentAt" >= $1 AND u."resumeUrl" LIKE '%blob.vercel-storage%'
         AND length(COALESCE(a."coverLetter",'')) > 80
       ORDER BY a."sentAt" DESC LIMIT 10`, since),
  ]);

  return NextResponse.json({ period, gate: gate[0], profDist, sends: sends[0], tags: tags[0], samples });
}
