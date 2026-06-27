// Honest match caveats surfaced to the recruiter (and the admin audit view).
// Derived from the frozen matchBreakdown the matcher already computes — no extra LLM.
// Strength = severity of caveats, used to sort/label. A clean match has zero caveats.
export type Caveats = { strength: 'Strong' | 'Good' | 'Weak'; items: string[] };

export function computeCaveats(bd: unknown): Caveats | null {
  if (!bd || typeof bd !== 'object') return null;
  const b = bd as Record<string, unknown>;
  if (b.error) return null;
  const lines = Array.isArray(b.lines) ? (b.lines as Array<Record<string, unknown>>) : [];
  const total = typeof b.total === 'number' ? b.total : lines.length;
  const matched = typeof b.matched === 'number' ? b.matched : lines.filter((l) => l?.status === 'full').length;
  const profession = typeof b.profession === 'string' ? b.profession : null;   // exact | adjacent (different never reaches the recruiter)
  const englishReq = typeof b.english_req === 'string' ? b.english_req : null;  // strong | weak | none
  const englishLevel = typeof b.english_level === 'string' ? b.english_level : null; // ok | b1 | low | unknown
  const hardFail = b.hard_fail === true;
  const hardDetail = typeof b.hard_detail === 'string' ? b.hard_detail : '';
  const locationFlag = b.location_flag === true;
  const locationDetail = typeof b.location_detail === 'string' ? b.location_detail : '';
  const missingLines = lines.filter((l) => l?.status !== 'full');
  // Layer 2 — a missing CORE requirement (defines the role: in the title / mandatory) outweighs
  // a decent numerator: it's flagged separately and is severe (drops strength to Weak).
  const coreMissing = missingLines.filter((l) => l?.core === true).map((l) => String(l?.label ?? '')).filter(Boolean);
  const otherMissing = missingLines.filter((l) => l?.core !== true).map((l) => String(l?.label ?? '')).filter(Boolean);

  const items: string[] = [];
  // Hard, checkable requirement the candidate fails (education / cert / minimum-years) — most severe.
  if (hardFail) items.push(`Hard requirement not met: ${hardDetail || 'see job requirements'}`);
  // Missing a CORE/defining skill of the role (Layer 2) — severe even if other skills matched.
  if (coreMissing.length) items.push(`Missing CORE requirement: ${coreMissing.join(', ')}`);
  // Geographic mismatch — job tied to a place, remote unclear, candidate elsewhere (soft, verify).
  if (locationFlag) items.push(`Location mismatch: ${locationDetail || 'job and candidate in different countries'} — on-site/remote unclear`);
  if (profession === 'adjacent') items.push('Adjacent role — not an exact occupation match');
  if (total > 0 && otherMissing.length) items.push(`Missing: ${otherMissing.join(', ')}`);
  if (total === 0) items.push('No explicit requirements in the post — matched on profession only');
  // #2 — language caveat ONLY on an explicitly weak level (b1/low), never on "unknown" (avoids
  // spamming a low-signal badge across the 68% of candidates who don't state their English level).
  const engRisk = englishReq === 'strong' && (englishLevel === 'b1' || englishLevel === 'low');
  if (engRisk) items.push('English may be below what this role needs — worth verifying');

  // Coverage severity — a low matched/total ratio can't be a Strong/Good match even when none of
  // the misses are flagged `core`. Without this, a 2-of-5 match (only generic tooling present, the
  // role-defining skills absent but un-flagged) slipped through as "Good". Honest floor:
  //   <50% of stated requirements met (≥3 reqs)  → Weak;  0 matched of ≥2 → Weak.
  const lowCoverage = total >= 3 && matched / total < 0.5;
  const zeroCoverage = total >= 2 && matched === 0;
  // 0 parseable requirements → the only signal is a profession/title match, with NO skill evidence.
  // That's a Weak signal, not "Good" — without this a 0/0 breakdown slipped through as a confident
  // "Good" match (the coverage floors above need total ≥ 2/3, so total=0 dodged them).
  const noRequirements = total === 0;

  if (items.length === 0) {
    // Even with zero explicit caveats, a thin coverage ratio bars a "Strong" label.
    if (lowCoverage || zeroCoverage || noRequirements) return { strength: 'Weak', items };
    return { strength: 'Strong', items };
  }
  const severe = hardFail || coreMissing.length > 0 || engRisk || lowCoverage || zeroCoverage || noRequirements
    || (profession === 'adjacent' && total >= 3 && matched < 2);
  return { strength: items.length >= 2 || severe ? 'Weak' : 'Good', items };
}

