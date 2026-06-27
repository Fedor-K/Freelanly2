// Lexical, deterministic evidence verifier for the recruiter match breakdown.
// HARD RULE: this is the JUDGE — it decides whether a skill/phrase actually appears in the
// candidate's CV. It is purely lexical (normalize + alias + token boundaries). NO embeddings,
// NO semantic similarity here — semantic is allowed only upstream to PROPOSE spans, never to
// pass them. Asymmetric by design: when unsure, return NOT FOUND (a dropped true match is far
// cheaper than a confident false claim a recruiter pays for).

// Canonical skill -> safe variants. Only ADD an alias if it can't collide inside other words.
// k8s↔kubernetes is safe; short/ambiguous names are handled by AMBIGUOUS below (no aliasing).
// NOTE: alias VALUES must never be short/ambiguous (js, ts, ml, go, r, c…). The AMBIGUOUS
// guard below protects ambiguous INPUT skills, but an ambiguous alias VALUE is a backdoor:
// e.g. javascript:['js'] would assert JavaScript off a bare "js" token inside "React js".
// Pass B caught exactly that. So: no short tokens as alias values — accept the false-neg.
// SYNONYM GROUPS — every member is equivalent (BIDIRECTIONAL): verifying any member matches any
// other present in the candidate. Fixes the one-directional-alias bug where requirement "RESTful
// API" missed candidate "REST APIs". Keep members safe (no short/ambiguous tokens as members).
const SYN_GROUPS: string[][] = [
  ['kubernetes', 'k8s'],
  ['postgresql', 'postgres', 'psql'],
  ['react', 'reactjs', 'react.js', 'react js'],
  ['react native', 'reactnative'],
  ['vue', 'vue.js', 'vuejs', 'vue js'],
  ['angular', 'angularjs', 'angular.js', 'angular js'],
  ['node.js', 'nodejs', 'node js'],
  ['express', 'express.js', 'expressjs', 'express js'],
  ['ci/cd', 'cicd', 'ci cd', 'continuous integration'],
  ['rest api', 'restful api', 'rest apis', 'restful apis', 'restful', 'rest services', 'restful web services', 'apis rest', 'api rest'],
  ['microservices', 'microservices architecture', 'micro-services', 'microservice', 'arquitectura de microservicios'],
  ['asp.net core', 'asp.net', 'aspnet core', 'aspnet', 'asp net core', 'asp net'],
  ['javascript', 'java script'],
  ['typescript', 'type script'],
  // SPOKEN LANGUAGES (translation vertical). A "Chinese" requirement must match a candidate who
  // lists "Mandarin"; etc. normText now FOLDS accents (español→espanol, inglés→ingles), so the
  // localized spellings below ARE valid members (previously español→"espa ol" broke them).
  // Native-speaker phrasing ("native Spanish") already matches; this closes the synonym gap.
  ['chinese', 'mandarin', 'putonghua'],
  ['english', 'ingles'],
  ['spanish', 'castilian', 'castellano', 'espanol'],
  ['german', 'deutsch', 'aleman'],
  ['french', 'francais'],
  ['portuguese', 'portugues'],
  ['italian', 'italiano'],
  ['dutch', 'flemish'],
  ['persian', 'farsi'],
  ['filipino', 'tagalog'],
  // CROSS-LANGUAGE SKILL SYNONYMS. The candidate pool is heavily LATAM and lists skills in
  // Spanish; an English requirement must match the Spanish form. Members are accent-folded.
  ['data visualization', 'data visualisation', 'visualizacion de datos', 'data viz'],
  ['data analysis', 'analisis de datos'],
  // UX research / user-centered design — the same competency under many labels; a "User Research"
  // candidate must match a "UX Research & User-Centered Design" requirement.
  ['ux research', 'user research', 'user research & analysis', 'user-centered design', 'user centered design', 'user-centred design', 'user centric design', 'user-centric design', 'user centered'],
  ['oracle dba', 'oracle database administrator', 'oracle database administration', 'administracion de bases de datos oracle', 'dba oracle'],
  ['spring framework', 'spring boot', 'springboot', 'spring', 'spring mvc', 'spring web mvc', 'spring data'],
  // architecture / integration families — generic competencies named under many forms (caught by the
  // false-negative audit: a MuleSoft 'API-Led Connectivity / Middleware Integration' dev rejected for
  // a 'Solution Architecture / Integration' core they clearly do).
  ['solution architecture', 'solutions architect', 'software architecture', 'enterprise architecture', 'system architecture', 'arquitectura de software'],
  ['integration', 'system integration', 'systems integration', 'api integration', 'middleware integration', 'api-led connectivity', 'enterprise integration', 'integraciones', '3rd party integration', 'third party integration'],
  // VENDOR-PREFIXED PRODUCTS — a requirement "AWS Redshift" must match a candidate who lists the
  // bare product "Redshift". Only UNAMBIGUOUS product names (no other meaning) — NOT "AWS Lambda"
  // (lambda is ambiguous) or "Azure DevOps" (DevOps is generic), which would cause false matches.
  ['aws redshift', 'redshift'],
  ['google bigquery', 'bigquery', 'big query'],
  ['amazon dynamodb', 'dynamodb'],
  ['azure synapse', 'synapse analytics', 'synapse'],
  ['project management', 'gestion de proyectos'],
  ['databases', 'bases de datos'],
  ['software development', 'desarrollo de software'],
  ['web development', 'desarrollo web'],
];
// member -> its full group (so any phrasing of a skill expands to all phrasings)
const SYN = new Map<string, string[]>();
for (const g of SYN_GROUPS) for (const m of g) SYN.set(m, g);

