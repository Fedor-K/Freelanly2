/**
 * CANONICAL METRICS — the single source of truth for "какая стата".
 *
 * Why this file exists: the same question kept getting different answers because every analysis
 * re-invented its own SQL — different windows, different payer definitions, summing overlapping
 * per-query numbers instead of counting distinct rows, and comparing User.roleFamily against
 * Opportunity.roleFamily as if they were one axis. Numbers must come from here, not from ad-hoc
 * queries, so two sessions asking the same thing get the same answer.
 *
 * Usage:
 *   npm run metrics              # today + yesterday (MSK), the default "какая стата" answer
 *   npm run metrics -- funnel    # payment funnel with denominators
 *   npm run metrics -- supply    # supply bought vs actually consumed
 *   npm run metrics -- roles     # demand vs supply per direction (the mis-allocation view)
 *   npm run metrics -- all       # everything
 *
 * DEFINITIONS (fixed — change here, never inline):
 *  · MSK day  = createdAt >= 'YYYY-MM-DD 21:00' UTC of the previous date. Timestamps are naive-UTC.
 *  · payer    = a user with FUNNEL_STEP credit_charge_success OR a RevenueEvent
 *               (SUBSCRIPTION_STARTED | ONE_TIME_PAYMENT). Both, always — neither alone is complete.
 *  · send     = AutoApplication with origin='SELF' AND sentAt IS NOT NULL. AUTO rows are matcher
 *               bookkeeping, not user action; REVIEW/SKIPPED rows are not sends either.
 *  · wall     = FUNNEL_STEP application_paywall_shown (carries details->>'opportunityId').
 *  · pay-click= FUNNEL_STEP credit_charge_click OR pro5_inline_click. NOTE: credit_charge_* only
 *               exists since 2026-07-23 and pro5_inline_click since 2026-08-01 — never compare
 *               across those dates without saying so.
 *  · supply   = Opportunity rows created in the window WITH applyEmail (rows without it can't be
 *               applied to). Count DISTINCT rows in the DB — never sum per-query scrape counts,
 *               they double-count posts found by several queries.
 *  · active   = distinct ActivityLog.userId in the window.
 *
 * TRAPS this file encodes (learned the hard way):
 *  · User.roleFamily (who the user is) ≠ Opportunity.roleFamily (what the role is). Never mix.
 *  · Opportunity.roleFamily taxonomy CHANGED on 2026-07-29 (devops label disappeared) — role-family
 *    series that cross that date are not comparable. See ROLE_TAXONOMY_BREAK below.
 *  · Reply metrics are blind for own-inbox users (Gmail/SMTP connected): recruiters reply straight
 *    to them, so repliedAt is structurally null. Never report reply-rate without that caveat.
 *  · Email opens are pixel-based and inflated by Apple/Gmail prefetch — not reported here on purpose.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Opportunity.roleFamily means different things before/after this date (classifier swap). */
const ROLE_TAXONOMY_BREAK = '2026-07-29';

const PAYERS = `
  SELECT DISTINCT "userId" AS uid FROM "ActivityLog"
   WHERE action='FUNNEL_STEP' AND details->>'step'='credit_charge_success' AND "userId" IS NOT NULL
  UNION
  SELECT DISTINCT "userId" FROM "RevenueEvent"
   WHERE type IN ('SUBSCRIPTION_STARTED','ONE_TIME_PAYMENT') AND "userId" IS NOT NULL`;

const n = (v: unknown) => Number(v ?? 0);
const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : '—');

/** Start of an MSK day, as the naive-UTC string the DB stores. offset 0 = today, 1 = yesterday. */
function mskDayStart(offset = 0): string {
  const now = new Date();
  const msk = new Date(now.getTime() + 3 * 3600_000);
  const d = new Date(Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate() - offset));
  return new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');
}

async function q<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  return prisma.$queryRawUnsafe<T[]>(sql);
}

