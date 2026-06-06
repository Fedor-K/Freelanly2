// Heuristic: is a parsed résumé actually a COMPANY brochure / marketing page rather than a person's
// CV? Some users upload an "About Us" / services PDF (observed: a Tribotz company page) — the matcher
// then writes a cover letter grounded in nothing, and recruiters reply "share your CV". This catches
// the clear cases CONSERVATIVELY (false positives would block legit sends): it fires only on a strong
// company-marketing signal AND the absence of any personal-CV structure/name. Empty/short text is
// never flagged (a real upload may simply lack extracted text — handled elsewhere).
export function looksLikeCompanyBrochure(resumeText: string | null | undefined, candidateName?: string | null): boolean {
  const t = (resumeText || '').trim();
  if (t.length < 200) return false; // too little text to judge → don't block
  const lower = t.toLowerCase();

  const companyMarkers = [
    'about us', 'our mission', 'our vision', 'company vision', 'company mission',
    'our team of', 'we specialize', 'we empower', 'our clients', 'our services',
    'who we are', 'what we do', 'our solutions', 'our company', 'we are a leading',
    'our values', 'our products', 'contact us today',
  ];
  const companyHits = companyMarkers.filter((m) => lower.includes(m)).length;
  if (companyHits < 2) return false; // weak company signal → treat as a real CV

  const cvMarkers = [
    'experience', 'education', 'work history', 'employment history', 'professional summary',
    'professional experience', 'skills', 'certifications', 'projects', 'achievements',
  ];
  const cvHits = cvMarkers.filter((m) => lower.includes(m)).length;

  const firstName = (candidateName || '').trim().toLowerCase().split(/\s+/)[0] || '';
  const nameHit = firstName.length > 2 ? lower.includes(firstName) : false;

  // Brochure = strong company-marketing signal AND no personal-CV structure AND the candidate's own
  // name is absent. All three required, so a normal CV that happens to describe an employer is safe.
  return companyHits >= 2 && cvHits < 2 && !nameHit;
}