// IMPLICATIONS — a candidate who has KEY provably has each VALUE (one-directional). e.g. Flutter
// ⇒ Dart, Spring Boot ⇒ Java. Lets a required skill match when the candidate lists only the
// framework that necessarily includes it. Values must be safe (non-ambiguous) tokens.
const IMPLIES: Record<string, string[]> = {
  'flutter': ['dart'],
  'spring boot': ['java', 'spring'],
  'spring': ['java'],
  'spring mvc': ['java', 'spring'],
  'hibernate': ['java'],
  'j2ee': ['java'],
  'jsp': ['java'],
  'react native': ['react'],
  'next.js': ['react'],
  'nextjs': ['react'],
  'nestjs': ['node.js'],
  'express': ['node.js'],
  'express.js': ['node.js'],
  'django': ['python'],
  'flask': ['python'],
  'fastapi': ['python'],
  'pandas': ['python'],
  'numpy': ['python'],
  'laravel': ['php'],
  'symfony': ['php'],
  'rails': ['ruby'],
  'ruby on rails': ['ruby'],
  'asp.net': ['.net', 'c#'],
  'asp.net core': ['.net', 'c#'],
  '.net core': ['.net'],
  'entity framework': ['.net'],
  'angular': ['typescript', 'javascript'],
  // TypeScript is a strict superset of JavaScript, and these run ON JavaScript — having any of
  // them proves JS (one-directional: a JS-only candidate does NOT imply TypeScript). Fixes the
  // false "Missing CORE: JavaScript" for a TS/React/Node candidate.
  'typescript': ['javascript'],
  'react': ['javascript'],
  'reactjs': ['javascript'],
  'react.js': ['javascript'],
  'node.js': ['javascript'],
  'nodejs': ['javascript'],
  'vue': ['javascript'],
  'vue.js': ['javascript'],
  'jquery': ['javascript'],
  // Any concrete SQL database proves SQL (one-directional). Fixes false "Missing CORE: SQL" for
  // candidates who list MySQL/PostgreSQL/Oracle/etc. but not the bare token "SQL".
  'mysql': ['sql'],
  'postgresql': ['sql'],
  'postgres': ['sql'],
  'oracle': ['sql'],
  'sql server': ['sql'],
  'mssql': ['sql'],
  't-sql': ['sql'],
  'pl/sql': ['sql'],
  'plsql': ['sql'],
  'mariadb': ['sql'],
  'sqlite': ['sql'],
};
// implied skill -> [keys that prove it]
const IMPLIED_BY = new Map<string, string[]>();
for (const [k, vals] of Object.entries(IMPLIES)) for (const v of vals) {
  const a = IMPLIED_BY.get(v) || []; a.push(k); IMPLIED_BY.set(v, a);
}