/** today-so-far vs the full previous MSK day — the standard answer to "какая стата". */
async function today() {
  const T = `'${mskDayStart(0)}'`;
  const Y = `'${mskDayStart(1)}'`;
  const nowMsk = (await q<{ t: string }>(`SELECT to_char(now() AT TIME ZONE 'Europe/Moscow','YYYY-MM-DD (Dy) HH24:MI') t`))[0].t;
  console.log(`\n=== СЕГОДНЯ (${nowMsk} MSK, с 00:00) vs ВЧЕРА (полный день) ===`);

  const pair = async (label: string, sql: (from: string, to: string) => string) => {
    const t = n((await q<{ n: bigint }>(sql(T, 'now()')))[0]?.n);
    const y = n((await q<{ n: bigint }>(sql(Y, T)))[0]?.n);
    console.log(`  ${label.padEnd(26)} сегодня ${String(t).padStart(5)} | вчера ${String(y).padStart(5)}`);
  };

  await pair('регистрации', (f, t) => `SELECT count(*)::int n FROM "User" WHERE "createdAt">=${f} AND "createdAt"<${t}`);
  await pair('активные юзеры', (f, t) => `SELECT count(DISTINCT "userId")::int n FROM "ActivityLog" WHERE "userId" IS NOT NULL AND "createdAt">=${f} AND "createdAt"<${t}`);
  await pair('клики Apply', (f, t) => `SELECT count(*)::int n FROM "ActivityLog" WHERE action='OPPORTUNITY_APPLY_CLICK' AND "createdAt">=${f} AND "createdAt"<${t}`);
  await pair('отправки (SELF, sent)', (f, t) => `SELECT count(*)::int n FROM "AutoApplication" WHERE origin='SELF' AND "sentAt" IS NOT NULL AND "createdAt">=${f} AND "createdAt"<${t}`);
  await pair('стена показана', (f, t) => `SELECT count(*)::int n FROM "ActivityLog" WHERE action='FUNNEL_STEP' AND details->>'step'='application_paywall_shown' AND "createdAt">=${f} AND "createdAt"<${t}`);
  await pair('клики оплаты', (f, t) => `SELECT count(*)::int n FROM "ActivityLog" WHERE action='FUNNEL_STEP' AND details->>'step' IN ('credit_charge_click','pro5_inline_click') AND "createdAt">=${f} AND "createdAt"<${t}`);
  await pair('оплаты (RevenueEvent)', (f, t) => `SELECT count(*)::int n FROM "RevenueEvent" WHERE "createdAt">=${f} AND "createdAt"<${t}`);
  await pair('выручка, центов', (f, t) => `SELECT COALESCE(sum(amount),0)::int n FROM "RevenueEvent" WHERE "createdAt">=${f} AND "createdAt"<${t}`);
  await pair('вакансий заведено', (f, t) => `SELECT count(*)::int n FROM "Opportunity" WHERE "createdAt">=${f} AND "createdAt"<${t}`);
}

/** Payment funnel with explicit denominators at every step. */
async function funnel(days = 14) {
  const W = `now()-interval '${days} days'`;
  console.log(`\n=== ВОРОНКА ОПЛАТЫ (${days} дней, по юзерам) ===`);
  const r = (await q<Record<string, bigint>>(`
    SELECT
     (SELECT count(DISTINCT "userId") FROM "ActivityLog" WHERE action='FUNNEL_STEP' AND details->>'step'='application_paywall_shown' AND "createdAt">=${W})::int wall,
     (SELECT count(DISTINCT "userId") FROM "ActivityLog" WHERE action='FUNNEL_STEP' AND details->>'step' IN ('credit_charge_click','pro5_inline_click') AND "createdAt">=${W})::int click,
     (SELECT count(DISTINCT "userId") FROM "ActivityLog" WHERE action='FUNNEL_STEP' AND details->>'step'='credit_charge_form_ready' AND "createdAt">=${W})::int form,
     (SELECT count(DISTINCT "userId") FROM "ActivityLog" WHERE action='FUNNEL_STEP' AND details->>'step'='credit_charge_submit' AND "createdAt">=${W})::int submit,
     (SELECT count(DISTINCT "userId") FROM "ActivityLog" WHERE action='FUNNEL_STEP' AND details->>'step'='credit_charge_success' AND "createdAt">=${W})::int success`))[0];
  const wall = n(r.wall), click = n(r.click), form = n(r.form), submit = n(r.submit), success = n(r.success);
  console.log(`  упёрлись в стену      ${String(wall).padStart(5)}   (100%)`);
  console.log(`  нажали оплатить       ${String(click).padStart(5)}   ${pct(click, wall)} от стены`);
  console.log(`  форма карты открылась ${String(form).padStart(5)}   ${pct(form, click)} от кликнувших`);
  console.log(`  нажали «оплатить»     ${String(submit).padStart(5)}   ${pct(submit, form)} от открывших форму  ← главная утечка`);
  console.log(`  оплата прошла         ${String(success).padStart(5)}   ${pct(success, submit)} от отправивших`);
  console.log('  ⚠ credit_charge_* существует с 2026-07-23, pro5_inline_click — с 2026-08-01: окна раньше этих дат несравнимы.');

  const rev = (await q<Record<string, bigint>>(`
    SELECT count(*)::int cnt, COALESCE(sum(amount),0)::int cents,
      count(*) FILTER (WHERE type='SUBSCRIPTION_STARTED')::int subs,
      count(*) FILTER (WHERE type='ONE_TIME_PAYMENT')::int once
    FROM "RevenueEvent" WHERE "createdAt">=${W}`))[0];
  console.log(`  выручка за период: $${(n(rev.cents) / 100).toFixed(2)} (${n(rev.cnt)} платежей: подписок ${n(rev.subs)}, разовых ${n(rev.once)})`);
}

