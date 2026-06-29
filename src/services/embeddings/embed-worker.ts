// Background embedding filler — runs on the Hetzner worker (cron), NEVER on the Vercel render path.
// Keeps the precomputed `embedding` column current on Opportunity / Job / User so the feed can rank by
// semantic similarity via pgvector SQL. Decoupled from the create sites: new rows arrive with NULL
// embedding and this cron fills them within a cycle; if the model server is down it no-ops and rows
// stay NULL (callers fall back to the lexical scorer). Mirrors the ensureMatcherSchema raw-DDL pattern
// in src/services/auto-apply-processor.ts.
import { prisma } from '@/lib/db';
import { embed, buildOppText, buildUserText, embedStamp, toVectorLiteral, EMBED_DIM } from '@/lib/embeddings/client';

const BATCH = Number(process.env.EMBED_FILL_BATCH || 64);
const STALE_SCAN = Number(process.env.EMBED_STALE_SCAN || 200);

let embedSchemaReady = false;
/** Idempotent + concurrency-safe: enable pgvector, add the (out-of-Prisma) columns + HNSW index. */
export async function ensureEmbedSchema(): Promise<void> {
  if (embedSchemaReady) return;
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);
  for (const t of ['Opportunity', 'Job', 'User']) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "embedding" vector(${EMBED_DIM})`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "embeddingStamp" text`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "embeddedAt" timestamptz`);
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "${t}_embedding_hnsw" ON "${t}" USING hnsw ("embedding" vector_cosine_ops)`,
    );
  }
  embedSchemaReady = true;
}

type Row = { id: string; [k: string]: unknown };

/** Embed a set of {id, text} in sub-batches and write back. Fail-soft: a model outage breaks the loop
 *  and returns the count done so far (rows stay NULL → lexical fallback). Returns rows embedded. */
async function embedAndStore(table: string, items: { id: string; text: string }[]): Promise<number> {
  let done = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const chunk = items.slice(i, i + BATCH);
    let vecs: number[][];
    try {
      vecs = await embed(chunk.map((c) => c.text));
    } catch (e) {
      console.error(`[embed] ${table} batch failed (server down?) — leaving NULL:`, (e as Error)?.message);
      break;
    }
    for (let j = 0; j < chunk.length; j++) {
      const vec = vecs[j];
      if (!vec || vec.length === 0) continue;
      await prisma.$executeRawUnsafe(
        `UPDATE "${table}" SET embedding = $1::vector, "embeddingStamp" = $2, "embeddedAt" = now() WHERE id = $3`,
        toVectorLiteral(vec),
        embedStamp(chunk[j].text),
        chunk[j].id,
      );
      done++;
    }
  }
  return done;
}

async function fillOpportunities(limit: number): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT id, title, skills, LEFT(description, 2000) AS description
     FROM "Opportunity"
     WHERE embedding IS NULL AND "isActive" = true
     ORDER BY "createdAt" DESC
     LIMIT $1`,
    limit,
  );
  if (!rows.length) return 0;
  return embedAndStore('Opportunity', rows.map((r) => ({
    id: r.id,
    text: buildOppText({ title: r.title as string, skills: r.skills as string[], description: r.description as string }),
  })));
}

async function fillJobs(limit: number): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT id, title, skills, LEFT(description, 2000) AS description
     FROM "Job"
     WHERE embedding IS NULL AND "isActive" = true
     ORDER BY "createdAt" DESC
     LIMIT $1`,
    limit,
  );
  if (!rows.length) return 0;
  return embedAndStore('Job', rows.map((r) => ({
    id: r.id,
    text: buildOppText({ title: r.title as string, skills: r.skills as string[], description: r.description as string }),
  })));
}

async function fillUsers(limit: number): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT id, "parsedProfile", LEFT("resumeText", 2000) AS "resumeText"
     FROM "User"
     WHERE embedding IS NULL AND "resumeUrl" IS NOT NULL
     ORDER BY "updatedAt" DESC
     LIMIT $1`,
    limit,
  );
  if (!rows.length) return 0;
  return embedAndStore('User', rows.map((r) => ({
    id: r.id,
    text: buildUserText(r.parsedProfile as Record<string, unknown> | null, r.resumeText as string),
  })));
}

/** Bounded staleness sweep: re-embed recently-updated users whose stored stamp no longer matches their
 *  current profile text (a résumé/profile edit changed it). Opportunities/Jobs are immutable post-import,
 *  so they need no sweep. Cheap — only STALE_SCAN recent users, hashing in JS, re-embed mismatches. */
async function reembedStaleUsers(): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT id, "parsedProfile", LEFT("resumeText", 2000) AS "resumeText", "embeddingStamp"
     FROM "User"
     WHERE embedding IS NOT NULL AND "resumeUrl" IS NOT NULL
     ORDER BY "updatedAt" DESC
     LIMIT $1`,
    STALE_SCAN,
  );
  const stale = rows
    .map((r) => ({ id: r.id, text: buildUserText(r.parsedProfile as Record<string, unknown> | null, r.resumeText as string), stamp: r.embeddingStamp as string }))
    .filter((x) => embedStamp(x.text) !== x.stamp)
    .map((x) => ({ id: x.id, text: x.text }));
  if (!stale.length) return 0;
  return embedAndStore('User', stale);
}

/**
 * One pass of the fill cron. Bounded by EMBED_FILL_MAX per table per run. Returns counts so run-embed
 * can loop-until-drained for the one-time backfill, and the steady cron just runs it once per tick.
 */
export async function fillMissingEmbeddings(opts: { max?: number } = {}): Promise<{ opps: number; users: number; jobs: number; stale: number }> {
  await ensureEmbedSchema();
  const max = opts.max ?? Number(process.env.EMBED_FILL_MAX || 500);
  // Priority order: feed pool (opps) → candidates (users) → jobs.
  const opps = await fillOpportunities(max);
  const users = await fillUsers(max);
  const jobs = await fillJobs(max);
  const stale = await reembedStaleUsers();
  return { opps, users, jobs, stale };
}
