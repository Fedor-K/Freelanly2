import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function retry(fn, attempts = 4, delayMs = 1500) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === attempts - 1) throw e;
      console.error(`  Attempt ${i + 1} failed: ${e.message}. Retrying in ${delayMs}ms...`);
      await new Promise(r => setTimeout(r, delayMs));
      delayMs = Math.round(delayMs * 1.5);
    }
  }
}

async function main() {
  console.log('=== LEVER #1 READOUT — 2026-06-10 ===\n');

  // ── Q1: Total nudges sent (ok=true), distinct recruiters, failures ────────
  const [q1ok] = await retry(() => db.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS total_ok,
           COUNT(DISTINCT details->>'recruiterEmail')::int AS distinct_recruiters
    FROM "ActivityLog"
    WHERE action = 'RECRUITER_PORTAL_NUDGE_SENT'
      AND "createdAt" > '2026-06-08 21:43:00'
      AND details->>'ok' = 'true'
      AND details->>'recruiterEmail' IS DISTINCT FROM 'info@freelanly.com'
  `));

  const q1fail = await retry(() => db.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS total_fail,
           details->>'err' AS err,
           COUNT(*)::int AS cnt
    FROM "ActivityLog"
    WHERE action = 'RECRUITER_PORTAL_NUDGE_SENT'
      AND "createdAt" > '2026-06-08 21:43:00'
      AND details->>'ok' = 'false'
      AND details->>'recruiterEmail' IS DISTINCT FROM 'info@freelanly.com'
    GROUP BY details->>'err'
    ORDER BY cnt DESC
  `));

  console.log('── Q1: Nudge delivery ──────────────────────────────────────');
  console.log(`  Successful nudges (ok=true): ${q1ok.total_ok}`);
  console.log(`  Distinct recruiter emails nudged: ${q1ok.distinct_recruiters}`);
  if (q1fail.length === 0) {
    console.log('  Failed nudges (ok=false): 0');
  } else {
    const totalFail = q1fail.reduce((s, r) => s + r.cnt, 0);
    console.log(`  Failed nudges (ok=false): ${totalFail}`);
    for (const r of q1fail) {
      console.log(`    err="${r.err ?? 'null'}": ${r.cnt}`);
    }
  }

  // ── Q2: Plural (n>1) vs singular (n=1) branch ────────────────────────────
  const q2 = await retry(() => db.$queryRawUnsafe(`
    SELECT
      SUM(CASE WHEN (details->>'candidateCount')::int > 1 THEN 1 ELSE 0 END)::int AS plural,
      SUM(CASE WHEN (details->>'candidateCount')::int = 1 THEN 1 ELSE 0 END)::int AS singular,
      SUM(CASE WHEN details->>'candidateCount' IS NULL THEN 1 ELSE 0 END)::int AS no_candidate_count
    FROM "ActivityLog"
    WHERE action = 'RECRUITER_PORTAL_NUDGE_SENT'
      AND "createdAt" > '2026-06-08 21:43:00'
      AND details->>'ok' = 'true'
      AND details->>'recruiterEmail' IS DISTINCT FROM 'info@freelanly.com'
  `));

  console.log('\n── Q2: Singular vs plural branch ───────────────────────────');
  console.log(`  Plural branch (candidateCount > 1): ${q2[0].plural}`);
  console.log(`  Singular branch (candidateCount = 1): ${q2[0].singular}`);
  console.log(`  No candidateCount field: ${q2[0].no_candidate_count}`);

  // ── Q3: Nudge → portal-visit conversion ──────────────────────────────────
  // For each distinct recruiter nudged, find earliest nudge time, then check
  // if there's a RECRUITER_PORTAL_VISIT after that time.
  const [q3] = await retry(() => db.$queryRawUnsafe(`
    WITH nudged AS (
      SELECT
        details->>'recruiterEmail' AS recruiter_email,
        MIN("createdAt") AS first_nudge_at
      FROM "ActivityLog"
      WHERE action = 'RECRUITER_PORTAL_NUDGE_SENT'
        AND "createdAt" > '2026-06-08 21:43:00'
        AND details->>'ok' = 'true'
        AND details->>'recruiterEmail' IS DISTINCT FROM 'info@freelanly.com'
      GROUP BY details->>'recruiterEmail'
    ),
    visits AS (
      SELECT DISTINCT
        details->>'recruiterEmail' AS recruiter_email,
        MIN("createdAt") AS first_visit_at
      FROM "ActivityLog"
      WHERE action = 'RECRUITER_PORTAL_VISIT'
        AND details->>'recruiterEmail' IS DISTINCT FROM 'info@freelanly.com'
      GROUP BY details->>'recruiterEmail'
    )
    SELECT
      COUNT(n.recruiter_email)::int AS total_nudged,
      COUNT(v.recruiter_email)::int AS converted,
      ROUND(
        COUNT(v.recruiter_email)::numeric * 100.0 / NULLIF(COUNT(n.recruiter_email), 0),
        1
      ) AS pct
    FROM nudged n
    LEFT JOIN visits v
      ON lower(n.recruiter_email) = lower(v.recruiter_email)
      AND v.first_visit_at > n.first_nudge_at
  `));

  console.log('\n── Q3: Nudge → portal-visit conversion ─────────────────────');
  console.log(`  Distinct recruiters nudged: ${q3.total_nudged}`);
  console.log(`  Converted (portal visit after nudge): ${q3.converted}`);
  console.log(`  Conversion rate: ${q3.pct ?? 0}%`);

  // ── Q4: Registration or ContactReveal after nudge ─────────────────────────
  const [q4reg] = await retry(() => db.$queryRawUnsafe(`
    WITH nudged AS (
      SELECT
        details->>'recruiterEmail' AS recruiter_email,
        MIN("createdAt") AS first_nudge_at
      FROM "ActivityLog"
      WHERE action = 'RECRUITER_PORTAL_NUDGE_SENT'
        AND "createdAt" > '2026-06-08 21:43:00'
        AND details->>'ok' = 'true'
        AND details->>'recruiterEmail' IS DISTINCT FROM 'info@freelanly.com'
      GROUP BY details->>'recruiterEmail'
    )
    SELECT COUNT(DISTINCT n.recruiter_email)::int AS registered_after_nudge
    FROM nudged n
    JOIN "Recruiter" r
      ON lower(r.email) = lower(n.recruiter_email)
      AND r."registeredAt" > n.first_nudge_at
  `));

  const [q4reveal] = await retry(() => db.$queryRawUnsafe(`
    WITH nudged AS (
      SELECT
        details->>'recruiterEmail' AS recruiter_email,
        MIN("createdAt") AS first_nudge_at
      FROM "ActivityLog"
      WHERE action = 'RECRUITER_PORTAL_NUDGE_SENT'
        AND "createdAt" > '2026-06-08 21:43:00'
        AND details->>'ok' = 'true'
        AND details->>'recruiterEmail' IS DISTINCT FROM 'info@freelanly.com'
      GROUP BY details->>'recruiterEmail'
    )
    SELECT COUNT(DISTINCT n.recruiter_email)::int AS revealed_after_nudge
    FROM nudged n
    JOIN "ActivityLog" al
      ON lower(al.details->>'recruiterEmail') = lower(n.recruiter_email)
      AND al.action = 'CONTACT_REVEAL'
      AND al."createdAt" > n.first_nudge_at
  `));

  console.log('\n── Q4: Registration or ContactReveal after nudge ────────────');
  console.log(`  Nudged recruiters who registered after nudge: ${q4reg.registered_after_nudge}`);
  console.log(`  Nudged recruiters with ContactReveal after nudge: ${q4reveal.revealed_after_nudge}`);

  // ── Q5: All-time application-email → portal-visit baseline ───────────────
  const [q5] = await retry(() => db.$queryRawUnsafe(`
    SELECT
      (SELECT COUNT(DISTINCT lower(details->>'recruiterEmail'))::int
       FROM "ActivityLog"
       WHERE action = 'RECRUITER_PORTAL_VISIT') AS total_portal_visits,
      (SELECT COUNT(DISTINCT lower("appliedToEmail"))::int
       FROM "AutoApplication"
       WHERE "sentAt" IS NOT NULL) AS total_apps_with_email,
      ROUND(
        (SELECT COUNT(DISTINCT lower(details->>'recruiterEmail'))::int
         FROM "ActivityLog"
         WHERE action = 'RECRUITER_PORTAL_VISIT')::numeric * 100.0 /
        NULLIF(
          (SELECT COUNT(DISTINCT lower("appliedToEmail"))::int
           FROM "AutoApplication"
           WHERE "sentAt" IS NOT NULL),
          0
        ),
        2
      ) AS baseline_pct
  `));

  console.log('\n── Q5: All-time cold-email → portal-visit baseline ──────────');
  console.log(`  Distinct portal-visit recruiter emails (all-time): ${q5.total_portal_visits}`);
  console.log(`  Distinct applied-to emails with sentAt (all-time): ${q5.total_apps_with_email}`);
  console.log(`  Baseline conversion rate: ${q5.baseline_pct}%  (prev: ~3.40%)`);

  // ── Summary table ─────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('SUMMARY TABLE');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`Metric                                          Value`);
  console.log(`────────────────────────────────────────────────────────────`);
  console.log(`Total nudges sent (ok=true)                     ${q1ok.total_ok}`);
  console.log(`Distinct recruiters nudged                      ${q1ok.distinct_recruiters}`);
  console.log(`Failed nudges (ok=false)                        ${q1fail.reduce((s,r)=>s+r.cnt,0)}`);
  console.log(`Plural branch (n>1 candidates)                  ${q2[0].plural}`);
  console.log(`Singular branch (n=1 candidate)                 ${q2[0].singular}`);
  console.log(`Nudge → portal-visit conversions                ${q3.converted} / ${q3.total_nudged} = ${q3.pct ?? 0}%`);
  console.log(`Registrations after nudge                       ${q4reg.registered_after_nudge}`);
  console.log(`ContactReveals after nudge                      ${q4reveal.revealed_after_nudge}`);
  console.log(`All-time cold-email baseline                    ${q5.total_portal_visits} / ${q5.total_apps_with_email} = ${q5.baseline_pct}%`);
  console.log('════════════════════════════════════════════════════════════\n');

  const nudgePct = parseFloat(q3.pct ?? 0);
  const baselinePct = parseFloat(q5.baseline_pct ?? 0);
  const totalNudged = q3.total_nudged;

  console.log('VERDICT');
  console.log('────────────────────────────────────────────────────────────');
  if (totalNudged < 20) {
    console.log(
      `Sample is too small (${totalNudged} recruiters nudged) for a statistically ` +
      `meaningful conclusion. The baseline cold-email → portal-visit rate is ${baselinePct}%. ` +
      `Re-run this readout in 3–5 days once the nudge engine has reached at least 20 distinct recruiters.`
    );
  } else if (nudgePct > baselinePct) {
    console.log(
      `Lever #1 shows a LIFT: nudge → portal-visit = ${nudgePct}% vs cold-email baseline ${baselinePct}%. ` +
      `Intercepting recruiters at reply time is directionally working. ` +
      `Continue monitoring; n=${totalNudged} is sufficient for early signal.`
    );
  } else if (nudgePct === 0 && totalNudged >= 20) {
    console.log(
      `No conversions yet from ${totalNudged} nudged recruiters (0% vs baseline ${baselinePct}%). ` +
      `Either the nudge email isn't driving clicks or the portal page isn't resonating. ` +
      `Check email deliverability, subject-line CTR, and portal UX before drawing final conclusions.`
    );
  } else {
    console.log(
      `Nudge → portal-visit = ${nudgePct}% vs cold-email baseline ${baselinePct}%. ` +
      `No clear lift detected yet with ${totalNudged} nudged recruiters. ` +
      `Too early to conclude — re-run in a few more days with a larger sample.`
    );
  }
}

main()
  .catch(e => { console.error('Fatal:', e); process.exit(1); })
  .finally(() => db.$disconnect());