/** Supply bought vs supply actually consumed. Distinct DB rows only — never per-query sums. */
async function supply(days = 7) {
  const W = `now()-interval '${days} days'`;
  console.log(`\n=== SUPPLY: КУПЛЕНО vs ИСПОЛЬЗОВАНО (${days} дней) ===`);
  const r = (await q<Record<string, bigint>>(`
    SELECT
     (SELECT count(*) FROM "Opportunity" WHERE "createdAt">=${W})::int total,
     (SELECT count(*) FROM "Opportunity" WHERE "createdAt">=${W} AND "applyEmail" IS NOT NULL)::int contactable,
     (SELECT count(DISTINCT o.id) FROM "Opportunity" o JOIN "ActivityLog" l
        ON (l.details->>'opportunityId'=o.id OR l.details->>'projectId'=o.id)
       WHERE o."createdAt">=${W} AND o."applyEmail" IS NOT NULL AND l.action='OPPORTUNITY_APPLY_CLICK' AND l."userId" IS NOT NULL)::int clicked,
     (SELECT count(DISTINCT a."opportunityId") FROM "AutoApplication" a JOIN "Opportunity" o ON o.id=a."opportunityId"
       WHERE o."createdAt">=${W} AND o."applyEmail" IS NOT NULL AND a.origin='SELF' AND a."sentAt" IS NOT NULL)::int sent`))[0];
  const c = n(r.contactable), clicked = n(r.clicked), sent = n(r.sent);
  console.log(`  заведено вакансий:        ${n(r.total)}`);
  console.log(`  из них с контактом:       ${c}  ← это и есть закупка, которую считаем`);
  console.log(`  кликнул залогиненный:     ${clicked}  (${pct(clicked, c)})`);
  console.log(`  отправлен отклик:         ${sent}  (${pct(sent, c)})`);
  console.log(`  никем не тронуто:         ${c - clicked}  (${pct(c - clicked, c)})`);

  const consumers = (await q<{ n: bigint }>(`SELECT count(DISTINCT "userId")::int n FROM "AutoApplication" WHERE origin='SELF' AND "sentAt" IS NOT NULL AND "createdAt">=${W}`))[0];
  console.log(`  отправителей за период:   ${n(consumers.n)} → в среднем ${(sent / Math.max(n(consumers.n), 1)).toFixed(1)} вакансий на отправителя`);
}

