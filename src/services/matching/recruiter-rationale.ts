import OpenAI from 'openai';

// Recruiter-voice rationale for the admin audit card. Where explainDecision narrates the gate's
// deterministic checks, THIS reasons like a human recruiter weighing the candidate as a hire:
// does their real background cover the role-defining skills, is a given gap a dealbreaker or
// learnable given their seniority, forward-or-pass and why. Generated at send time (we already
// have JD + profile + breakdown) and frozen into matchBreakdown.recruiterReasoning. Grounded HARD
// against fabrication — same discipline as the cover: never invent experience/tools/seniority.

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.ZAI_API_KEY || 'dummy-key-for-build',
      baseURL: 'https://api.z.ai/api/paas/v4',
      timeout: 20000,
      maxRetries: 1,
    });
  }
  return _client;
}

export type RationaleInput = {
  jobTitle: string;
  jobDescription: string;
  candidateTitle?: string | null;
  candidateYears?: number | null;
  candidateSkills?: string[];
  candidateBackground?: string; // résumé text / experience summary (grounding material)
  matched: string[];
  missingCore: string[];
  missing: string[];
  profession?: string | null; // exact | adjacent | different
  matchedN: number;
  totalN: number;
};

/**
 * Generate a short recruiter-voice judgement (2-4 sentences, Russian). Returns '' on any failure
 * (caller falls back to the deterministic explainDecision narration). Bounded to actual sends.
 */
export async function generateRecruiterRationale(inp: RationaleInput): Promise<string> {
  try {
    const system = `Ты — опытный технический рекрутер. Тебе нужно решить, стоит ли двигать ЭТОГО кандидата на ЭТУ вакансию, и объяснить решение так, как рассуждал бы живой рекрутер — НЕ списком, а связным рассуждением в 2-4 предложениях.

КАК РАССУЖДАТЬ:
- Начни с главного: закрывает ли реальный опыт кандидата ОПРЕДЕЛЯЮЩИЕ (core) навыки роли.
- По каждому заметному пробелу суди по-рекрутерски: это дисквалификация или осваиваемый пробел с учётом уровня/смежного опыта кандидата? Скажи, что именно и почему.
- Заверши ясным выводом: двигаем / стоит созвона / мимо — и причина одной фразой.

ЖЁСТКИЕ ПРАВИЛА:
- Опирайся ТОЛЬКО на приведённые факты о кандидате и данные матча. НИКОГДА не выдумывай опыт, инструменты, цифры или уровень, которых нет в данных.
- Не повторяй сухой список навыков — это суждение, а не сверка.
- Пиши по-русски, живым языком рекрутера, без буллетов и без канцелярита.`;

    const user = `ВАКАНСИЯ: ${inp.jobTitle}
Описание (кратко): ${(inp.jobDescription || '').slice(0, 400)}

КАНДИДАТ: ${inp.candidateTitle || 'должность не указана'}${inp.candidateYears != null ? `, ~${inp.candidateYears} лет опыта` : ''}
Навыки: ${(inp.candidateSkills || []).slice(0, 20).join(', ') || '—'}
Опыт/резюме: ${(inp.candidateBackground || '').slice(0, 700) || '—'}

ДАННЫЕ МАТЧА: совпало ${inp.matchedN} из ${inp.totalN}. Профессия: ${inp.profession || '?'}.
Есть из требуемого: ${inp.matched.join(', ') || '—'}.
Нет КЛЮЧЕВОГО (core): ${inp.missingCore.join(', ') || 'всё ключевое закрыто'}.
Нет (не ключевое): ${inp.missing.join(', ') || '—'}.

Рассуждай как рекрутер:`;

    const r = await client().chat.completions.create({
      model: 'glm-4-32b-0414-128k',
      temperature: 0.5,
      max_tokens: 260,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    return (r.choices[0]?.message?.content || '').trim();
  } catch (e) {
    console.error('[recruiterRationale] generation failed:', e);
    return '';
  }
}
