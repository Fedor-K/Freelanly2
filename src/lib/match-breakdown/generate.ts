// Recruiter match-breakdown engine. INVARIANT: no line exists without a trace to source.
//   LLM does only two things: (1) parse the JD into typed must-have requirements, (2) write
//   the summary prose. CODE asserts: verify-on-JD (#1), verify-in-CV (#2 via verify.ts), and
//   token-identity (requirement == evidence) collapses "satisfies" (#3).
// Only HARD-VERIFIABLE types get a status (skill / language). Years & location are SOFT
// context (no status, not in X/Y). "X or equivalent" is modelled as an ANY-OF group: a match
// of ANY enumerated member = full; if equivalents can't be safely named, the requirement is
// DROPPED (never reduced to the example — that would assert a requirement the JD didn't make).
import OpenAI from 'openai';
import { verifySkill, type VerifyResult } from './verify';

const AI_PROVIDER = (process.env.AI_PROVIDER || 'zai').toLowerCase();
function aiClient(): OpenAI {
  return AI_PROVIDER === 'zai'
    ? new OpenAI({ baseURL: 'https://api.z.ai/api/paas/v4', apiKey: process.env.ZAI_API_KEY || '' })
    : new OpenAI({ baseURL: 'https://api.z.ai/api/paas/v4', apiKey: process.env.ZAI_API_KEY || '' });
}
const MODEL = AI_PROVIDER === 'zai' ? 'glm-4-32b-0414-128k' : 'glm-4-32b-0414-128k';

type SkillReq = { display: string; anyOf: string[]; core?: boolean }; // anyOf = atomic tool names; match ANY = full. core = defines the role (Layer 2)

// INFRA / GENERIC TOOLING — present in almost every modern role, so NEVER role-defining. The LLM
// is told this in the prompt but violates it (marked Docker core on a Full Stack role, collapsing
// two different candidates to an identical Weak). This deterministic guard is the backstop: any
// member here is force-demoted to core=false regardless of what parseJD returned. Match is on the
// atomic anyOf members (lowercased), so "Docker" the requirement is caught, "Dockerized X" isn't.
const INFRA_TOOLS = new Set([
  'docker', 'kubernetes', 'k8s', 'git', 'github', 'gitlab', 'bitbucket', 'linux', 'unix', 'bash',
  'shell', 'jenkins', 'ci/cd', 'cicd', 'jira', 'confluence', 'agile', 'scrum', 'maven', 'gradle',
  'npm', 'yarn', 'webpack', 'nginx', 'apache', 'vim', 'vs code', 'postman', 'yaml', 'json', 'xml',
  // IaC / config-mgmt / observability tooling — generic across cloud roles, core ONLY when named
  // in the title (title-anchor re-adds it). Demoting these stops e.g. Terraform being marked the
  // core of an "AWS Support Engineer" role whose real core is AWS + CI/CD.
  'terraform', 'terragrunt', 'ansible', 'puppet', 'chef', 'helm', 'cloudformation', 'pulumi',
  'prometheus', 'grafana', 'datadog', 'splunk',
]);
const isInfra = (req: SkillReq): boolean =>
  req.anyOf.every((m) => INFRA_TOOLS.has(m.toLowerCase().trim())) ||
  INFRA_TOOLS.has(req.display.toLowerCase().trim());

// TITLE-ANCHOR — a skill literally named in the job TITLE IS the role, so it is core by definition,
// and this OVERRIDES infra-demotion (Kubernetes on "Kubernetes Platform Engineer" / Azure DevOps on
// its own title must stay core; the blanket infra guard would wrongly strip them). Lexical, same
// deterministic verifier used everywhere — no LLM, asymmetric (only PROMOTES, never invents).
const inTitle = (req: SkillReq, title: string): boolean =>
  !!title && (verifySkill(req.display, title).found || req.anyOf.some((m) => verifySkill(m, title).found));
export type ParsedJD = { skills: SkillReq[]; languages: string[]; years?: number | null; location?: string | null };
export type Line = { label: string; type: 'skill' | 'language'; status: 'full' | 'missing'; evidence: string | null; source: 'cv' | 'profile' | 'inferred' | null; core?: boolean; viaAlias?: boolean; viaCollapse?: boolean; viaSemantic?: boolean; anyOfSize?: number; member?: string; searched?: string[] };
export type Rejected = { side: 'jd'; type: string; label: string };
export type Breakdown = {
  lines: Line[];
  matched: number; total: number;
  yearsContext: string | null;
  locationContext: string | null;
  summary: string | null;
  rejected: Rejected[];
  fallback: boolean;
  salaryContext: string | null;   // SOFT (self-reported), no status, not in X/Y; decayed if stale
};

