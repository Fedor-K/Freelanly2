// Read-side of the semantic layer: pull a user's precomputed vector and rank opportunities/jobs by
// cosine similarity in Postgres (pgvector HNSW). NO model call here — only SQL over stored vectors —
// so this is safe on the Vercel feed-render path. Returns null/empty whenever a vector is missing, so
// every caller can fall back to the lexical scorer (un-embedded rows, model still warming, etc).
import { prisma } from '@/lib/db';
import { toVectorLiteral } from '@/lib/embeddings/client';

export type SemRow = { id: string; title: string; skills: string[]; createdAt: Date; sim: number };

/** The candidate's stored vector, or null if not embedded yet. `vector::text` → a JSON array string. */
export async function getUserEmbedding(userId: string): Promise<number[] | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ e: string | null }[]>(
      `SELECT embedding::text AS e FROM "User" WHERE id = $1`,
      userId,
    );
    const e = rows[0]?.e;
    if (!e) return null;
    return JSON.parse(e) as number[];
  } catch {
    return null; // column may not exist yet (pre-migration) → lexical fallback
  }
}

/**
 * Top opportunities + jobs for a candidate vector, ranked by cosine similarity. Same shape/filters as
 * the live feed pool (7-day, active, self-appliable or external). `sim` ∈ [0,1] (1 = identical).
 */
export async function semanticPool(
  userVec: number[],
  opts: { weekAgo: Date; limit?: number },
): Promise<{ opps: SemRow[]; jobs: SemRow[] }> {
  const lit = toVectorLiteral(userVec);
  const limit = opts.limit ?? 400;
  try {
  const [opps, jobs] = await Promise.all([
    prisma.$queryRawUnsafe<SemRow[]>(
      `SELECT id, title, skills, "createdAt", 1 - (embedding <=> $1::vector) AS sim
       FROM "Opportunity"
       WHERE "isActive" = true AND "createdAt" >= $2 AND embedding IS NOT NULL
         AND ("applyEmail" IS NOT NULL OR "applyUrl" IS NOT NULL)
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      lit, opts.weekAgo, limit,
    ),
    prisma.$queryRawUnsafe<SemRow[]>(
      `SELECT id, title, skills, "createdAt", 1 - (embedding <=> $1::vector) AS sim
       FROM "Job"
       WHERE "isActive" = true AND "createdAt" >= $2 AND embedding IS NOT NULL AND "applyEmail" IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      lit, opts.weekAgo, limit,
    ),
  ]);
  // Postgres returns sim as a string/number depending on driver — normalize.
  for (const r of opps) r.sim = Number(r.sim);
  for (const r of jobs) r.sim = Number(r.sim);
  return { opps, jobs };
  } catch {
    return { opps: [], jobs: [] }; // column missing / transient → caller falls back to lexical
  }
}

/** Recent opportunities NOT yet embedded — so a just-ingested role isn't invisible while the cron
 *  catches up. Caller scores these lexically and appends them after the semantic set. */
export async function unembeddedRecentOpps(weekAgo: Date, limit = 100): Promise<{ id: string; title: string; skills: string[]; createdAt: Date }[]> {
  try {
    return await prisma.$queryRawUnsafe(
      `SELECT id, title, skills, "createdAt"
       FROM "Opportunity"
       WHERE "isActive" = true AND "createdAt" >= $1 AND embedding IS NULL
         AND ("applyEmail" IS NOT NULL OR "applyUrl" IS NOT NULL)
       ORDER BY "createdAt" DESC
       LIMIT $2`,
      weekAgo, limit,
    );
  } catch {
    return [];
  }
}

/** Cosine similarity for a given set of opportunity ids → Map(id → sim). Used to re-rank an
 *  already-shortlisted candidate set (e.g. quick-apply suggestions) without a fresh retrieval. */
export async function semanticRankIds(userVec: number[], ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  try {
    const lit = toVectorLiteral(userVec);
    // ids are cuids (alphanumeric, no commas) → safe to pass as a comma-joined string param.
    const rows = await prisma.$queryRawUnsafe<{ id: string; sim: number }[]>(
      `SELECT id, 1 - (embedding <=> $1::vector) AS sim
       FROM "Opportunity"
       WHERE id = ANY(string_to_array($2, ',')) AND embedding IS NOT NULL`,
      lit, ids.join(','),
    );
    return new Map(rows.map((r) => [r.id, Number(r.sim)]));
  } catch {
    return new Map();
  }
}

/** Plain cosine for two in-memory vectors (worker-side comparisons). */
export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}
