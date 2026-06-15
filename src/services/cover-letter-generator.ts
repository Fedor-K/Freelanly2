import OpenAI from 'openai';
import { isAiUnavailable } from '@/lib/ai-errors';

// AI Provider — Z.ai (GLM-4-32B) only
let _zai: OpenAI | null = null;

function getZaiClient(): OpenAI {
  if (!_zai) {
    _zai = new OpenAI({
      apiKey: process.env.ZAI_API_KEY || 'dummy-key-for-build',
      baseURL: 'https://api.z.ai/api/paas/v4',
      timeout: 30000,
      maxRetries: 2,
    });
  }
  return _zai;
}

function getAIClient(): { client: OpenAI; model: string } {
  return { client: getZaiClient(), model: 'glm-4-32b-0414-128k' };
}

// =========================================================================
// INTERFACES
// =========================================================================

/** Raw data about the job/opportunity — everything we know */
interface JobData {
  title: string;
  description: string;
  recruiterEmail?: string;
  /** Raw LinkedIn post content or original posting text */
  originalContent?: string;
  /** Poster/recruiter name from LinkedIn */
  posterName?: string;
  /** Poster headline from LinkedIn */
  posterHeadline?: string;
  /** Company name if known */
  companyName?: string;
}

/** User's profile — everything we know about the applicant */
interface UserData {
  name: string;
  email: string;
  skills: string[];
  languages?: string[];
  resumeText?: string;
  workPreference?: string;
  bookingUrl?: string;
  caseStudies?: Array<{ title: string; description: string; url?: string }>;
}

// Keep backward-compatible interface
interface UserProfile {
  name: string;
  skills: string[];
  experience: string;
  resumeText?: string;
  languages?: string[];
  workPreference?: string;
  bookingUrl?: string;
  caseStudies?: Array<{ title: string; description: string; tech?: string[]; url?: string }>;
  recruiterEmail?: string;
}

interface CoverLetterInput {
  jobTitle: string;
  jobDescription: string;
  companyName: string;
  userProfile: UserProfile;
  styleOverride?: string;
  // The matcher's verdict for THIS pairing. When present, the generator writes in a tone
  // consistent with it (honest/transferable on a weak/partial match) and a deterministic
  // post-filter (below) guarantees no missing skill is positively referenced — so the verdict
  // is consumed by CODE, not merely handed to the model.
  verdict?: { label?: 'Strong' | 'Good' | 'Weak'; matchedSkills?: string[]; missingCore?: string[]; missing?: string[] };
}