// Short / ambiguous skill names = false-positive mines ("Go" in "going", "R"/"C" everywhere).
// Matched ONLY as an exact standalone token, never aliased, never as a substring/phrase.
const AMBIGUOUS = new Set(['go', 'js', 'ts', 'ai', 'ml', 'qa', 'bi']);

// Tokens where even a standalone-token match is a false-positive mine, so they assert ONLY via a
// disambiguating CONTEXT (regex over the haystack) OR an exact entry in the candidate's parsed
// skills array — never off the bare token. Single letters (r/c/d) appear in every CV (R&D,
// initials, section letters) and ".net" hits the TLD in domains/emails + the collapsed bare "net".
// Measured: graphic designers/recruiters matched Data Scientist via "R"; iOS/Go/Python/QA matched
// .NET roles via ".net". normText turns commas into spaces, so a bare comma-list "R, Python" can't
// be told apart from "R&D" in the haystack — the reliable "deliberately listed" signal is an exact
// skills-array entry (handled separately), not the haystack. " .net" must be space-preceded to
// exclude "company.net".
const QUALIFIED: Record<string, RegExp> = {
  safe: /safe agile|scaled agile|safe (?:framework|practitioner|certified|scrum|facilitat)|\bssm\b/,
  r: /\brstudio\b|\bggplot|\bdplyr\b|\btidyverse\b|\bcran\b|\brmarkdown\b|\bshiny\b|r programming|r language|python\s*\/\s*r|r\s*\/\s*python|\(r\)/,
  c: /c programming|embedded c|c language|c\s*\/\s*c\+\+|c and c\+\+/,
  d: /d programming|\bdlang\b/,
  '.net': /asp\.net|vb\.net|\bdot ?net\b| \.net\b/,
};

// Common ENGLISH words that also name a tech (VERIFY-1): a bare haystack token is a false-positive
// mine — "spring 2024", "express delivery", "react to feedback", "team integration" all phantom-
// matched Spring/Express/React/Integration and (via SYN groups + IMPLIES) even satisfied a CORE
// requirement on a "vetted" card. Like QUALIFIED, these assert ONLY via a disambiguating tech
// context in the haystack OR an exact entry in the candidate's parsed skills array — never the bare
// word. Unlike QUALIFIED they keep their SYN group (the multi-word members — "spring boot",
// "react native", "system integration" — are unambiguous and still phrase-match normally).
const CONTEXT_WORDS: Record<string, RegExp> = {
  spring: /spring ?boot|springboot|spring framework|spring mvc|spring webflux|spring web|spring data|spring cloud|spring security|spring batch|spring core|java spring/,
  express: /express\.?js|express js|expressjs|express framework|express server|express middleware|express router|node[a-z .]{0,8}express|express[a-z .]{0,8}node/,
  integration: /system integration|systems integration|api integration|api-led|middleware integration|enterprise integration|continuous integration|data integration|integration (?:developer|engineer|specialist|architect|platform|layer|pattern|patterns)|\besb\b|mulesoft|integraciones|3rd party integration|third party integration/,
  react: /react\.?js|react js|reactjs|react native|react hooks|react redux|\bredux\b|\bjsx\b|react developer|react front|front[a-z -]{0,4}end react|react component|react query|react router/,
};

// Fold diacritics so localized skill/language spellings match their ASCII form: visualización→
// visualizacion, español→espanol, inglés→ingles. Without this the accent became a word break
// (visualización→"visualizaci n"), silently dropping every accented skill — a systematic
// undercount for the (large) LATAM candidate pool. ó/ñ/é → o/n/e; never collapses tokens.
const fold = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

