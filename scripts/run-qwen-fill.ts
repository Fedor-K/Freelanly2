import { prisma } from "./src/lib/db";
const TARGET = Number(process.env.QWEN_FILL_TARGET || 10);   // fill users whose feed is below this
const PER_USER = Number(process.env.QWEN_FILL_PER_USER || 20);
const MAX_USERS = Number(process.env.QWEN_FILL_MAX_USERS || 2000); // per run (was 600 — starved older users)
const MIN_SIM = Number(process.env.QWEN_FILL_MIN_SIM || 0.50);
const DAYS = Number(process.env.QWEN_FILL_DAYS || 3);
const MAXDIST = 1 - MIN_SIM;
async function main() {
  const t0 = Date.now();
  const sql = `
    WITH feed AS (SELECT "userId", COUNT(*) AS c FROM "AutoApplication" WHERE status::text IN ('REVIEW','PENDING') GROUP BY "userId")
    INSERT INTO "AutoApplication" (id,"userId","loopId","opportunityId","companyName","jobTitle","appliedToEmail","coverLetter",subject,status,"matchScore","matchBreakdown","updatedAt")
    SELECT gen_random_uuid()::text, usr.id, usr.loop_id, g.id,
      COALESCE(NULLIF(g."posterCompany",''), NULLIF(g."clientName",''), initcap(split_part(g."applyEmail",'@',2)), 'Company'),
      g.title, g."applyEmail", '', '', 'REVIEW'::"AutoApplyStatus",
      ROUND((1-(g.embedding <=> usr.e))*100)::int,
      jsonb_build_object('qwenRematch', true, 'sim', ROUND((1-(g.embedding <=> usr.e))::numeric,3)),
      now()
    FROM (
      SELECT u.id, l.id AS loop_id, u.embedding AS e
      FROM "User" u
      JOIN "AutoApplyLoop" l ON l."userId"=u.id AND l."isActive"=true
      LEFT JOIN feed f ON f."userId"=u.id
      WHERE u."emailVerified" IS NOT NULL AND u.embedding IS NOT NULL AND COALESCE(f.c,0) < ${TARGET}
      -- FAIRNESS: random() rotates coverage across ALL eligible users so nobody is permanently
      -- starved. Was "createdAt DESC" which only ever refilled the newest ${MAX_USERS} — older active
      -- users (incl paying PRO) never got matched once they emptied their queue. Matching is pure SQL
      -- cosine (no LLM cost), so there is no reason to ration by recency.
      ORDER BY random()
      LIMIT ${MAX_USERS}
    ) usr
    CROSS JOIN LATERAL (
      SELECT o.id, o.title, o."applyEmail", o."posterCompany", o."clientName", o.embedding
      FROM "Opportunity" o
      WHERE o."createdAt" >= now() - interval '${DAYS} days' AND o."applyEmail" IS NOT NULL AND o.embedding IS NOT NULL
        AND (o.embedding <=> usr.e) <= ${MAXDIST}
        AND NOT EXISTS (SELECT 1 FROM "AutoApplication" a WHERE a."userId"=usr.id AND a."opportunityId"=o.id)
      ORDER BY o.embedding <=> usr.e LIMIT ${PER_USER}
    ) g
    ON CONFLICT DO NOTHING`;
  const n = await prisma.$executeRawUnsafe(sql);
  console.log(new Date().toISOString(), `[qwen-fill] inserted ${n} rows in ${Date.now()-t0}ms (feed<${TARGET}, sim>=${MIN_SIM})`);
  await prisma.$disconnect(); process.exit(0);
}
main().catch((e) => { console.error("[qwen-fill] ERR", e); process.exit(1); });