// (1) LLM → typed requirements. Atomic tokens, any-of for "or equivalent", no invented reqs.
// Exported so the send-path can parse a JD ONCE per opportunity and reuse across candidates.
export async function parseJD(jdText: string, title?: string): Promise<ParsedJD> {
  // Title drives the deterministic core-anchor. Caller may pass it; else take the first non-empty
  // line of the post (job posts lead with the title). Bounded so a wall-of-text first line can't
  // turn every skill core.
  const titleLine = (title || jdText.split('\n').map((l) => l.trim()).find(Boolean) || '').slice(0, 140);
  const r = await aiClient().chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: `Extract ONLY explicit must-have requirements from this job post. Return JSON:
{"skills":[{"display":"string","anyOf":["atomic tool name", ...],"core":true|false}],"languages":["English"],"years":number|null,"location":"string|null"}
RULES:
- ALTERNATIVES vs CHECKLIST — read the conjunction, it changes everything:
  • ALTERNATIVES (candidate needs only ONE) — items joined by "or"/"either" ("Node.js, Java, or Python"; "AWS, GCP or Azure"), OR a parenthetical/example list after a category ("enterprise platforms (SAP, Oracle, Microsoft Dynamics)", "AWS (Lambda, S3, RDS)", "a relational DB (Postgres, MySQL)"). Emit ONE skill: display = the category or "A/B/C", anyOf = [every alternative]. NEVER split these — splitting invents requirements the post didn't make (and falsely marks the unchosen alternative as missing). CRITICAL: when the CATEGORY itself is a concrete named technology ("AWS (Lambda, S3)", "Azure (Functions)"), INCLUDE the category in anyOf too → anyOf:["AWS","Lambda","S3"], so a candidate who lists the platform generically still matches. Only when the category is a generic noun ("platforms", "a database", "a language") is it left out of anyOf.
  • CHECKLIST (all are needed) — distinct tools/competencies joined by "and"/"&" or a plain comma list of a required stack ("Python, pandas, scikit-learn"; "React and Node.js"; "UX Research & User-Centered Design" → "UX Research" + "User-Centered Design"). SPLIT into separate skills so each is matched on its own.
  • The tell: "or"/"either"/a category-then-examples parenthetical ⇒ anyOf; "and"/plain required stack ⇒ split.
- Each CHECKLIST skill = ONE concrete tool/technology/competency literally named. Max 5 skills, most important first.
- PRIORITIZE the role-defining stack (the language/framework/domain the job is ABOUT — usually named in the TITLE or the dominant theme) OVER generic tooling. If the post lists both a stack (e.g. React, Node.js) and tooling (Docker, Git, Linux, CI/CD, Jira), the stack comes first and the tooling must NOT crowd it out of the 5 slots. A "Full Stack" / "Software Engineer" title with no concrete stack in the body → extract whatever stack IS named; do NOT pad the list with tooling alone.
- "core": set true ONLY for the 1-2 skills that DEFINE the role — named in the job TITLE, or explicitly "mandatory"/"must-have"/"required", or the dominant theme of the responsibilities. Everything else core=false. (e.g. for "Senior Software Engineer with AI/ML", AI/ML is core; for "Java Full Stack", Java is core.) NEVER mark generic infra/tooling as core — Docker, Kubernetes, Git, Linux, Bash, CI/CD, Jenkins, Jira, YAML, npm/maven/gradle, nginx are present in almost every role and are NEVER role-defining, even if a thin post mentions only them.
- "anyOf" = atomic tool names (each a single tool, never a phrase/clause). For a plain single skill, anyOf is just [that skill]; for an ALTERNATIVES requirement, anyOf lists EVERY option ("Node.js, Java, or Python" → {"display":"Node.js/Java/Python","anyOf":["Node.js","Java","Python"],"core":true}; "platforms (SAP, Oracle, Dynamics)" → {"display":"enterprise platform integration","anyOf":["SAP","Oracle","Microsoft Dynamics"]}).
- For "X or equivalent / or similar" requirements: set anyOf to the concrete equivalents you are CONFIDENT are real (e.g. {"display":"experiment tracking","anyOf":["MLflow","Weights & Biases","Neptune","Comet"]}). If you cannot name real equivalents, OMIT the requirement entirely. NEVER reduce "X or equivalent" to just X.
- "languages" = spoken languages ONLY if the post explicitly requires them. Do NOT add English by default.
- "years" = minimum years if explicitly stated, else null. "location" = required country/timezone if stated, else null.
- Do NOT extract the bare JOB TITLE / role name itself as a skill — it is the occupation, matched separately, not a verifiable competency. For an "Oracle DBA" role extract the concrete skills (Oracle, RAC, Data Guard, RMAN, performance tuning), NOT "Oracle DBA"; for a "Scrum Master" role extract Scrum, SAFe, Jira — NOT "Scrum Master". Extracting the role label as a skill falsely marks a candidate who clearly IS that role as missing it.
- Do NOT extract VAGUE / GENERIC competencies as verifiable skills — "understanding of X", "knowledge of X", "X methodologies / principles / fundamentals / best practices / concepts", "familiarity with X". These aren't concrete tools and aren't lexically verifiable; they're implied by doing the job, so extracting them falsely marks an experienced candidate as missing the basics (e.g. an 11-year QA "missing software testing methodologies"). Extract the CONCRETE skill if one is named ("manual testing", "Selenium"); otherwise drop the requirement.
- Do NOT invent or infer requirements not in the text. Do NOT include soft/vague traits (leadership, team player, fast learner). JSON only.` },
      { role: 'user', content: jdText.slice(0, 4000) },
    ],
    temperature: 0,
    max_tokens: 500,
  });
  const m = (r.choices[0]?.message?.content || '').match(/\{[\s\S]*\}/);
  if (!m) return { skills: [], languages: [] };
  try {
    const p = JSON.parse(m[0]);
    const skills: SkillReq[] = (Array.isArray(p.skills) ? p.skills : [])
      .map((s: unknown): SkillReq | null => {
        if (typeof s === 'string') return { display: s, anyOf: [s] };
        const o = s as { display?: string; anyOf?: unknown; core?: unknown };
        const anyOf = (Array.isArray(o.anyOf) ? o.anyOf : []).map(String).map((x) => x.trim()).filter(Boolean).slice(0, 5);
        if (!anyOf.length) return null;
        const req: SkillReq = { display: (o.display || anyOf[0]).trim(), anyOf, core: o.core === true };
        if (req.core && isInfra(req)) req.core = false;     // demote generic infra/tooling…
        if (inTitle(req, titleLine)) req.core = true;       // …unless it IS the role (named in the title) — title wins
        return req;
      })
      .filter((s: SkillReq | null): s is SkillReq => !!s)
      .slice(0, 5);
    return {
      skills,
      languages: (Array.isArray(p.languages) ? p.languages : []).map(String),
      years: typeof p.years === 'number' ? p.years : null,
      location: typeof p.location === 'string' ? p.location : null,
    };
  } catch { return { skills: [], languages: [] }; }
}