// Normalize for phrase search: fold accents, lowercase, NBSP→space, keep + # . / - inside tokens
// (c++, c#, node.js, ci/cd, asp.net), turn other punctuation into spaces, pad with spaces.
function normText(s: string): string {
  return ' ' + fold(s || '')
    .toLowerCase()
    .replace(/ /g, ' ')
    .replace(/[^a-z0-9+#./\- ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() + ' ';
}

// Strip ONLY . - / and spaces (NOT # or +, else C#→C and C++→C collapse). This unifies
// node.js / nodejs / "node js" / NodeJS and express.js / ExpressJS, while java≠javascript and
// c#≠c hold — because we collapse at TOKEN/adjacent-token boundaries, never substring-in-word.
const collapse = (s: string) => s.toLowerCase().replace(/[.\-/ ]/g, '');

function tokenSet(norm: string): Set<string> {
  const toks = norm.trim().split(' ').filter(Boolean);
  const set = new Set<string>();
  for (let i = 0; i < toks.length; i++) {
    set.add(toks[i]);                                   // raw token (keeps #, +)
    set.add(toks[i].replace(/[.\-/]/g, ''));            // punctuation-stripped token (node.js→nodejs)
    if (i + 1 < toks.length) set.add(collapse(toks[i] + ' ' + toks[i + 1])); // adjacent pair ("node js"→nodejs)
  }
  return set;
}

export type VerifyResult = { found: boolean; matched?: string; via?: 'exact' | 'collapse' | 'synonym' | 'implies' };

/**
 * Does `skill` lexically appear in the candidate's CV text (+ optional parsed skills list)?
 * Deterministic. Matches across (1) exact/collapse, (2) bidirectional synonym groups, and
 * (3) skill implications (a framework that necessarily includes the skill). Returns the form found.
 */
export function verifySkill(skill: string, cvText: string, candidateSkills: string[] = []): VerifyResult {
  const s = fold((skill || '').toLowerCase().trim()); // fold so accented inputs hit the folded haystack/groups
  if (!s) return { found: false };

  const haystack = normText(`${cvText} ${candidateSkills.join(' , ')}`);
  const tokens = tokenSet(haystack);
  // Exact entries in the parsed skills array — the only reliable "deliberately declared" signal for
  // a context-gated token (an array entry "R" is a real skill; "R&D" in prose is not). Folded+lowered.
  const exactSkills = new Set(candidateSkills.map((c) => fold(String(c || '').toLowerCase().trim())).filter(Boolean));

  // Is `term` present in the candidate? (context-gated = regex or exact-skill; ambiguous = exact
  // token only; phrase = phrase or collapse). The QUALIFIED guard is first so it also covers
  // synonym-group / anyOf / implication members, not just a directly-required r/c/d/.net/safe.
  const present = (term: string): boolean => {
    if (QUALIFIED[term]) return QUALIFIED[term].test(haystack) || exactSkills.has(term);
    if (CONTEXT_WORDS[term]) return CONTEXT_WORDS[term].test(haystack) || exactSkills.has(term); // VERIFY-1: gate bare common words
    if (AMBIGUOUS.has(term)) return tokens.has(term);
    if (term.includes(' ')) return haystack.includes(' ' + term + ' ') || tokens.has(collapse(term));
    return tokens.has(term) || tokens.has(collapse(term));
  };

  // Ambiguous/short required skill → exact standalone token only. No alias/phrase/synonym/implies.
  if (AMBIGUOUS.has(s)) {
    return tokens.has(s) ? { found: true, matched: s, via: 'exact' } : { found: false };
  }

  // Context-gated tokens (SAFe / single-letter langs / .net) assert ONLY via their disambiguating
  // regex (module-scope QUALIFIED) or an exact skills-array entry, never off the bare token/substring.
  if (QUALIFIED[s]) return (QUALIFIED[s].test(haystack) || exactSkills.has(s)) ? { found: true, matched: s, via: 'exact' } : { found: false };

  // (1)+(2) direct + bidirectional synonym group
  const group = SYN.get(s) || [s];
  for (const v of group) {
    if (present(v)) return { found: true, matched: v, via: v === s ? 'exact' : 'synonym' };
  }

  // (3) implication: the candidate has a framework that necessarily includes s (or a synonym of s)
  for (const target of group) {
    for (const impl of (IMPLIED_BY.get(target) || [])) {
      if (present(impl)) return { found: true, matched: impl, via: 'implies' };
    }
  }
  return { found: false };
}
