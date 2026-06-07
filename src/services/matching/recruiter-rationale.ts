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
    const system = `Ты — опытный технический рекрутер. Объясни ТРЕЗВО и ЧЕСТНО, насколько ЭТОТ кандидат соответствует ЭТОЙ вакансии, рассуждая как живой рекрутер — связно, в 2-4 предложениях. Твоя ценность — честная картина, а не оправдание отправки.

КАК РАССУЖДАТЬ:
- Начни с главного: закрывает ли реальный опыт кандидата ОПРЕДЕЛЯЮЩИЕ (core) навыки роли. Если ядро не закрыто — так и скажи прямо, без смягчения.
- Пробел — это пробел. По умолчанию считай отсутствующий навык отсутствующим. Засчитать навык как «подразумеваемый» можно ТОЛЬКО если бэкграунд его ПРЯМО демонстрирует (напр. в резюме описан проект именно на этом инструменте). НЕ натягивай по слабой ассоциации: «работал с AWS» НЕ означает Terraform; «бэкенд-разработчик» НЕ означает DevOps; родственная область НЕ означает владение конкретным инструментом. Догадки про «осваиваемо/наверняка умеет» — запрещены.
- Если это смежная, но ДРУГАЯ специализация (бэкендер на роль DevOps; верстальщик на роль дизайнера) — назови это прямо: профиль из соседней области, ядро роли не подтверждается.
- Дай честную оценку: ядро закрыто реальным опытом, или закрыто частично, или не закрыто (профиль слабо/не подходит). Не приукрашивай ради «двинуть дальше».

ЖЁСТКИЕ ПРАВИЛА:
- НЕ принимай решение за рекрутера и НЕ давай рекомендаций к действию. НИКОГДА не пиши «двигаем на созвон», «стоит созвона», «дать шанс», «пригласить», «мимо», «отказ», «берём/не берём» и подобное. Только разложи картину соответствия — что делать, решает рекрутер.
- Опирайся ТОЛЬКО на приведённые факты. НИКОГДА не выдумывай опыт, инструменты, цифры или уровень, которых нет в данных — и в обратную сторону: не выдумывай, что недостающий навык «наверняка есть».
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