// Deterministic backstop for over-promising. The prompt forbids global fitness claims, but a
// high-temperature model still occasionally opens with "I'm a strong fit for the X role" — an
// inflated verdict on a weak/adjacent match. This neutralises the worst literal constructions
// into a neutral opener that references interest, not a self-graded fit, without rewriting the
// rest of the sentence. Asymmetric: only softens claims, never adds them.
export function softenOverpromise(text: string): string {
  return (text || '')
    // "I'm a strong fit for [the] X" / "I am a perfect match for X" → "I'm reaching out about [the] X"
    .replace(/\bI(?:'m|’m| am)\s+(?:a\s+)?(?:strong|perfect|ideal|great|excellent|natural)\s+(?:fit|match|candidate)\s+for\b/gi, "I’m reaching out about")
    // standalone "a strong/perfect/ideal fit/match" → "a good match"
    .replace(/\b(?:a\s+)?(?:strong|perfect|ideal)\s+(fit|match)\b/gi, 'a good $1')
    .replace(/\b(?:the\s+)?ideal candidate\b/gi, 'an interested candidate')
    .replace(/\bexactly what (?:you(?:'re|’re| are)|your team is) looking for\b/gi, 'keen to contribute')
    .replace(/[ \t]{2,}/g, ' ');
}

// Deterministic backstop for templated / banned-phrase openings. The prompt forbids "Dear Hiring
// Manager", "I am writing to express my interest", "I am excited/eager", etc., but a model will
// occasionally ignore it and emit a generic cover (observed: a thin-profile applicant got a full
// "Dear Hiring Manager, I am writing to express my interest… I am excited about…" template). This
// neutralizes the worst literal constructions deterministically — drops the pure-filler opener
// sentence and rewrites the banned enthusiasm verbs — so the rules are enforced by CODE, not just
// requested in the prompt. Asymmetric: only removes/softens, never adds claims.
export function softenTemplate(text: string): string {
  return (text || '')
    // Templated salutations → our neutral greeting
    .replace(/^\s*(?:Dear\s+(?:Hiring\s+Manager|Hiring\s+Team|Recruiter|Sir(?:\s+or\s+Madam)?|Madam)|To\s+Whom\s+It\s+May\s+Concern)\s*[,:]/i, 'Hi there,')
    // Pure-filler opener — adds nothing, screams template. Drop the whole sentence.
    .replace(/\bI(?:'m|’m| am)\s+writing\s+to\s+(?:express\s+(?:my\s+)?interest\s+in|apply\s+for)\b[^.!?]*[.!?]\s*/gi, '')
    // Banned enthusiasm verbs (prompt: never "I am excited/eager/confident") → neutral phrasing.
    // Covers present AND past tense (the model dodges "I am excited" with "I was excited to see…").
    .replace(/\bI\s+(?:was|have been)\s+(?:excited|thrilled|delighted)\s+to\s+(?:see|find|read|learn|come\s+across|discover)\b/gi, 'I noticed')
    .replace(/\bI(?:'m|’m| am| was| have been)\s+(?:excited|thrilled|delighted|eager)\s+to\b/gi, (m) => /\bwas\b|have been/i.test(m) ? 'I was glad to' : 'I’d be glad to')
    .replace(/\bI(?:'m|’m| am| was| have been)\s+(?:excited|thrilled|delighted|passionate)\s+(?:about|by|for)\b/gi, (m) => /\bwas\b|have been/i.test(m) ? 'I was drawn to' : 'I’m keen on')
    .replace(/\beager\s+to\b/gi, 'ready to')
    .replace(/\bI\s+believe\s+I\s+align\b/gi, 'my background aligns')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Deterministic verdict consumption. These read the matcher's matched/missing lists in CODE —
// the "wire" the generator was missing. A TECH-TOKEN boundary is used instead of \b, because \b
// does NOT work around punctuation skills (.NET, C#, C++ — '.', '#', '+' are not word chars, so
// \bC#\b / \b.NET\b never match). Here a skill must not be flanked by another token-forming char
// (letter, digit, '.', '#', '+'): "C#" matches in "deep C# work" but not inside "C#Sharp", and
// ".NET" matches alone but not inside "ASP.NET". stripSentencesWith removes any sentence that
// references a forbidden (missing) skill — the last-resort guarantee even if the model ignores
// the prompt (e.g. "transitioning to Golang"/"deep C# experience" on a role missing that core).
const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const skillRx = (skills: string[], flags = 'i') =>
  new RegExp(`(?<![A-Za-z0-9.#+])(?:${skills.filter((s) => s && s.trim().length >= 2).map((s) => escapeRx(s.trim())).join('|')})(?![A-Za-z0-9.#+])`, flags);
function mentionsAny(text: string, skills: string[]): string[] {
  return skills.filter((s) => s && s.trim().length >= 2 && skillRx([s]).test(text));
}
function stripSentencesWith(text: string, skills: string[]): string {
  const bad = skills.filter((s) => s && s.trim().length >= 2);
  if (!bad.length) return text;
  const rx = skillRx(bad);
  // Operate per line so greeting/sign-off/paragraph breaks survive; within a line drop only the
  // offending sentence(s).
  return text
    .split('\n')
    .map((line) => line.split(/(?<=[.!?])\s+/).filter((sent) => !rx.test(sent)).join(' '))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
// Integrity guard: after a strip, the email must still read as a real letter (a greeting/sign-off
// plus at least two substantive body sentences). If the strip gutted it, we must NOT ship a
// dangling fragment — the caller falls back to a safe honest stub.
function isSubstantiveLetter(text: string): boolean {
  const sentences = (text || '').replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/).filter((s) => s.trim().split(/\s+/).length >= 4);
  return sentences.length >= 2 && (text || '').trim().length >= 80;
}

// Quantified-claim provenance. Cover models love inventing round metrics ("over 1 million
// transactions monthly", "30% improvement") and parroting the JOB's own numbers back as the
// applicant's achievements — fabrication that collapses the moment a recruiter reads the attached
// résumé. findUnsourcedMetrics flags quantified claims whose figure is ABSENT from the applicant's
// real background, so the offending sentence can be dropped. Deliberately CONSERVATIVE: it only
// flags a claim when its number is wholly missing from the background (asymmetric — keep when
// unsure, NEVER strip a grounded figure, so honest keyword/metric overlap is preserved). Bare
// numbers that aren't scale/percentage claims (years of experience, version "11.1", "first 30
// days") are not matched at all.
const PERCENT_RX = /\b(\d[\d.]*)\s*(?:%|percent\b)/gi;
const MAGNITUDE_RX = /\b(?:over|under|more than|up to|nearly|about|around|~)?\s*(\d[\d,.]*)\s*(million|billion|thousand)\b/gi;
const SCALE_RX = /\b(\d[\d,.]*)\s*\+?\s*(?:transactions|requests|users|clients|customers|projects|sites|records|employees|people|members|developers|engineers|downloads|installs|orders|tickets)\b/gi;
export function findUnsourcedMetrics(text: string, background: string): string[] {
  const bg = (background || '').toLowerCase();
  const bgDigits = bg.replace(/[\s,]/g, '');
  const out: string[] = [];
  const digitsGrounded = (n: string) => {
    const d = n.replace(/[\s,]/g, '');
    return d.replace(/\.$/, '').length < 2 || bgDigits.includes(d.replace(/\.$/, '')); // <2 digits → too risky to judge → treat grounded
  };
  for (const m of text.matchAll(PERCENT_RX)) if (!digitsGrounded(m[1])) out.push(m[0]);
  // Magnitude word ("1 million"): the digit alone is meaningless, so require the WORD in background.
  for (const m of text.matchAll(MAGNITUDE_RX)) if (!bg.includes(m[2].toLowerCase())) out.push(m[0]);
  for (const m of text.matchAll(SCALE_RX)) if (!digitsGrounded(m[1])) out.push(m[0]);
  return [...new Set(out)];
}
// Drop any sentence containing a flagged phrase (literal substring). Mirrors stripSentencesWith's
// line-preserving shape but matches raw phrases, not skill tokens.
export function stripSentencesContaining(text: string, phrases: string[]): string {
  const needles = phrases.map((p) => p.toLowerCase().trim()).filter(Boolean);
  if (!needles.length) return text;
  return text
    .split('\n')
    .map((line) => line.split(/(?<=[.!?])\s+/).filter((sent) => !needles.some((n) => sent.toLowerCase().includes(n))).join(' '))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

// Pure verdict → honest-mode derivation. Exported so the EXACT prod logic is unit-testable.
// honest is true ONLY for a Weak label or a non-empty missingCore — so a Strong/Good verdict (or
// no verdict at all) yields honest=false, an empty honestBlock, and the generator runs its
// original path unchanged (no extra prompt, no strip).
export function buildHonestMode(verdict?: CoverLetterInput['verdict']): { honest: boolean; honestBlock: string; matchedSkills: string[]; forbidden: string[] } {
  const v = verdict;
  const missingCore = (v?.missingCore || []).map((s) => (s || '').trim()).filter(Boolean);
  const forbidden = Array.from(new Set([...missingCore, ...(v?.missing || []).map((s) => (s || '').trim()).filter(Boolean)]));
  const matchedSkills = (v?.matchedSkills || []).map((s) => (s || '').trim()).filter(Boolean);
  const honest = !!(v && (v.label === 'Weak' || missingCore.length > 0));
  const honestBlock = honest ? `

HONEST MODE — this is a PARTIAL / STRETCH match. Write truthfully; do NOT inflate:
- The applicant's VERIFIED skills relevant to this role are: ${matchedSkills.join(', ') || 'general transferable background only'}. Ground every role-specific technical claim in THESE and the applicant's real background — nothing else.
- The applicant does NOT have: ${forbidden.join(', ') || "the role's core requirements"}. NEVER name, claim, imply, or positively reference ANY of these — not even as "transitioning to", "a foundation for", "eager/keen to learn", "familiar with", or "exposure to". Do not mention them at all.
- No fitness verdicts. Lead with genuinely transferable strengths and let them stand on their own.` : '';
  return { honest, honestBlock, matchedSkills, forbidden };
}

// =========================================================================
// MAIN: Generate complete application email
// =========================================================================

/**
 * Generate a complete application email. AI gets ALL raw data and decides
 * everything: greeting, body, sign-off, what to mention, tone.
 */
export async function generateCoverLetter(input: CoverLetterInput): Promise<string> {
  const { jobTitle, jobDescription, companyName, userProfile, styleOverride } = input;
  const { client, model } = getAIClient();

  const skillsList = userProfile.skills.slice(0, 15).join(', ');
  // Feed more real material so the AI has concrete proof points to cite (the best-replying
  // letters are substantive ~700-1000 chars, not 100-word stubs).
  const experienceSnippet = (userProfile.resumeText || userProfile.experience || '').slice(0, 1500);

  // Randomize style + length to avoid pattern detection by recruiters receiving multiple applications
  const STYLES = [
    'Lead with the applicant\'s strongest achievement or a specific number/metric.',
    'Open with a question or observation about something specific in the job post.',
    'Start with a brief relevant story or anecdote from the applicant\'s experience.',
    'Begin with a direct, confident statement of fit — no preamble.',
    'React to one specific detail or requirement from the job description that genuinely excites.',
    'Open with what the applicant can deliver in the first 30 days.',
  ];
  const LENGTHS = [
    { label: 'concise', words: '80-100', paragraphs: '2 short' },
    { label: 'medium', words: '120-160', paragraphs: '2-3' },
    { label: 'detailed', words: '180-220', paragraphs: '3-4' },
  ];
  const style = STYLES[Math.floor(Math.random() * STYLES.length)];
  const length = LENGTHS[Math.floor(Math.random() * LENGTHS.length)];

  // Verdict-aware honest mode + deterministic missing-skill guarantee (the "wire").
  const { honest, honestBlock, matchedSkills, forbidden } = buildHonestMode(input.verdict);

  const buildSystem = (extra: string) => (styleOverride || `You are writing a job application email on behalf of someone. You receive ALL raw data about the job and the applicant. Write the COMPLETE email ready to send.

STYLE FOR THIS EMAIL: ${style}
LENGTH: ${length.label} — aim for ${length.words} words, ${length.paragraphs} paragraphs.

YOUR JOB:
1. Figure out who to address — look ONLY at the recruiter email local-part (before the @) and any explicit name in the job description or signature. If a real first name is clearly present THERE, greet them by it. If it is NOT clearly present, write exactly "Hi there,". NEVER invent, guess, or default to a placeholder human name (do NOT write "Hi Sarah", "Hi John", or any name you are not certain of) — when unsure, you MUST use "Hi there,". NEVER output a literal bracket placeholder like [Name], [Recruiter], [Company], [LinkedIn] or [Your Name] — fill it with the real value or leave it out.
2. Figure out the company — from the description, email domain, poster info, anything. Mention it.
3. FOLLOW THE STYLE INSTRUCTION ABOVE for the opening. NEVER default to "I saw the [role] at [company] and was interested" / "I noticed your post for". The first sentence must feel hand-written, not templated.
4. Give 1-2 CONCRETE proof points from the applicant's real background — a relevant project, result, or number. ONLY real things from the profile — NEVER invent.
5. End with a soft call to action.
6. Sign off with the applicant's name.

RULES:
- OUTPUT ONLY THE EMAIL ITSELF: greeting → 2-3 short body paragraphs → sign-off with the name. NEVER paste the résumé, an experience/education/skills list, contact blocks, phone numbers, links, or any raw profile data into the email. The Background you were given is reference material to mine ONE-TWO facts from — it must NOT appear in the output.
- NO unfilled placeholders in the output (no "[...]"). If you don't know a value, omit it.
- LEAD WITH THE APPLICANT'S STRONGEST GENUINE MATCH. NEVER mention a skill/technology the job asks for that the applicant does NOT have. Do not write "you need X — I have Y": that highlights the gap. If the overlap is partial, focus on the transferable strengths and never apologise for or draw attention to what's missing.
- NO OVER-PROMISING. NEVER use the phrases "strong fit", "perfect fit", "ideal fit/candidate", "exactly what you're looking for", "I'm a great match", or any global self-assessment of fitness. Do NOT assert mastery of the role's core domain, nor experience/proficiency in any tool, domain, or industry that is NOT present in the applicant's Background/Skills. Open by referencing real work the applicant has DONE (not a verdict on how well they fit) — describe what they've built and let it stand on its own. Honest and specific beats confident and inflated.
- NEVER INVENT NUMBERS. Do not fabricate statistics, metrics, volumes, percentages, team sizes, or money amounts ("over 1 million transactions monthly", "improved performance by 30%", "team of 20"). State a figure ONLY if it literally appears in the applicant's Background. When in doubt, describe the work qualitatively with no number.
- NEVER ECHO THE JOB POST AS THE APPLICANT'S OWN WORK. The job description tells you what they NEED, not what the applicant has done. Every proof point must come from the applicant's Background, never from the job post — do not restate the role's responsibilities (its tools, systems, or tasks) as things the applicant has already built, not even in paraphrase. If the applicant hasn't done it, don't narrate doing it.
- ALWAYS write in FIRST PERSON (I/my/me). NEVER use third person or refer to the applicant by name in the body. "I have experience" NOT "John has experience".
- NEVER say "I am excited", "I am eager", "I am confident", "I am writing to express interest", "I believe I align".
- Sound like a real person writing a confident, specific note to someone they want to work with — not a template.
- Follow the LENGTH instruction above (${length.label}: ${length.words} words, ${length.paragraphs} paragraphs). Never pad with filler.
- Include line breaks between greeting, body paragraphs, and sign-off.`) + honestBlock + extra;

  const userContent = `=== JOB POST ===
Title: ${jobTitle}
Description: ${jobDescription.slice(0, 800)}
Recruiter email: ${(userProfile as any).recruiterEmail || 'unknown'}
Company/poster: ${companyName}

=== APPLICANT ===
Name: ${userProfile.name}
Skills: ${skillsList}
Languages: ${userProfile.languages?.join(', ') || 'Not specified'}
Background: ${experienceSnippet}
${userProfile.workPreference ? `Work preference: ${userProfile.workPreference}` : ''}
${userProfile.bookingUrl ? `Booking: ${userProfile.bookingUrl}` : ''}
${userProfile.caseStudies?.length ? `Portfolio: ${userProfile.caseStudies.map(p => `${p.title}${p.url ? ` (${p.url})` : ''}`).join(', ')}` : ''}

Write the complete email now.`;

  const gen = async (extra: string): Promise<string> => {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.85,
      max_tokens: 500,
      messages: [
        { role: 'system', content: buildSystem(extra) },
        { role: 'user', content: userContent },
      ],
    });
    return (response.choices[0]?.message?.content || '').trim();
  };

  try {
    let content = await gen('');
    // Substantive-output guard on the PRIMARY path. The model occasionally returns a degenerate
    // fragment instead of a letter — a bare headline/résumé line like "Quality control manual with
    // 3 years of experience" or "Hola Mi nombre es Edwin Plaza DBA Senior". Empty was the only thing
    // caught before; the isSubstantiveLetter check lived solely in the missing-skill strip branch,
    // so any clean Good/Strong match (empty forbidden list) shipped the stub verbatim. Retry once
    // demanding the full email, then fall back to a real honest stub rather than send a fragment.
    if (!isSubstantiveLetter(content)) {
      const retry = await gen('\n\nIMPORTANT: Output the COMPLETE email — a greeting line, 2-3 body paragraphs grounded in the applicant\'s real background, and a sign-off with the name. Do NOT output a single sentence, a headline, a résumé line, or a profile fragment.');
      content = isSubstantiveLetter(retry)
        ? retry
        : `Hi there,\n\nI'd welcome the chance to be considered for the ${jobTitle} role — my background in ${(matchedSkills.length ? matchedSkills : userProfile.skills).slice(0, 3).join(', ') || 'closely related work'} lines up well, and I'd be glad to share how it could help your team.\n\n${userProfile.name}`;
    }
    // Deterministic verdict consumption (the "wire"): a missing skill must not appear positively.
    // One hard-ban regeneration, then a last-resort sentence strip — enforced by CODE reading the
    // matched/missing lists. Runs on EVERY letter with a non-empty missing list (forbidden =
    // missingCore ∪ missing), NOT only in honest mode: a Good match can still falsely claim a
    // missing non-core skill (e.g. "designing distributed systems" when Distributed Systems is
    // missing), and honest mode (Weak/coreMissing only) would never catch it. Tone is gated on
    // honest; the strip is universal.
    if (forbidden.length) {
      const hit = mentionsAny(content, forbidden);
      if (hit.length) {
        const retry = await gen(`\n\nCRITICAL: your previous draft mentioned ${hit.join(', ')}, which the applicant does NOT have. Rewrite the entire email WITHOUT referencing ${hit.join(', ')} in any form.`);
        if (retry && !mentionsAny(retry, forbidden).length) {
          content = retry; // clean rewrite — keep it whole
        } else {
          // Model still leaked: strip the offending sentence(s). If that guts the letter, fall
          // back to a safe honest stub rather than ship a dangling fragment.
          const stripped = stripSentencesWith(retry || content, forbidden);
          content = isSubstantiveLetter(stripped)
            ? stripped
            : `Hi there,\n\nI'd welcome the chance to be considered for the ${jobTitle} role — my background in ${matchedSkills.slice(0, 3).join(', ') || 'closely related work'} lines up well, and I'd be glad to share how it could help your team.\n\n${userProfile.name}`;
        }
      }
    }
    // Number-provenance + anti-fabrication (the "1 million transactions" / JD-echo guard). Read the
    // applicant's FULL background and drop any quantified claim whose figure isn't there. One retry
    // that forbids invented figures, then a literal sentence strip, then the substantive fallback.
    // Preserves grounded metrics and honest keyword overlap; only the fabricated figures go.
    const backgroundText = `${userProfile.resumeText || userProfile.experience || ''} ${userProfile.skills.join(' ')}`;
    let unsourced = findUnsourcedMetrics(content, backgroundText);
    if (unsourced.length) {
      const retry = await gen(`\n\nCRITICAL: your previous draft used figures NOT in the applicant's background (${unsourced.slice(0, 3).join('; ')}). Do NOT invent statistics, metrics, transaction volumes, percentages, team sizes, or money amounts — state a number ONLY if it literally appears in the Background. Do NOT describe the job post's own responsibilities as things the applicant has already done. Rewrite grounded only in the applicant's real background.`);
      const retryBad = retry ? findUnsourcedMetrics(retry, backgroundText) : [];
      if (retry && !retryBad.length && isSubstantiveLetter(retry)) {
        content = retry; // clean rewrite — keep it whole
      } else {
        const base = retry || content;
        const stripped = stripSentencesContaining(base, retryBad.length ? retryBad : unsourced);
        content = isSubstantiveLetter(stripped)
          ? stripped
          : `Hi there,\n\nI'd welcome the chance to be considered for the ${jobTitle} role — my background in ${(matchedSkills.length ? matchedSkills : userProfile.skills).slice(0, 3).join(', ') || 'closely related work'} lines up well, and I'd be glad to share how it could help your team.\n\n${userProfile.name}`;
      }
    }
    return softenTemplate(softenOverpromise(content));
  } catch (error) {
    // FAIL CLOSED when the provider is down / out of balance: propagate so the matcher skips this
    // pairing and retries later, instead of emailing a recruiter a generic blind template.
    if (isAiUnavailable(error)) throw error;
    console.error('[CoverLetterGenerator] AI generation failed:', error);
    // Minimal fallback (transient/other non-availability errors only)
    const topSkills = userProfile.skills.slice(0, 3).join(', ');
    return `Hi there,\n\nI saw your post for ${jobTitle}. I have experience with ${topSkills} and would love to discuss how I can help. Happy to chat anytime.\n\n${userProfile.name}`;
  }
}

/**
 * Generate a subject line for the application email.
 */
export async function generateSubjectLine(params: {
  jobTitle: string;
  userName: string;
}): Promise<string> {
  const { jobTitle, userName } = params;
  const { client, model } = getAIClient();

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.5,
      max_tokens: 50,
      messages: [
        {
          role: 'system',
          content: 'Generate a short professional email subject line for a job application. Max 60 chars. Return ONLY the subject line, nothing else. Do NOT use "Application:" prefix — make it sound like a reply to their post.',
        },
        { role: 'user', content: `Role: ${jobTitle}, Applicant: ${userName}` },
      ],
    });

    let content = response.choices[0]?.message?.content?.trim();
    if (!content) return `${jobTitle} — ${userName}`;
    content = content.replace(/^["']|["']$/g, '');
    // Remove AI placeholders
    content = content.replace(/\[Company Name\]/gi, '').replace(/\[Your Name\]/gi, userName).replace(/\s{2,}/g, ' ').trim();
    return content;
  } catch {
    return `${jobTitle} — ${userName}`;
  }
}

/**
 * Generate a follow-up email.
 */
export async function generateFollowUp(params: {
  jobTitle: string;
  companyName: string;
  userName: string;
  daysSinceSent: number;
}): Promise<string> {
  const { jobTitle, companyName, userName, daysSinceSent } = params;
  const { client, model } = getAIClient();

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.6,
      max_tokens: 200,
      messages: [
        {
          role: 'system',
          content: 'Write a complete short follow-up email (greeting + 2 sentences + sign-off). Polite bump, not pushy. Under 50 words.',
        },
        { role: 'user', content: `Role: ${jobTitle} at ${companyName}, Applicant: ${userName}, Sent ${daysSinceSent} days ago` },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (content) return content;
  } catch (error) {
    console.error('[CoverLetterGenerator] Follow-up generation failed:', error);
  }

  return `Hi there,\n\nJust bumping my note about the ${jobTitle} role. Still very interested — happy to hop on a quick call whenever works.\n\n${params.userName}`;
}
