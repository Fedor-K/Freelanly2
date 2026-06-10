import { neon } from '@neondatabase/serverless';

const DB = 'postgresql://neondb_owner:npg_XuzI8BYto5Qf@ep-noisy-tooth-ahj8gt6v-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DB);

async function retry(fn, attempts = 4, delayMs = 1500) {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) {
      if (i === attempts - 1) throw e;
      console.error(`  Attempt ${i+1} failed: ${e.message}. Retry in ${delayMs}ms...`);
      await new Promise(r => setTimeout(r, delayMs));
      delayMs = Math.round(delayMs * 1.5);
    }
  }
}

async function q(query) {
  return retry(() => sql.query(query));
}

async function main() {
  console.log('=== LEVER #1 READOUT — 2026-06-10 ===\n');

  // Q1 ─ success counts
  const q1ok = await q(`
    SELECT COUNT(*)::int AS total_ok,
           COUNT(DISTINCT details->>'recruiterEmail')::int AS distinct_recruiters
    FROM "ActivityLog"
    WHERE action = 'RECRUITER_PORTAL_NUDGE_SENT'
      AND "createdAt" > '2026-06-08 21:43:00'
      AND details->>'ok' = 'true'
      AND details->>'recruiterEmail' IS DISTINCT FROM 'info@freelanly.com'
  `);

  // Q1 ─ failure breakdown
  const q1fail = await q(`
    SELECT details->>'err' AS err, COUNT(*)::int AS cnt
    FROM "ActivityLog"
    WHERE action = 'RECRUITER_PORTAL_NUDGE_SENT'
      AND "createdAt" > '2026-06-08 21:43:00'
      AND details->>'ok' = 'false'
      AND details->>'recruiterEmail' IS DISTINCT FROM 'info@freelanly.com'
    GROUP BY details->>'err'
    ORDER BY cnt DESC
  `);

  console.log('── Q1: Nudge delivery ──────────────────────────────────────');
  console.log(`  Successful nudges (ok=true)      : ${q1ok[0].total_ok}`);
  console.log(`  Distinct recruiter emails nudged : ${q1ok[0].distinct_recruiters}`);
  const totalFail = q1fail.reduce((s, r) => s + r.cnt, 0);
  console.log(`  Failed nudges (ok=false)         : ${totalFail}`);
  for (const r of q1fail) console.log(`    err="${r.err ?? 'null'}": ${r.cnt}`);

  // Q2 ─ plural vs singular
  const q2 = await q(`
    SELECT
      SUM(CASE WHEN (details->>'candidateCount')::int > 1 THEN 1 ELSE 0 END)::int AS plural,
      SUM(CASE WHEN (details->>'candidateCount')::int = 1 THEN 1 ELSE 0 END)::int AS singular,
      SUM(CASE WHEN details->>'candidateCount' IS NULL  THEN 1 ELSE 0 END)::int AS no_field
    FROM "ActivityLog"
    WHERE action = 'RECRUITER_PORTAL_NUDGE_SENT'
      AND "createdAt" > '2026-06-08 21:43:00'
      AND details->>'ok' = 'true'
      AND details->>'recruiterEmail' IS DISTINCT FROM 'info@freelanly.com'
  `);

  console.log('\n── Q2: Singular vs plural branch ───────────────────────────');
  console.log(`  Plural branch (candidateCount > 1) : ${q2[0].plural}`);
  console.log(`  Singular branch (candidateCount = 1): ${q2[0].singular}`);
  console.log(`  No candidateCount field             : ${q2[0].no_field}`);

  // Q3 ─ nudge → portal-visit conversion
  const q3 = await q(`
    WITH nudged AS (
      SELECT details->>'recruiterEmail' AS re, MIN("createdAt") AS first_nudge
      FROM "ActivityLog"
      WHERE action = 'RECRUITER_PORTAL_NUDGE_SENT'
        AND "createdAt" > '2026-06-08 21:43:00'
        AND details->>'ok' = 'true'
        AND details->>'recruiterEmail' IS DISTINCT FROM 'info@freelanly.com'
      GROUP BY details->>'recruiterEmail'
    ),
    visits AS (
      SELECT lower(details->>'recruiterEmail') AS re, MIN("createdAt") AS first_visit
      FROM "ActivityLog"
      WHERE action = 'RECRUITER_PORTAL_VISIT'
        AND details->>'recruiterEmail' IS DISTINCT FROM 'info@freelanly.com'
      GROUP BY lower(details->>'recruiterEmail')
    )
    SELECT
      COUNT(n.re)::int AS total_nudged,
      COUNT(v.re)::int AS converted,
      ROUND(COUNT(v.re)::numeric * 100.0 / NULLIF(COUNT(n.re),0), 1) AS pct
    FROM nudged n
    LEFT JOIN visits v ON lower(n.re) = v.re AND v.first_visit > n.first_nudge
  `);

  console.log('\n── Q3: Nudge → portal-visit conversion ─────────────────────');
  console.log(`  Distinct recruiters nudged         : ${q3[0].total_nudged}`);
  console.log(`  Converted (visit after nudge)      : ${q3[0].converted}`);
  console.log(`  Conversion rate                    : ${q3[0].pct ?? 0}%`);

  // Q4 ─ registrations and contact reveals
  const q4reg = await q(`
    WITH nudged AS (
      SELECT details->>'recruiterEmail' AS re, MIN("createdAt") AS first_nudge
      FROM "ActivityLog"
      WHERE action = 'RECRUITER_PORTAL_NUDGE_SENT'
        AND "createdAt" > '2026-06-08 21:43:00'
        AND details->>'ok' = 'true'
        AND details->>'recruiterEmail' IS DISTINCT FROM 'info@freelanly.com'
      GROUP BY details->>'recruiterEmail'
    )
    SELECT COUNT(DISTINCT n.re)::int AS registered_after_nudge
    FROM nudged n
    JOIN "Recruiter" r ON lower(r.email) = lower(n.re) AND r."registeredAt" > n.first_nudge
  `);

  const q4reveal = await q(`
    WITH nudged AS (
      SELECT details->>'recruiterEmail' AS re, MIN("createdAt") AS first_nudge
      FROM "ActivityLog"
      WHERE action = 'RECRUITER_PORTAL_NUDGE_SENT'
        AND "createdAt" > '2026-06-08 21:43:00'
        AND details->>'ok' = 'true'
        AND details->>'recruiterEmail' IS DISTINCT FROM 'info@freelanly.com'
      GROUP BY details->>'recruiterEmail'
    )
    SELECT COUNT(DISTINCT n.re)::int AS revealed_after_nudge
    FROM nudged n
    JOIN "ActivityLog" al
      ON lower(al.details->>'recruiterEmail') = lower(n.re)
      AND al.action = 'CONTACT_VIEW'
      AND al."createdAt" > n.first_nudge
  `);

  console.log('\n── Q4: Registration or ContactReveal after nudge ────────────');
  console.log(`  Nudged recruiters who registered  : ${q4reg[0].registered_after_nudge}`);
  console.log(`  Nudged recruiters with ContactReveal: ${q4reveal[0].revealed_after_nudge}`);

  // Q5 ─ all-time baseline
  const q5 = await q(`
    SELECT
      (SELECT COUNT(DISTINCT lower(details->>'recruiterEmail'))::int
       FROM "ActivityLog" WHERE action = 'RECRUITER_PORTAL_VISIT') AS portal_visitors,
      (SELECT COUNT(DISTINCT lower("appliedToEmail"))::int
       FROM "AutoApplication" WHERE "sentAt" IS NOT NULL) AS app_emails,
      ROUND(
        (SELECT COUNT(DISTINCT lower(details->>'recruiterEmail'))::int
         FROM "ActivityLog" WHERE action = 'RECRUITER_PORTAL_VISIT')::numeric * 100.0 /
        NULLIF(
          (SELECT COUNT(DISTINCT lower("appliedToEmail"))::int
           FROM "AutoApplication" WHERE "sentAt" IS NOT NULL), 0
        ), 2
      ) AS baseline_pct
  `);

  console.log('\n── Q5: All-time cold-email → portal-visit baseline ──────────');
  console.log(`  Distinct portal-visit emails (all-time): ${q5[0].portal_visitors}`);
  console.log(`  Distinct applied-to emails (all-time)  : ${q5[0].app_emails}`);
  console.log(`  Baseline rate                          : ${q5[0].baseline_pct}%  (prev benchmark: ~3.40%)`);

  // ── Summary ──────────────────────────────────────────────────────────────
  const nudgePct   = parseFloat(q3[0].pct   ?? 0);
  const baselinePct = parseFloat(q5[0].baseline_pct ?? 0);
  const totalNudged = q3[0].total_nudged;

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('SUMMARY TABLE');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`Metric                                          Value`);
  console.log(`────────────────────────────────────────────────────────────`);
  console.log(`Total nudges sent (ok=true)                     ${q1ok[0].total_ok}`);
  console.log(`Distinct recruiters nudged                      ${q1ok[0].distinct_recruiters}`);
  console.log(`Failed nudges (ok=false)                        ${totalFail}`);
  console.log(`Plural branch (candidateCount > 1)              ${q2[0].plural}`);
  console.log(`Singular branch (candidateCount = 1)            ${q2[0].singular}`);
  console.log(`Nudge → portal-visit conversions                ${q3[0].converted} / ${totalNudged} = ${nudgePct}%`);
  console.log(`Registrations after nudge                       ${q4reg[0].registered_after_nudge}`);
  console.log(`ContactReveals after nudge                      ${q4reveal[0].revealed_after_nudge}`);
  console.log(`All-time cold-email baseline                    ${q5[0].portal_visitors} / ${q5[0].app_emails} = ${baselinePct}%`);
  console.log('════════════════════════════════════════════════════════════');

  console.log('\nVERDICT');
  console.log('────────────────────────────────────────────────────────────');
  if (totalNudged < 20) {
    console.log(
      `Sample too small: only ${totalNudged} distinct recruiter${totalNudged === 1 ? '' : 's'} nudged ` +
      `in the ~${Math.round((Date.now() - new Date('2026-06-08T21:43:00Z').getTime()) / 3600000)}h since launch. ` +
      `Baseline cold-email → portal-visit rate is ${baselinePct}%. ` +
      `Re-run this readout in 3–5 days once at least 20 distinct recruiters have been nudged.`
    );
  } else if (nudgePct > baselinePct) {
    console.log(
      `Lever #1 shows a LIFT: nudge → portal-visit = ${nudgePct}% vs cold-email baseline ${baselinePct}%. ` +
      `Intercepting recruiters at reply time is working. Continue monitoring as volume grows.`
    );
  } else if (nudgePct === 0) {
    console.log(
      `No conversions yet from ${totalNudged} nudged recruiters (0% vs baseline ${baselinePct}%). ` +
      `Check email deliverability, subject-line CTR, and portal UX before drawing conclusions.`
    );
  } else {
    console.log(
      `Nudge → portal-visit = ${nudgePct}% vs baseline ${baselinePct}%. ` +
      `No clear lift with n=${totalNudged}. Re-run in a few days for a larger sample.`
    );
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
