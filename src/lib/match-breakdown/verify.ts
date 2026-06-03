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
  // lists "Mandarin"; etc. ASCII-only members — normText strips accents (español→"espa ol"), so
  // accented spellings can't be members here. Native-speaker phrasing ("native Spanish") already
  // matches because the language name is literally present; this only closes the synonym gap.
  ['chinese', 'mandarin', 'putonghua'],
  ['spanish', 'castilian', 'castellano'],
  ['german', 'deutsch'],
  ['dutch', 'flemish'],
  ['persian', 'farsi'],
  ['filipino', 'tagalog'],
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

// Normalize for phrase search: lowercase, NBSP→space, keep + # . / - inside tokens
// (c++, c#, node.js, ci/cd, asp.net), turn other punctuation into spaces, pad with spaces.
function normText(s: string): string {
  return ' ' + (s || '')
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
  const s = (skill || '').toLowerCase().trim();
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
