/**
 * Whole-project snapshot — users, growth, auto-apply pipeline, replies, revenue, recruiter side.
 * Read-only. Run where DB is reachable:  npx tsx scripts/overview.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const N = (r: Array<{ n: bigint | number }>) => Number(r?.[0]?.n ?? 0);
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 1000) / 10}%` : '—');
const money = (cents: number, cur = 'USD') => `${cur} ${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

async function main() {
  const q = (sql: string) => prisma.$queryRawUnsafe<Array<{ n: number }>>(sql);

  // ---- Users ----
  const [users, usersPro, users7d, users30d, activated, activeLoops] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { plan: { in: ['PRO', 'ENTERPRISE'] } } }),
    prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 864e5) } } }),
    prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 864e5) } } }),
    prisma.user.count({ where: { activatedAt: { not: null } } }),
    prisma.autoApplyLoop.count({ where: { isActive: true } }),
  ]);

  console.log('\n=== USERS ===');
  console.log(`  Total users          ${users.toLocaleString()}`);
  console.log(`  PRO / ENTERPRISE     ${usersPro.toLocaleString()}  (${pct(usersPro, users)})`);
  console.log(`  New (7d / 30d)       ${users7d.toLocaleString()} / ${users30d.toLocaleString()}`);
  console.log(`  Activated (sent ≥1)  ${activated.toLocaleString()}  (${pct(activated, users)})`);
  console.log(`  Active auto-apply loops  ${activeLoops.toLocaleString()}`);

  // ---- Auto-apply pipeline ----
  const byStatus = await prisma.autoApplication.groupBy({ by: ['status'], _count: { _all: true } });
  const stat = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  const totalApps = byStatus.reduce((a, b) => a + b._count._all, 0);
  const sent = stat('SENT') + stat('DELIVERED') + stat('OPENED') + stat('REPLIED') + stat('INTERVIEW') + stat('OFFER');
  const opened = stat('OPENED') + stat('REPLIED') + stat('INTERVIEW') + stat('OFFER');
  const replied = stat('REPLIED') + stat('INTERVIEW') + stat('OFFER');
  const [sent24h, sent7d] = [
    N(await q(`SELECT COUNT(*)::int n FROM "AutoApplication" WHERE "sentAt">=NOW()-INTERVAL '24 hours'`)),
    N(await q(`SELECT COUNT(*)::int n FROM "AutoApplication" WHERE "sentAt">=NOW()-INTERVAL '7 days'`)),
  ];

  console.log('\n=== AUTO-APPLY PIPELINE (all time) ===');
  console.log(`  Applications total   ${totalApps.toLocaleString()}`);
  console.log(`  Sent                 ${sent.toLocaleString()}`);
  console.log(`  Opened               ${opened.toLocaleString()}  (${pct(opened, sent)} of sent)`);
  console.log(`  Replied              ${replied.toLocaleString()}  (${pct(replied, sent)} reply rate)`);
  console.log(`  Interview / Offer    ${stat('INTERVIEW').toLocaleString()} / ${stat('OFFER').toLocaleString()}`);
  console.log(`  Pending / Failed     ${stat('PENDING').toLocaleString()} / ${stat('FAILED').toLocaleString()}`);
  console.log(`  Sent last 24h / 7d   ${sent24h.toLocaleString()} / ${sent7d.toLocaleString()}`);

  // ---- Content corpus ----
  const [opps, opps7d, companies, jobs] = await Promise.all([
    prisma.opportunity.count(),
    prisma.opportunity.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 864e5) } } }),
    prisma.company.count(),
    prisma.job.count().catch(() => 0),
  ]);
  console.log('\n=== CONTENT ===');
  console.log(`  Opportunities        ${opps.toLocaleString()}  (last 7d: ${opps7d.toLocaleString()})`);
  console.log(`  Jobs (ATS)           ${jobs.toLocaleString()}`);
  console.log(`  Companies            ${companies.toLocaleString()}`);

  // ---- Revenue ----
  try {
    // Inflows minus refunds. RevenueEventType has no "paid" event — these are the real members.
    const INFLOW = `'SUBSCRIPTION_STARTED','SUBSCRIPTION_RENEWED','SUBSCRIPTION_UPGRADED','ONE_TIME_PAYMENT'`;
    const rev = await prisma.$queryRawUnsafe<Array<{ cur: string; cents: number; cnt: number }>>(`
      SELECT currency cur,
        SUM(CASE WHEN type='REFUND' THEN -amount ELSE amount END)::bigint cents,
        COUNT(*)::int cnt
      FROM "RevenueEvent" WHERE type IN (${INFLOW},'REFUND') GROUP BY currency`);
    const rev30 = await prisma.$queryRawUnsafe<Array<{ cents: number }>>(`
      SELECT COALESCE(SUM(CASE WHEN type='REFUND' THEN -amount ELSE amount END),0)::bigint cents
      FROM "RevenueEvent" WHERE "createdAt">=NOW()-INTERVAL '30 days' AND type IN (${INFLOW},'REFUND')`);
    console.log('\n=== REVENUE (RevenueEvent, net of refunds) ===');
    if (rev.length === 0) console.log('  No revenue events recorded.');
    for (const r of rev) console.log(`  All-time (${r.cur})     ${money(Number(r.cents), r.cur)}  over ${r.cnt} events`);
    console.log(`  Last 30 days         ${money(Number(rev30[0]?.cents || 0))}`);
  } catch (e) {
    console.log('\n=== REVENUE ===\n  (RevenueEvent query failed: ' + (e as Error).message.split('\n')[0] + ')');
  }

  // ---- Recruiter side (the new surface) ----
  const [recruiters, reveals, otp] = await Promise.all([
    prisma.recruiter.count(),
    prisma.contactReveal.count().catch(() => 0),
    N(await q(`SELECT COUNT(*)::int n FROM "ActivityLog" WHERE action='RECRUITER_PORTAL_ACTION' AND details->>'event'='otp_login'`).catch(() => [{ n: 0 }])),
  ]);
  const recruiterInboxes = N(await q(`SELECT COUNT(DISTINCT lower("appliedToEmail"))::int n FROM "AutoApplication" WHERE "sentAt" IS NOT NULL`));
  console.log('\n=== RECRUITER SIDE ===');
  console.log(`  Distinct recruiter inboxes contacted  ${recruiterInboxes.toLocaleString()}`);
  console.log(`  Registered recruiters                 ${recruiters.toLocaleString()}`);
  console.log(`  Contact reveals                       ${reveals.toLocaleString()}`);
  console.log(`  OTP logins                            ${otp.toLocaleString()}`);
  console.log('');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