// Reconcile the raw 0-100 AI score with the breakdown-derived strength so the NUMBER shown in the
// portal (fit ring) can never contradict the LABEL. The AI score is a holistic guess; the strength
// is grounded in the structural breakdown. We clamp the score into the band for its strength, so a
// breakdown that says Weak can't surface as "Strong 80%". Returns the clamped score.
const SCORE_BANDS: Record<'Strong' | 'Good' | 'Weak', [number, number]> = {
  Strong: [78, 96],
  Good: [58, 77],
  Weak: [35, 57],
};
export function reconcileScore(aiScore: number | null | undefined, strength: 'Strong' | 'Good' | 'Weak' | null | undefined): number | null {
  if (aiScore == null) return null;
  if (!strength) return aiScore;
  const [lo, hi] = SCORE_BANDS[strength];
  return Math.max(lo, Math.min(hi, Math.round(aiScore)));
}

// Human-readable, point-by-point REASONING for the admin audit card — explains, in plain language,
// what the role asks for, what the candidate has vs lacks (leading with the role-DEFINING skills),
// how critical each gap is, and how that adds up to the send decision. Derived from the SAME frozen
// breakdown (no extra compute, works retroactively on every stored record). Narration only — it
// reports the decision the gate already made, it does not re-decide.
export type DecisionStep = { kind: 'info' | 'ok' | 'warn' | 'final'; text: string };

// Honest reject verdict — narrates the REAL reason the gate/AI said NO, even when the skill
// walk-through above shows everything matched (keyword overlap ≠ a genuine fit). Never says
// "отправляем" for a row that wasn't sent.
function rejectVerdict(
  reason: string,
  s: { matched: number; total: number; ratio: number | null; coreMissing: string[] },
): string {
  const skill = s.total > 0 ? `Совпадение по навыкам ${s.matched} из ${s.total}${s.ratio !== null ? ` (${s.ratio}%)` : ''}. ` : '';
  const r = reason.toLowerCase();
  if (r.includes('ai-match'))
    return `Итог: ${skill}Но AI-проверка определила, что это не настоящее соответствие роли — ключевые слова есть в резюме, а по сути профиль/опыт под роль не подходит. Не отправлено, кавер не генерировался.`;
  if (r.startsWith('different profession'))
    return `Итог: ${skill}Но это другая профессия (${reason.replace(/^different profession\s*/i, '').replace(/^[(]|[)]$/g, '').trim() || 'роль не совпадает'}). Не отправлено.`;
  if (r.includes('no real cv'))
    return `Итог: ${skill}Но у кандидата нет настоящего резюме (сгенерированное/отсутствует) — без него отклик не отправляем. Не отправлено.`;
  if (r.includes('seniority'))
    return `Итог: ${skill}Но не совпадает уровень (seniority) — роль требует другого опыта. Не отправлено.`;
  if (r.includes('work-auth') || r.includes('on-site') || r.includes('on site'))
    return `Итог: ${skill}Но роль требует присутствия на месте или разрешения на работу. Не отправлено.`;
  if (r.includes('language'))
    return `Итог: ${skill}Но не совпадает языковая пара, которую требует роль. Не отправлено.`;
  if (r.includes('zero skill'))
    return `Итог: нет подтверждения требуемых навыков. Не отправлено.`;
  if (r.includes('hard requirement'))
    return `Итог: ${skill}Но не выполнено жёсткое требование (${reason.replace(/^hard requirement failed:\s*/i, '').trim() || 'см. требования'}). Не отправлено.`;
  if (s.coreMissing.length)
    return `Итог: не хватает ключевого требования роли (${s.coreMissing.join(', ')}). Не отправлено.`;
  return `Итог: ${skill}Отклонено${reason ? ` — ${reason}` : ' AI-проверкой'}. Не отправлено.`;
}