// verify-on-JD (#1): requirement is real only if at least one of its tokens is literally in the JD.
function anyInJD(tokens: string[], jdText: string): boolean {
  return tokens.some((t) => verifySkill(t, jdText, []).found);
}

export type GenInput = {
  jdText: string; cvText: string; jobTitle?: string; // jobTitle drives the deterministic core-anchor
  candidateSkills: string[]; candidateLanguages: string[];
  candidateTitle?: string | null; // candidate headline/role ("SAFe Agile Facilitator", "… | DBA") — keyword-dense, verifiable evidence
  candidateYears?: number | null; candidateLocation?: string | null;
  candidateSalary?: string | null; candidateSalaryAt?: string | null; // self-reported "1500/mo" + when
};

export async function generateBreakdown(inp: GenInput): Promise<Breakdown> {
  const jd = await parseJD(inp.jdText, inp.jobTitle);
  return buildBreakdown(jd, inp);
}

// Pure, synchronous, no LLM — code-only verification. Safe to call per-candidate with a JD
// parsed once per opportunity (the LLM cost lives in parseJD).
// A short headline ("SAFe Agile Facilitator", "Senior Database Specialist | DBA") is legitimate,
// keyword-dense self-description we DO want as evidence. But a buzzword-stuffed LinkedIn headline
// ("Architect | Azure | AWS | GCP | Devops | FullStack | Reactjs | Angular | …") is a keyword list,
// not proof of experience — searching it phantom-matches requirements (a Java/.NET dev gets a
// false "Azure DevOps ✓"). So when the title is many short segments, keep ONLY the leading role
// phrase; the structured skills array remains the real evidence for the dropped tokens.
function titleForEvidence(title?: string | null): string {
  const t = (title || '').trim();
  if (!t) return '';
  const segs = t.split(/\s*[|•·/]\s*/).map((s) => s.trim()).filter(Boolean);
  return segs.length >= 4 ? segs[0] : t;
}

