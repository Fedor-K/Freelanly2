// Shared LinkedIn → candidate-profile logic. LinkedIn is a COMPLEMENT to the résumé, never a
// replacement: the résumé is the authoritative base, LinkedIn enriches it (union skills/languages,
// fill gaps). Used by the apply flow (resume-preauth) and the authenticated resume route.
// One Apify actor (harvestapi/linkedin-profile-scraper); skills come back as topSkills + skills.

export type CandProfile = Record<string, unknown>;

export type ScrapedLinkedIn = {
  liProfile: CandProfile | null;
  resolvedUrl: string | null; // canonical profile URL the actor resolved (cleaner than raw input)
  aboutText: string;          // fallback résumé-text when there's no PDF (about + headline + skills)
};

/** Scrape a candidate's own LinkedIn profile via Apify and map it to our profile shape. */
export async function scrapeLinkedInProfile(linkedinUrl: string | null, email: string): Promise<ScrapedLinkedIn> {
  const empty: ScrapedLinkedIn = { liProfile: null, resolvedUrl: linkedinUrl || null, aboutText: '' };
  if (!linkedinUrl || !linkedinUrl.includes('linkedin.com/in/')) return empty;
  const apifyToken = process.env.APIFY_API_TOKEN;
  if (!apifyToken) return empty;
  try {
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/harvestapi~linkedin-profile-scraper/run-sync-get-dataset-items?token=${apifyToken}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urls: [linkedinUrl] }), signal: AbortSignal.timeout(35000) }
    );
    if (!runRes.ok) return empty;
    const items = await runRes.json();
    const pr = Array.isArray(items) ? items[0] : null;
    if (!pr) { console.warn(`[LinkedIn] no items for ${email}`); return empty; }

    const liName = `${pr.firstName || ''} ${pr.lastName || ''}`.trim() || pr.fullName || null;
    // Actor returns BOTH topSkills (highlighted 3-5) and skills (full list) — union them.
    const liSkills = [...new Set([
      ...(Array.isArray(pr.topSkills) ? pr.topSkills : []),
      ...(Array.isArray(pr.skills) ? pr.skills : []),
    ].map((s: { name?: string } | string) => (typeof s === 'object' && s ? s.name : s))
      .filter(Boolean)
      .map((s) => String(s).trim()))].slice(0, 20);
    const liLangs = (Array.isArray(pr.languages) ? pr.languages : [])
      .map((l: { name?: string } | string) => (typeof l === 'object' && l ? l.name : l)).filter(Boolean);
    // The actor often returns languages:[] and lists a spoken language ("English") under skills
    // instead — pull those out so the languages field isn't empty for translation matching.
    const LANG_NAMES = new Set(['english', 'spanish', 'french', 'german', 'chinese', 'mandarin', 'cantonese', 'russian', 'arabic', 'portuguese', 'japanese', 'korean', 'italian', 'hindi', 'dutch', 'turkish', 'polish', 'ukrainian', 'vietnamese', 'thai', 'indonesian', 'persian', 'farsi', 'hebrew', 'swedish', 'norwegian', 'danish', 'finnish', 'greek', 'czech', 'romanian', 'hungarian', 'serbian', 'croatian', 'bulgarian', 'urdu', 'bengali', 'tagalog', 'filipino', 'malay', 'swahili', 'punjabi', 'tamil', 'telugu']);
    const langsFromSkills = (liSkills as string[]).filter((s: string) => LANG_NAMES.has(String(s).toLowerCase().trim()));
    const allLangs = [...new Set([...liLangs.map(String).map((s: string) => s.trim()), ...langsFromSkills])].filter(Boolean);
    const liLoc = typeof pr.location === 'string' ? pr.location : (pr.location?.linkedinText || pr.location?.text || null);
    const dateRange = (e: Record<string, unknown>): string => {
      if (typeof e.duration === 'string' && e.duration) return e.duration;
      const s = (e.startDate as { text?: string })?.text;
      const en = (e.endDate as { text?: string })?.text;
      return [s, en].filter(Boolean).join(' – ');
    };
    const liExperience = (Array.isArray(pr.experience) ? pr.experience : []).slice(0, 8)
      .map((e: Record<string, unknown>) => ({
        title: String(e.position || e.title || '').trim(),
        company: String(e.companyName || e.company || '').trim(),
        dates: dateRange(e),
        description: String(e.description || '').trim(),
      })).filter((e: { title: string; company: string }) => e.title || e.company);
    const liEducation = (Array.isArray(pr.education) ? pr.education : []).slice(0, 5)
      .map((e: Record<string, unknown>) => ({
        degree: [e.degree, e.fieldOfStudy].filter(Boolean).join(', ') || String(e.title || ''),
        school: String(e.schoolName || e.school || '').trim(),
        dates: String(e.period || dateRange(e) || ''),
      })).filter((e: { degree: string; school: string }) => e.degree || e.school);
    const liCerts = (Array.isArray(pr.certifications) ? pr.certifications : []).slice(0, 10)
      .map((c: { name?: string; title?: string } | string) => (typeof c === 'string' ? c : (c?.name || c?.title || ''))).filter(Boolean);
    const startYears = (Array.isArray(pr.experience) ? pr.experience : [])
      .map((e: { startDate?: { year?: number } }) => e.startDate?.year)
      .filter((y: unknown): y is number => typeof y === 'number' && y > 1950);
    const liExpYears = startYears.length ? Math.max(0, new Date().getFullYear() - Math.min(...startYears)) : 0;

    const liProfile: CandProfile = {
      name: liName, email, current_title: pr.headline || null, field: pr.headline || null,
      skills: liSkills, summary: pr.about || '', experience_years: liExpYears,
      experience: liExperience, education: liEducation, certifications: liCerts,
      languages: allLangs, location: liLoc,
    };
    const resolvedUrl = (typeof pr.linkedinUrl === 'string' && pr.linkedinUrl.includes('linkedin.com')) ? pr.linkedinUrl : linkedinUrl;
    const aboutText = pr.about ? `${liName || ''}\n${pr.headline || ''}\n\n${pr.about}\n\nSkills: ${(liSkills as string[]).join(', ')}` : '';
    console.log(`[LinkedIn] scraped for ${email}: ${liName}, ${(liSkills as string[]).length} skills`);
    return { liProfile, resolvedUrl, aboutText };
  } catch (e) {
    console.error('[LinkedIn] scrape failed:', e);
    return empty;
  }
}

