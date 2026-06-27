// Deterministic unit checks for the Phase-1 matcher fixes (no LLM, no DB). Run:
//   npx tsx scripts/verify-matching-fixes.ts
import { verifySkill } from '@/lib/match-breakdown/verify';
import { buildBreakdown, type ParsedJD } from '@/lib/match-breakdown/generate';
import { computeCaveats } from '@/lib/match-caveats';
import { redactPII } from '@/services/matching/recruiter-rationale';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ FAIL: ${name}`); }
}

console.log('VERIFY-1 — bare common words are context-gated:');
// "spring 2024" / "react to feedback" / "express delivery" / "team integration" must NOT phantom-match.
ok('"spring" NOT matched by "joined spring 2024"', !verifySkill('spring', 'joined the team in spring 2024').found);
ok('"spring" matched by "Spring Boot"',            verifySkill('spring', 'built microservices with Spring Boot').found);
ok('"spring" matched when listed as a skill',      verifySkill('spring', '', ['Spring']).found);
ok('"react" NOT matched by "quick to react"',      !verifySkill('react', 'a manager quick to react to change').found);
ok('"react" matched by "React.js"',                verifySkill('react', 'frontend in React.js and Redux').found);
ok('"express" NOT matched by "express delivery"',  !verifySkill('express', 'managed express delivery logistics').found);
ok('"express" matched by "Express.js"',            verifySkill('express', 'Node.js + Express.js REST API').found);
ok('"integration" NOT matched by bare "integration"', !verifySkill('integration', 'helped with team integration and onboarding').found);
ok('"integration" matched by "system integration"', verifySkill('integration', 'led system integration for ERP').found);
// Multi-word group members still phrase-match (no regression):
ok('"react native" still matches', verifySkill('react native', 'shipped a React Native app').found);
ok('"spring boot" still matches',  verifySkill('spring boot', 'Spring Boot services').found);

console.log('\nCAVEATS-2 + zero/0-of-0 + different-profession → Weak:');
ok('1-of-1 matched=0 → Weak', computeCaveats({ total: 1, matched: 0, lines: [{ label: 'x', status: 'missing' }] })?.strength === 'Weak');
ok('0-of-0 (no reqs) → Weak', computeCaveats({ total: 0, matched: 0, lines: [] })?.strength === 'Weak');
ok('profession=different (3/3) → Weak', computeCaveats({ total: 3, matched: 3, profession: 'different', lines: [
  { label: 'a', status: 'full' }, { label: 'b', status: 'full' }, { label: 'c', status: 'full' }] })?.strength === 'Weak');
ok('clean 3-of-3 exact → Strong (no regression)', computeCaveats({ total: 3, matched: 3, profession: 'exact', lines: [
  { label: 'a', status: 'full' }, { label: 'b', status: 'full' }, { label: 'c', status: 'full' }] })?.strength === 'Strong');

console.log('\nPARSEJD-1 — a requirement only inside a Nice-to-have block is dropped from the denominator:');
const jd: ParsedJD = { skills: [{ display: 'Kubernetes', anyOf: ['kubernetes'], core: false }], languages: [] };
const niceToHaveOnly = buildBreakdown(jd, {
  jdText: 'Senior Backend Engineer\nMust have: Python, PostgreSQL.\nNice to have:\n- Kubernetes\n- Terraform',
  cvText: 'experienced with kubernetes and python', candidateSkills: ['kubernetes', 'python'], candidateLanguages: [],
});
ok('K8s only under "Nice to have" → rejected (total 0)', niceToHaveOnly.total === 0 && niceToHaveOnly.rejected.some(r => /kubernetes/i.test(r.label)));
const mustHave = buildBreakdown(jd, {
  jdText: 'Senior Backend Engineer\nMust have: Python, Kubernetes.', // K8s now a must-have
  cvText: 'experienced with kubernetes and python', candidateSkills: ['kubernetes', 'python'], candidateLanguages: [],
});
ok('K8s as a must-have → counted + matched (1/1)', mustHave.total === 1 && mustHave.matched === 1);

console.log('\nRAT-1 — résumé grounding is scrubbed of identity before it reaches the model:');
{
  const cv = 'Maria Gonzalez\nmaria.gonzalez@gmail.com | +1 (415) 555-0199\nlinkedin.com/in/mariagonzalez\nSenior Data Analyst with 7 years building dashboards.';
  const red = redactPII(cv, 'Maria Gonzalez');
  ok('email removed', !/maria\.gonzalez@gmail\.com/i.test(red));
  ok('phone removed', !/555-0199/.test(red));
  ok('linkedin url removed', !/linkedin\.com\/in\/mariagonzalez/i.test(red));
  ok('name removed', !/\bMaria\b/.test(red) && !/\bGonzalez\b/.test(red));
  ok('real experience kept', /7 years building dashboards/.test(red));
}

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