export function buildBreakdown(jd: ParsedJD, inp: GenInput): Breakdown {
  const rejected: Rejected[] = [];
  const lines: Line[] = [];
  // Skill evidence = CV text + structured skills + the candidate's (de-buzzworded) headline.
  const haystackSkills = `${inp.cvText} ${inp.candidateSkills.join(' , ')} ${titleForEvidence(inp.candidateTitle)}`;

  // SKILLS — any-of group, token-identity (no paraphrase → no #3)
  for (const req of jd.skills) {
    if (!anyInJD(req.anyOf, inp.jdText)) { rejected.push({ side: 'jd', type: 'skill', label: req.display }); continue; } // #1
    let hit: VerifyResult | null = null; let hitMember = '';
    for (const member of req.anyOf) {
      const v = verifySkill(member, haystackSkills, inp.candidateSkills);
      if (v.found) { hit = v; hitMember = member; break; }
    }
    if (hit) {
      lines.push({ label: req.display, type: 'skill', status: 'full', evidence: hit.matched || hitMember, source: 'cv', core: req.core === true,
        viaAlias: (hit.matched || '').toLowerCase() !== hitMember.toLowerCase(), viaCollapse: hit.via === 'collapse', anyOfSize: req.anyOf.length, member: hitMember, searched: req.anyOf });
    } else {
      lines.push({ label: req.display, type: 'skill', status: 'missing', evidence: null, source: null, core: req.core === true, anyOfSize: req.anyOf.length, searched: req.anyOf });
    }
  }

  // LANGUAGES — only if explicitly in JD (verify-on-JD), then verified against candidate languages
  for (const raw of jd.languages.slice(0, 3)) {
    const label = raw.trim();
    if (!label) continue;
    if (!anyInJD([label], inp.jdText)) { rejected.push({ side: 'jd', type: 'language', label }); continue; }
    const v = verifySkill(label, inp.candidateLanguages.join(' , '), inp.candidateLanguages);
    lines.push({ label, type: 'language', status: v.found ? 'full' : 'missing', evidence: v.found ? (v.matched || label) : null, source: v.found ? 'profile' : null, member: v.found ? label : undefined, searched: [label] });
  }

  const matched = lines.filter((l) => l.status === 'full').length;
  const total = lines.length;

  let yearsContext: string | null = null;
  if (inp.candidateYears && inp.candidateYears > 0)
    yearsContext = `~${Math.round(inp.candidateYears)} yrs experience` + (jd.years ? ` (role asks ${jd.years}+)` : '');
  let locationContext: string | null = null;
  if (inp.candidateLocation && jd.location) locationContext = `${inp.candidateLocation} · role: ${jd.location}`;

  // SALARY — soft, self-reported. Never statused, never in X/Y. Decay stale self-reports (>90d).
  let salaryContext: string | null = null;
  if (inp.candidateSalary) {
    const ageMs = inp.candidateSalaryAt ? Date.now() - new Date(inp.candidateSalaryAt).getTime() : Infinity;
    const stale = ageMs > 90 * 24 * 3600 * 1000;
    salaryContext = `expects $${inp.candidateSalary}` + (stale ? ' (stated earlier — may be outdated)' : '');
  }

  // Fallback ONLY for thin data (nothing verifiable) — NEVER to hide a weak-but-honest match.
  const fallback = total < 1;

  return { lines, matched, total, yearsContext, locationContext, salaryContext, summary: null, rejected, fallback };
}