/**
 * Merge a résumé-derived profile (authoritative BASE) with a LinkedIn-derived one (ENRICHMENT).
 * Résumé wins on structured detail; LinkedIn unions skills/languages and fills gaps. Either side
 * may be null (then the other is used as-is). LinkedIn never DROPS résumé detail — complement only.
 */
export function mergeCandidateProfiles(resumeProfile: CandProfile | null, liProfile: CandProfile | null, email: string): CandProfile | null {
  if (!resumeProfile && !liProfile) return null;
  if (!resumeProfile) return liProfile;
  if (!liProfile) return resumeProfile;
  const uniq = (arr: unknown[]) => [...new Set(arr.filter(Boolean).map((s) => String(s).trim()).filter((s) => s.length > 0))];
  const richer = (a: unknown, b: unknown) => (Array.isArray(a) && a.length ? a : (Array.isArray(b) ? b : []));
  return {
    name: resumeProfile.name || liProfile.name,
    email: resumeProfile.email || liProfile.email || email,
    phone: (resumeProfile.phone as string) || (liProfile.phone as string) || null,
    current_title: liProfile.current_title || resumeProfile.current_title,
    field: resumeProfile.field || liProfile.field,
    skills: uniq([...((resumeProfile.skills as unknown[]) || []), ...((liProfile.skills as unknown[]) || [])]).slice(0, 25),
    languages: uniq([...((resumeProfile.languages as unknown[]) || []), ...((liProfile.languages as unknown[]) || [])]),
    experience_years: (resumeProfile.experience_years as number) || (liProfile.experience_years as number) || 0,
    summary: ((liProfile.summary as string) || '').length > ((resumeProfile.summary as string) || '').length ? liProfile.summary : (resumeProfile.summary || liProfile.summary),
    location: resumeProfile.location || liProfile.location || null,
    experience: richer(resumeProfile.experience, liProfile.experience),
    education: richer(resumeProfile.education, liProfile.education),
    certifications: richer(resumeProfile.certifications, liProfile.certifications),
  };
}