// `outcome` carries the ACTUAL decision (sent? + reject reason) so the verdict reports what
// really happened instead of re-deriving a skill-only guess. Without it, falls back to the
// skill-based narration (legacy callers).
export function explainDecision(
  bd: unknown,
  outcome?: { sent: boolean; gateReason?: string | null },
): DecisionStep[] {
  if (!bd || typeof bd !== 'object') return [];
  const b = bd as Record<string, unknown>;
  if (b.error) return [];
  const lines = Array.isArray(b.lines) ? (b.lines as Array<Record<string, unknown>>) : [];
  const total = typeof b.total === 'number' ? b.total : lines.length;
  const matched = typeof b.matched === 'number' ? b.matched : lines.filter((l) => l?.status === 'full').length;
  const lbl = (l: Record<string, unknown>) => String(l?.label ?? '').trim();
  const has = (l: Record<string, unknown>) => l?.status === 'full';
  const core = (l: Record<string, unknown>) => l?.core === true;
  const coreReqs = lines.filter(core).map(lbl).filter(Boolean);
  const coreMissing = lines.filter((l) => !has(l) && core(l)).map(lbl).filter(Boolean);
  const ratio = total ? Math.round((matched / total) * 100) : null;
  const locationFlag = b.location_flag === true;
  const locationDetail = typeof b.location_detail === 'string' ? b.location_detail : '';
  const hardFail = b.hard_fail === true;
  const hardKind = typeof b.hard_kind === 'string' ? b.hard_kind : '';
  const hardDetail = typeof b.hard_detail === 'string' ? b.hard_detail : '';

  const steps: DecisionStep[] = [];

  // 1. What the role asks for (flagging the role-defining ones).
  if (total > 0) {
    const reqList = lines.map(lbl).filter(Boolean).join(', ');
    steps.push({ kind: 'info', text: `Вакансия требует: ${reqList}.${coreReqs.length ? ` Ключевое для роли: ${coreReqs.join(', ')}.` : ''}` });
  } else {
    steps.push({ kind: 'info', text: 'В посте нет явных требований — оцениваем по профессии.' });
  }

  // 2. Walk the requirements, MOST IMPORTANT FIRST: core-have → core-missing → other-have → other-missing.
  const order = [
    ...lines.filter((l) => core(l) && has(l)),
    ...lines.filter((l) => core(l) && !has(l)),
    ...lines.filter((l) => !core(l) && has(l)),
    ...lines.filter((l) => !core(l) && !has(l)),
  ];
  for (const l of order) {
    const name = lbl(l);
    if (!name) continue;
    if (core(l) && has(l)) steps.push({ kind: 'ok', text: `${name} — есть у кандидата. Это ключевое требование роли, и оно закрыто.` });
    else if (core(l)) steps.push({ kind: 'warn', text: `${name} — нет. Это ключевое требование роли.` });
    else if (has(l)) steps.push({ kind: 'ok', text: `${name} — есть.` });
    else steps.push({ kind: 'warn', text: `${name} — нет, но это не ключевое требование (не критично).` });
  }

  // 3. Soft flags worth the recruiter's eye.
  if (locationFlag) steps.push({ kind: 'warn', text: `Локация: ${locationDetail || 'кандидат, похоже, в другой стране'} — стоит уточнить remote/on-site.` });
  if (hardFail) steps.push({ kind: 'warn', text: `Жёсткое требование (${hardKind}): ${hardDetail || 'см. требования'} — под вопросом.` });

  // 4. The verdict, tying it together. If we know the ACTUAL outcome and it was a reject, narrate
  // the real reason — a row can have every skill matched (Strong) yet be rejected by AI-match /
  // seniority / no-CV / profession. Never claim "отправляем" for a row that wasn't sent.
  const reason = (outcome?.gateReason || (typeof b.gateReason === 'string' ? (b.gateReason as string) : '') || '').trim();
  let verdict: string;
  if (outcome && outcome.sent === false) {
    verdict = rejectVerdict(reason, { matched, total, ratio, coreMissing });
  } else if (total === 0) {
    verdict = 'Явных требований нет, профессия подходит — отправляем.';
  } else if (!coreMissing.length) {
    verdict = `Итог: все ключевые требования закрыты, совпадение ${matched} из ${total}${ratio !== null ? ` (${ratio}%)` : ''}. Кандидат подходит — отправляем.`;
  } else {
    // A genuine missing CORE (it survived the semantic backstop) → gated. Don't narrate a send.
    verdict = `Итог: не хватает ключевого требования роли (${coreMissing.join(', ')}) — этого нет в реальном опыте кандидата. Не отправляем.`;
  }
  steps.push({ kind: 'final', text: verdict });
  return steps;
}
// sees — so the letter's honest-mode/missing-strip and the stored label all agree with the card.
export type MatchVerdict = { label?: 'Strong' | 'Good' | 'Weak'; matchedSkills: string[]; missingCore: string[]; missing: string[] };
export function breakdownToVerdict(bd: unknown): MatchVerdict | undefined {
  if (!bd || typeof bd !== 'object') return undefined;
  const b = bd as Record<string, unknown>;
  if (b.error) return undefined;
  const lines = Array.isArray(b.lines) ? (b.lines as Array<Record<string, unknown>>) : [];
  if (!lines.length) return undefined;
  const lbl = (l: Record<string, unknown>) => String(l?.label ?? '').trim();
  const matchedSkills = lines.filter((l) => l?.status === 'full').map(lbl).filter(Boolean);
  const missingCore = lines.filter((l) => l?.status !== 'full' && l?.core === true).map(lbl).filter(Boolean);
  const missing = lines.filter((l) => l?.status !== 'full' && l?.core !== true).map(lbl).filter(Boolean);
  return { label: computeCaveats(bd)?.strength, matchedSkills, missingCore, missing };
}
