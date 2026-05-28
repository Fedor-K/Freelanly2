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
const ALIASES: Record<string, string[]> = {
  kubernetes: ['k8s'],
  postgresql: ['postgres', 'psql'],
  'react': ['reactjs', 'react.js'],
  'react native': ['reactnative'],
  'node.js': ['nodejs', 'node js'],
  'ci/cd': ['cicd', 'ci cd'],
  'rest api': ['restful api', 'rest apis', 'restful'],
  // javascript/typescript/machine learning still match via their full token or space-collapse
  // ("java script"→javascript); golang matches the "golang" token. No ambiguous-short aliases.
};

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

export type VerifyResult = { found: boolean; matched?: string; via?: 'exact' | 'collapse' };

/**
 * Does `skill` lexically appear in the candidate's CV text (+ optional parsed skills list)?
 * Deterministic. Returns the exact form found for use as the displayed evidence.
 */
export function verifySkill(skill: string, cvText: string, candidateSkills: string[] = []): VerifyResult {
  const s = (skill || '').toLowerCase().trim();
  if (!s) return { found: false };

  const haystack = normText(`${cvText} ${candidateSkills.join(' , ')}`);
  const tokens = tokenSet(haystack);

  // Ambiguous/short → exact standalone token only. No alias, no phrase, no collapse.
  if (AMBIGUOUS.has(s)) {
    return tokens.has(s) ? { found: true, matched: s, via: 'exact' } : { found: false };
  }

  const variants = [s, ...(ALIASES[s] || [])];
  for (const v of variants) {
    if (v.includes(' ')) {
      if (haystack.includes(' ' + v + ' ')) return { found: true, matched: v, via: 'exact' };
      if (tokens.has(collapse(v))) return { found: true, matched: v, via: 'collapse' }; // "react native"→reactnative
    } else {
      if (tokens.has(v)) return { found: true, matched: v, via: 'exact' };
      if (tokens.has(collapse(v))) return { found: true, matched: v, via: 'collapse' }; // node.js≡nodejs≡"node js"
    }
  }
  return { found: false };
}