/** Demand (users) vs supply (opportunities) per direction — the mis-allocation view. */
async function roles(days = 7) {
  console.log(`\n=== СПРОС vs ЗАКУПКА ПО НАПРАВЛЕНИЯМ (${days} дней) ===`);
  console.log(`  ⚠ Opportunity.roleFamily сменил таксономию ${ROLE_TAXONOMY_BREAK} — окна, пересекающие эту дату, несравнимы.`);
  console.log('  ⚠ User.roleFamily (кто юзер) и Opportunity.roleFamily (что за роль) — РАЗНЫЕ оси, не путать.');
  const rows = await q<Record<string, string | bigint>>(`
    WITH payers AS (${PAYERS}),
    demand AS (
      SELECT u."roleFamily" rf, count(DISTINCT u.id)::int users,
             count(DISTINCT u.id) FILTER (WHERE p.uid IS NOT NULL)::int payers
        FROM "User" u
        JOIN "ActivityLog" l ON l."userId"=u.id AND l."createdAt">=now()-interval '14 days'
        LEFT JOIN payers p ON p.uid=u.id
       GROUP BY 1),
    sup AS (
      SELECT "roleFamily" rf, count(*)::int supply
        FROM "Opportunity"
       WHERE "createdAt">=now()-interval '${days} days' AND "applyEmail" IS NOT NULL
       GROUP BY 1)
    SELECT COALESCE(demand.rf, sup.rf) rf,
           COALESCE(demand.users,0)::int users,
           COALESCE(demand.payers,0)::int payers,
           COALESCE(sup.supply,0)::int supply
      FROM demand FULL OUTER JOIN sup ON demand.rf=sup.rf
     WHERE COALESCE(demand.users,0)>20 OR COALESCE(sup.supply,0)>50
     ORDER BY COALESCE(demand.users,0) DESC`);
  console.log('  направление        | активных | платящих | закупка | вакансий/юзера');
  for (const r of rows) {
    const users = n(r.users), sup = n(r.supply);
    const ratio = users ? (sup / users).toFixed(1) : '—';
    const flag = users && sup > 5 * users ? ' ← перекуп' : users && !sup ? ' ← нет закупки' : users && sup < users ? ' ← дефицит' : '';
    console.log(`  ${String(r.rf ?? '?').padEnd(18)} | ${String(users).padStart(8)} | ${String(n(r.payers)).padStart(8)} | ${String(sup).padStart(7)} | ${String(ratio).padStart(14)}${flag}`);
  }
}

/**
 * Apify spend joined to what it bought. Cost lives in Apify, value lives in our DB — reporting one
 * without the other is how "$0.002 per post" got mistaken for cheap while the cost per SENT
 * opportunity was two orders of magnitude higher. Needs APIFY_API_TOKEN.
 *
 * Billing model (verified 2026-08-05): PAY_PER_EVENT — we are charged per RETURNED POST, with no
 * discount for posts we already have. So re-scanning the same 24h window is paid duplication, and
 * cutting a search query only saves the posts NO other query finds.
 *
 * Where the search bill goes (87,910 posts, 8d to 2026-08-05): 34% genuinely new, 25% a repeat of
 * what THE SAME query already returned (the actor input pins postedLimit="24h" while Spheres cycles
 * its 49 queries every 12.2h), 41% a post ANOTHER query already bought. The 24h tail is not free to
 * trim: posts aged 13-24h are still ~10% new, because the previous run hit the 1-page cap.
 * The profile scraper's only live function is the openToWork gate — POSTER_COUNTRY_BLOCK has been
 * off since June (zero poster_region skips in 8d), and a headline regex can't replace it (3% recall).
 */
