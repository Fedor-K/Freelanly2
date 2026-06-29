// Self-hosted embedding client — mirrors getZaiClient() in src/lib/ai.ts but points at a LOCAL
// OpenAI-compatible embedding server (HF text-embeddings-inference or Ollama) running on the Hetzner
// worker. Free (no per-token cost), CPU, on 127.0.0.1. Used ONLY by the worker (embed-fill cron) and
// by semantic-rank reads — never on the Vercel feed-render path (the feed reads precomputed vectors).
//
// Model: Qwen/Qwen3-Embedding-0.6B (Apache-2.0). 1024-dim. Asymmetric retrieval — the candidate
// (query) side gets an instruction prefix; the job (document) side is embedded raw. Same cosine space.
import OpenAI from 'openai';
import { createHash } from 'crypto';

export const EMBED_MODEL = process.env.EMBED_MODEL || 'Qwen/Qwen3-Embedding-0.6B';
export const EMBED_DIM = Number(process.env.EMBED_DIM || 1024);
// Bump to force a global re-embed (the stamp includes it). Also auto-invalidates whenever the embedded
// text or the query instruction below changes, since the stamp hashes the final text.
export const EMBED_VERSION = process.env.EMBED_VERSION || '1';

// Qwen3 retrieval instruction for the candidate side (the "query"); job postings are the "documents".
const QUERY_INSTRUCTION =
  'Instruct: Given a candidate profile, retrieve job postings matching their profession and skills\nQuery: ';

let _client: OpenAI | null = null;
function getEmbedClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      baseURL: process.env.EMBED_BASE_URL || 'http://127.0.0.1:8080/v1',
      apiKey: process.env.EMBED_API_KEY || 'sk-local', // local server ignores it
      timeout: Number(process.env.EMBED_TIMEOUT_MS || 120000), // CPU batches can be slow; generous
      maxRetries: 2,
    });
  }
  return _client;
}

/**
 * Embed a batch of texts → row-ordered 1024-dim vectors. Throws if the server is unreachable; callers
 * (embed-fill cron) must fail-soft so a model outage just leaves rows un-embedded (lexical fallback).
 */
export async function embed(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const r = await getEmbedClient().embeddings.create({ model: EMBED_MODEL, input: texts });
  // The OpenAI shape carries an `index` per row; sort by it so order matches `texts` regardless of server.
  return [...r.data].sort((a, b) => a.index - b.index).map((d) => d.embedding as number[]);
}

/** Single-text convenience (used for a user vector). */
export async function embedOne(text: string): Promise<number[]> {
  const [v] = await embed([text]);
  return v;
}

/** A pgvector literal: `[0.1,0.2,...]` — bind as `$n` with `$n::vector` in raw SQL. */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

// ── Text builders ──────────────────────────────────────────────────────────────────────────────
// Kept short on purpose: an embedding doesn't need the full JD (CPU latency), and the profession +
// skills + a description/summary slice carry the semantic signal that separates real fit from a
// shared generic token ("business", "manager").

// Lean on purpose: title + skills carry most of the ranking signal, and the role/seniority/key-tech
// of a JD sits in its opening. CPU embedding cost is ~linear in tokens, so a short slice keeps both
// the one-time backfill and the steady-state cron cheap without losing the signal that separates
// e.g. "Project Manager" from "Salesforce Project Manager". (Tune via EMBED_OPP_DESC_CHARS.)
const OPP_DESC_CHARS = Number(process.env.EMBED_OPP_DESC_CHARS || 500);
const USER_CV_CHARS = Number(process.env.EMBED_USER_CV_CHARS || 700);

export function buildOppText(o: { title: string; skills?: string[] | null; description?: string | null }): string {
  const skills = (o.skills || []).join(', ');
  return [o.title, skills, (o.description || '').slice(0, OPP_DESC_CHARS)].filter(Boolean).join('\n');
}

export function buildUserText(
  profile: Record<string, unknown> | null | undefined,
  resumeText?: string | null,
): string {
  const p = profile || {};
  const skills = ((p.skills as string[]) || []).join(', ');
  const body = [
    typeof p.current_title === 'string' ? p.current_title : '',
    typeof p.field === 'string' ? p.field : '',
    skills,
    typeof p.summary === 'string' ? p.summary : '',
    (resumeText || '').slice(0, USER_CV_CHARS),
  ].filter(Boolean).join('\n');
  // Candidate = query side → instruction prefix.
  return QUERY_INSTRUCTION + body;
}

/** Stable fingerprint of the exact text we embedded (+ version + model). A profile/JD edit or a
 *  version bump changes it → the fill cron re-embeds. Mirrors profileStamp in assess-pairing-cached. */
export function embedStamp(text: string): string {
  return createHash('sha1').update(`${EMBED_VERSION}|${EMBED_MODEL}|${text}`).digest('hex');
}
