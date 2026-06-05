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
  ['rest api', 'restful api', 'rest apis', 'restful apis', 'restful', 'rest services', 'restful web services'],
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
const AMBIGUOUS = new Set(['go', 'r', 'c', 'd', 'js', 'ts', 'ai', 'ml', 'qa', 'bi']);

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

  // Is `term` present in the candidate? (ambiguous = exact token only; phrase = phrase or collapse)
  const present = (term: string): boolean => {
    if (AMBIGUOUS.has(term)) return tokens.has(term);
    if (term.includes(' ')) return haystack.includes(' ' + term + ' ') || tokens.has(collapse(term));
    return tokens.has(term) || tokens.has(collapse(term));
  };

  // Ambiguous/short required skill → exact standalone token only. No alias/phrase/synonym/implies.
  if (AMBIGUOUS.has(s)) {
    return tokens.has(s) ? { found: true, matched: s, via: 'exact' } : { found: false };
  }

  // Framework acronyms that collide with a common English word — assert ONLY in a disambiguating
  // context, never off the bare word: "SAFe" (Scaled Agile Framework) vs "safe" the adjective.
  const QUALIFIED: Record<string, RegExp> = { safe: /safe agile|scaled agile|safe (?:framework|practitioner|certified|scrum|facilitat)|\bssm\b/ };
  if (QUALIFIED[s]) return QUALIFIED[s].test(haystack) ? { found: true, matched: s, via: 'exact' } : { found: false };

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