async function apify(days = 7) {
  const token = (process.env.APIFY_API_TOKEN || '').trim();
  console.log(`\n=== APIFY: РАСХОД vs ЧТО КУПИЛИ (${days} дней) ===`);
  if (!token) {
    console.log('  APIFY_API_TOKEN не задан — экспорти его или запусти с .env.prod-pull');
    return;
  }
  // NB: pagination must go deep — profile-scraper alone does ~8k runs/week; a 6k cap silently
  // understated the bill by ~35% (reported $448/mo when the real rate was $706/mo).
  const runs: Array<{ actId: string; startedAt: string; usageTotalUsd?: number }> = [];
  for (let offset = 0; offset < 40000; offset += 1000) {
    const page = await fetch(`https://api.apify.com/v2/actor-runs?token=${token}&desc=1&limit=1000&offset=${offset}`)
      .then((r) => r.json()).catch(() => null);
    const items = page?.data?.items ?? [];
    runs.push(...items);
    const oldest = items[items.length - 1]?.startedAt;
    if (items.length < 1000 || !oldest || new Date(oldest).getTime() < Date.now() - days * 86400_000) break;
  }
  const since = Date.now() - days * 86400_000;
  const win = runs.filter((r) => new Date(r.startedAt).getTime() >= since);
  const byActor: Record<string, { runs: number; usd: number }> = {};
  for (const r of win) {
    const k = r.actId;
    byActor[k] = byActor[k] || { runs: 0, usd: 0 };
    byActor[k].runs++;
    byActor[k].usd += r.usageTotalUsd || 0;
  }
  const names: Record<string, string> = {
    buIWk2uOUzTmcLsuB: 'linkedin-post-search (поиск вакансий)',
    LpVuK3Zozwuipa5bp: 'linkedin-profile-scraper (профили авторов)',
  };
  let total = 0;
  for (const [id, v] of Object.entries(byActor).sort((a, b) => b[1].usd - a[1].usd)) {
    total += v.usd;
    console.log(`  ${(names[id] || id).padEnd(42)} ${String(v.runs).padStart(5)} прогонов  $${v.usd.toFixed(2)}`);
  }
  const perDay = total / days;
  console.log(`  ИТОГО: $${total.toFixed(2)} за ${days}д → $${perDay.toFixed(2)}/сутки → $${(perDay * 30).toFixed(0)}/мес (план SCALE $199 + овередж сверху)`);

  const W = `now()-interval '${days} days'`;
  const v = (await q<Record<string, bigint>>(`
    SELECT
     (SELECT count(*) FROM "Opportunity" WHERE "createdAt">=${W} AND "applyEmail" IS NOT NULL)::int contactable,
     (SELECT count(DISTINCT o.id) FROM "Opportunity" o JOIN "ActivityLog" l
        ON (l.details->>'opportunityId'=o.id OR l.details->>'projectId'=o.id)
       WHERE o."createdAt">=${W} AND o."applyEmail" IS NOT NULL AND l.action='OPPORTUNITY_APPLY_CLICK' AND l."userId" IS NOT NULL)::int clicked,
     (SELECT count(DISTINCT a."opportunityId") FROM "AutoApplication" a JOIN "Opportunity" o ON o.id=a."opportunityId"
       WHERE o."createdAt">=${W} AND o."applyEmail" IS NOT NULL AND a.origin='SELF' AND a."sentAt" IS NOT NULL)::int sent`))[0];
  const c = n(v.contactable), clicked = n(v.clicked), sent = n(v.sent);
  console.log(`  куплено вакансий с контактом: ${c} → $${(total / Math.max(c, 1)).toFixed(3)} за штуку`);
  console.log(`  из них кто-то открыл:         ${clicked} (${pct(clicked, c)}) → $${(total / Math.max(clicked, 1)).toFixed(2)} за открытую`);
  console.log(`  из них отправлен отклик:      ${sent} (${pct(sent, c)}) → $${(total / Math.max(sent, 1)).toFixed(2)} ЗА РЕАЛЬНО ИСПОЛЬЗОВАННУЮ`);

  const rev = n((await q<{ n: bigint }>(`SELECT COALESCE(sum(amount),0)::int n FROM "RevenueEvent" WHERE "createdAt">=${W}`))[0].n) / 100;
  console.log(`  выручка за тот же период: $${rev.toFixed(2)} → расход на скрап / выручка = ${rev ? (total / rev).toFixed(1) + 'x' : '∞'}`);

  const skips = await q<{ r: string; n: bigint }>(`
    SELECT details->>'reason' r, count(*)::int n FROM "ActivityLog"
     WHERE action='IMPORT_SKIP' AND "createdAt">=${W} GROUP BY 1 ORDER BY 2 DESC LIMIT 5`);
  const skipTotal = skips.reduce((s, x) => s + n(x.n), 0);
  console.log(`  отбраковано при импорте: ${skipTotal} (${skips.map((x) => `${x.r} ${n(x.n)}`).join(', ')})`);
}

async function main() {
  const arg = (process.argv[2] || 'today').toLowerCase();
  try {
    if (arg === 'today' || arg === 'all') await today();
    if (arg === 'funnel' || arg === 'all') await funnel();
    if (arg === 'supply' || arg === 'all') await supply();
    if (arg === 'roles' || arg === 'all') await roles();
    if (arg === 'apify' || arg === 'all') await apify();
    if (!['today', 'funnel', 'supply', 'roles', 'apify', 'all'].includes(arg)) {
      console.log('Использование: npm run metrics -- [today|funnel|supply|roles|apify|all]');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
