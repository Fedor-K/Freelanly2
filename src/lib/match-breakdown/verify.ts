// Lexical, deterministic evidence verifier for the recruiter match breakdown.
// HARD RULE: this is the JUDGE — it decides whether a skill/phrase actually appears in the
// candidate's CV. It is purely lexical (normalize + alias + token boundaries). NO embeddings,
// NO semantic similarity here — semantic is allowed only upstream to PROPOSE spans, never to
// pass them. Asymmetric by design: when unsure, return NOT FOUND (a dropped true match is far
// cheaper than a confident false claim a recruiter pays for).

// Canonical skill -> safe variants. Only ADD an alias if it can't collide inside other words.
// k8s↔kubernetes is safe; short/ambiguous names are handled by AMBIGUOUS below (no aliasing).
const ALIASES: Record<string, string[]> = {
  kubernetes: ['k8s'],
  javascript: ['js'],
  typescript: ['ts'],
  postgresql: ['postgres', 'psql'],
  'react': ['reactjs', 'react.js'],
  'react native': ['reactnative'],
  'node.js': ['nodejs', 'node js'],
  'ci/cd': ['cicd', 'ci cd'],
  'rest api': ['restful api', 'rest apis', 'restful'],
  'machine learning': ['ml'],
  golang: ['go'], // only via the canonical "golang"; bare "go" stays ambiguous (see below)
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

function tokenSet(norm: string): Set<string> {
  return new Set(norm.trim().split(' ').filter(Boolean));
}

export type VerifyResult = { found: boolean; matched?: string };

/**
 * Does `skill` lexically appear in the candidate's CV text (+ optional parsed skills list)?
 * Deterministic. Returns the exact form found for use as the displayed evidence.
 */
export function verifySkill(skill: string, cvText: string, candidateSkills: string[] = []): VerifyResult {
  const s = (skill || '').toLowerCase().trim();
  if (!s) return { found: false };

  const haystack = normText(`${cvText} ${candidateSkills.join(' , ')}`);
  const tokens = tokenSet(haystack);

  // Ambiguous/short → exact standalone token only. No alias, no phrase.
  if (AMBIGUOUS.has(s)) {
    return tokens.has(s) ? { found: true, matched: s } : { found: false };
  }

  const variants = [s, ...(ALIASES[s] || [])];
  for (const v of variants) {
    if (v.includes(' ')) {
      // multi-word → phrase match with surrounding spaces (token boundaries)
      if (haystack.includes(' ' + v + ' ')) return { found: true, matched: v };
    } else {
      // single token → exact token membership (no substring-inside-word)
      if (tokens.has(v)) return { found: true, matched: v };
    }
  }
  return { found: false };
}
