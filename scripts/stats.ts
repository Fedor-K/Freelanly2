/**
 * Recruiter-demand stats in the terminal — same numbers as /admin/recruiter-funnel, plus a
 * RETURNS metric (do recruiters come back?), the real signal for the portal hypothesis.
 * Read-only.  npx tsx scripts/stats.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const N = (r: Array<{ n: bigint | number }>) => Number(r?.[0]?.n ?? 0);
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—');

async function main() {
  const q = (sql: string) => prisma.$queryRawUnsafe<Array<{ n: number }>>(sql);

  const [
    contacted, opened, replied, registered,
    visited, engaged, revealedRecruiters, revealsTotal, reveals7d, portalReplied, otpLogins,
  ] = await Promise.all([
    q(`SELECT COUNT(DISTINCT lower("appliedToEmail"))::int n FROM "AutoApplication" WHERE "sentAt" IS NOT NULL`),
    q(`SELECT COUNT(DISTINCT lower("appliedToEmail"))::int n FROM "AutoApplication" WHERE "sentAt" IS NOT NULL AND status IN ('OPENED','REPLIED','INTERVIEW','OFFER')`),
    q(`SELECT COUNT(DISTINCT lower("appliedToEmail"))::int n FROM "AutoApplication" WHERE "repliedAt" IS NOT NULL OR status IN ('REPLIED','INTERVIEW','OFFER')`),
    q(`SELECT COUNT(*)::int n FROM "Recruiter"`),
    q(`SELECT COUNT(DISTINCT lower(details->>'recruiterEmail'))::int n FROM "ActivityLog" WHERE action='RECRUITER_PORTAL_VISIT'`),
    q(`SELECT COUNT(DISTINCT lower(details->>'recruiterEmail'))::int n FROM "ActivityLog" WHERE action='RECRUITER_PORTAL_ACTION' AND details->>'event' IN ('view_cv','open_chat','open_profile')`),
    q(`SELECT COUNT(DISTINCT lower("recruiterEmail"))::int n FROM "ContactReveal"`),
    q(`SELECT COUNT(*)::int n FROM "ContactReveal"`),
    q(`SELECT COUNT(*)::int n FROM "ContactReveal" WHERE "revealedAt" >= NOW()-INTERVAL '7 days'`),
    q(`SELECT COUNT(DISTINCT lower(aa."appliedToEmail"))::int n FROM "ActivityLog" al JOIN "AutoApplication" aa ON aa.id=(al.details->>'applicationId') WHERE al.action='RECRUITER_REPLIED' AND al.details->>'source'='recruiter_portal'`),
    q(`SELECT COUNT(*)::int n FROM "ActivityLog" WHERE action='RECRUITER_PORTAL_ACTION' AND details->>'event'='otp_login'`).catch(() => [{ n: 0 }]),
  ]);

  const C = N(contacted), V = N(visited), R = N(replied);
  console.log('\n=== FUNNEL (any channel) ===');
  for (const [l, v] of [['Contacted', C], ['Opened email', N(opened)], ['Replied', R], ['Registered', N(registered)]] as const)
    console.log(`  ${String(l).padEnd(14)} ${String(v).padStart(6)}  ${pct(v, C)}`);

  console.log('\n=== IN THE PORTAL (of visitors) ===');
  for (const [l, v] of [['Visited', V], ['Engaged', N(engaged)], ['Revealed', N(revealedRecruiters)], ['Replied in portal', N(portalReplied)]] as const)
    console.log(`  ${String(l).padEnd(18)} ${String(v).padStart(6)}  ${pct(v, Math.max(V, 1))}`);

  console.log('\n=== REPLY CHANNEL ===');
  console.log(`  Plain email   ${String(R - N(portalReplied)).padStart(6)}  ${pct(R - N(portalReplied), R)}`);
  console.log(`  In portal     ${String(N(portalReplied)).padStart(6)}  ${pct(N(portalReplied), R)}`);

  console.log('\n=== REVEALS ===');
  console.log(`  Total ${N(revealsTotal)} (7d: ${N(reveals7d)}) · recruiters who revealed: ${N(revealedRecruiters)}`);

  // RETURNS — the portal-hypothesis signal. A "return" = a recruiter who visited the portal on
  // 2+ distinct days (any entry path: email link or OTP login). Counts distinct visit-days/email.
  const returns = await prisma.$queryRawUnsafe<Array<{ email: string; days: number; first: string; last: string }>>(`
    SELECT lower(details->>'recruiterEmail') email,
           COUNT(DISTINCT date_trunc('day', "createdAt"))::int days,
           MIN("createdAt")::text first, MAX("createdAt")::text last
    FROM "ActivityLog"
    WHERE action='RECRUITER_PORTAL_VISIT' AND details->>'recruiterEmail' IS NOT NULL
    GROUP BY 1 HAVING COUNT(DISTINCT date_trunc('day', "createdAt")) >= 2
    ORDER BY days DESC LIMIT 20`);

  console.log('\n=== RETURNS (visited on 2+ different days) ===');
  console.log(`  Returning recruiters: ${returns.length}  ·  of ${V} visitors = ${pct(returns.length, V)}`);
  console.log(`  OTP logins so far: ${N(otpLogins)}`);
  for (const r of returns.slice(0, 10))
    console.log(`    ${r.email.padEnd(34)} ${r.days} days  (${r.first.slice(0, 10)} → ${r.last.slice(0, 10)})`);
  console.log('');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
