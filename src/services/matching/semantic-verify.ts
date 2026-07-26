import OpenAI from 'openai';
import type { Line } from '@/lib/match-breakdown/generate';

// Semantic backstop for the LEXICAL verifier. The lexical verifier (verify.ts) is precise but
// brittle: it only matches a skill if the phrase literally appears, so a real competency stated
// under a different name reads as "missing" — an 11-year QA with STLC + Agile/Waterfall + regression
// is flagged "missing software testing methodologies". Enumerating synonyms never converges. So
// before we DECLARE a (role-defining) skill missing, ask the LLM — strictly grounded — whether the
// candidate's actual background genuinely DEMONSTRATES it. Conservative by design: confirm ONLY on
// real evidence, default to missing when unsure (we still never want a false positive on a recruiter
// letter). One call per pairing, invoked ONLY when a CORE skill is lexically missing (rare), so it
// adds no cost to the common path.

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: (process.env.ZAI_KEY_FEEDVET||process.env.ZAI_API_KEY) || 'dummy-key-for-build', baseURL: 'https://api.z.ai/api/paas/v4', timeout: 20000, maxRetries: 1 });
  return _client;
}

export type SemanticVerifyInput = {
  candidateTitle?: string | null;
  candidateSkills: string[];
  candidateBackground: string; // résumé / experience text
  missing: string[];           // labels the lexical pass marked missing (verify these)
};

/**
 * Returns the subset of `missing` labels the candidate's background genuinely demonstrates.
 * Empty set on any failure (fail-closed: keep the lexical "missing" — never invent a match).
 */
export async function semanticVerifyMissing(inp: SemanticVerifyInput): Promise<Set<string>> {
  const labels = (inp.missing || []).map((s) => s.trim()).filter(Boolean);
  if (!labels.length) return new Set();
  try {
    const system = `Ты — строгий технический верификатор навыков. Кандидат НЕ указал перечисленные навыки дословно. Для КАЖДОГО реши: демонстрирует ли его реальный бэкграунд (навыки + опыт + должность) ВЛАДЕНИЕ этим навыком на деле.

ПРАВИЛА:
- "yes" ТОЛЬКО при реальном свидетельстве. Примеры: 11 лет QA с STLC, Agile/Waterfall, regression testing → ВЛАДЕЕТ "software testing methodologies"; senior backend с микросервисами и интеграциями → ВЛАДЕЕТ "REST API"; 10 лет разработки тем WordPress → ВЛАДЕЕТ "HTML/CSS".
- "no" если сомневаешься или свидетельства нет. Лучше пропустить реальное владение, чем подтвердить ложное.
- НЕ подтверждай по простому совпадению области/отрасли — нужен именно навык.
- Верни СТРОГО JSON: {"confirmed":["<точная метка из списка>", ...]}. Только метки, которые реально подтверждены. JSON, без пояснений.`;

    const user = `КАНДИДАТ: ${inp.candidateTitle || 'должность не указана'}
Навыки: ${(inp.candidateSkills || []).slice(0, 40).join(', ') || '—'}
Опыт/резюме: ${(inp.candidateBackground || '').slice(0, 1200) || '—'}

ПРОВЕРЬ эти навыки (кандидат не указал их дословно): ${JSON.stringify(labels)}

Какие из них реально подтверждаются бэкграундом?`;

    const r = await client().chat.completions.create({
      model: 'glm-4-32b-0414-128k', temperature: 0, max_tokens: 200,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    });
    const m = (r.choices[0]?.message?.content || '').match(/\{[\s\S]*\}/);
    if (!m) return new Set();
    const parsed = JSON.parse(m[0]) as { confirmed?: unknown };
    const confirmed = Array.isArray(parsed.confirmed) ? parsed.confirmed.map(String) : [];
    // Only accept labels we actually asked about (no hallucinated additions).
    const valid = new Set(labels);
    return new Set(confirmed.filter((c) => valid.has(c)));
  } catch (e) {
    console.error('[semanticVerifyMissing] failed (fail-closed):', e);
    return new Set();
  }
}

// Mutates `lines`: promotes any lexically-MISSING CORE skill the candidate's background genuinely
// demonstrates to 'full' (source 'inferred'). Bounded — only fires when a core is missing, one LLM
// call. What remains missing afterwards is a REAL gap the gate will act on. No-op on failure.
export async function promoteSemanticMatches(
  lines: Line[],
  cand: { candidateTitle?: string | null; candidateSkills: string[]; candidateBackground: string },
): Promise<void> {
  const missingCore = lines.filter((l) => l.type === 'skill' && l.core === true && l.status !== 'full').map((l) => l.label);
  if (!missingCore.length) return;
  const confirmed = await semanticVerifyMissing({ ...cand, missing: missingCore });
  if (!confirmed.size) return;
  for (const l of lines) {
    if (l.type === 'skill' && l.core === true && l.status !== 'full' && confirmed.has(l.label)) {
      l.status = 'full'; l.source = 'inferred'; l.viaSemantic = true; l.evidence = l.evidence || 'inferred from background';
    }
  }
}
