// Shared LinkedIn → candidate-profile logic. LinkedIn is a COMPLEMENT to the résumé, never a
// replacement: the résumé is the authoritative base, LinkedIn enriches it (union skills/languages,
// fill gaps). Used by the apply flow (resume-preauth) and the authenticated resume route.
// One Apify actor (harvestapi/linkedin-profile-scraper); skills come back as topSkills + skills.

import { put } from '@vercel/blob';

export type CandProfile = Record<string, unknown>;

/**
 * Cache a LinkedIn profile photo to our Vercel Blob and return the permanent URL. LinkedIn CDN
 * (media.licdn.com) URLs are SIGNED with a ~2-week expiry, so storing the raw URL means the photo
 * 403s a couple weeks later (avatars revert to initials). Call this at scrape time — while the URL
 * is fresh — to download the bytes and store them on our own domain (never expires, hot-linkable).
 * Returns null on any failure → caller falls back to the raw URL (fresh for now) or initials.
 */
export async function cacheProfilePhotoToBlob(photoUrl: string, userId: string): Promise<string | null> {
  try {
    if (!photoUrl || !/^https?:\/\//.test(photoUrl)) return null;
    const res = await fetch(photoUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || 'image/jpeg';
    if (!ct.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200) return null; // guard against error pages / 1px stubs
    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
    const blob = await put(`avatars/${userId}.${ext}`, buf, { access: 'public', contentType: ct, allowOverwrite: true });
    return blob.url;
  } catch {
    return null;
  }
}

/**
 * Normalize a user-entered LinkedIn URL to a canonical https://www.linkedin.com/in/<slug> form,
 * auto-fixing the common typos we see in registrations (single-slash scheme `https:/`, missing
 * scheme, `linked.com`, trailing `?skipRedirect=…`). Returns null when it isn't a real PERSONAL
 * profile URL — bare names ("Karri Aravind Swamy"), "no tengo", company pages (/company/…),
 * /me?trk=… links, public-profile/settings links — i.e. the ~19% garbage that can never be scraped.
 */
export function normalizeLinkedInUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/^(https?):\/(?!\/)/i, '$1://'); // https:/ → https://
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
  s = s.replace(/linked\.com/i, 'linkedin.com');
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
  const m = u.pathname.match(/\/in\/([^/?#]+)/i); // must be a personal /in/<slug> path
  if (!m) return null;
  const slug = m[1].trim(); // keep URL-encoded (handles emoji/unicode vanity slugs)
  if (slug.length < 2) return null;
  return `https://www.linkedin.com/in/${slug}`;
}

export type ScrapedLinkedIn = {
  liProfile: CandProfile | null;
  resolvedUrl: string | null; // canonical profile URL the actor resolved (cleaner than raw input)
  aboutText: string;          // fallback résumé-text when there's no PDF (about + headline + skills)
  photoUrl: string | null;    // LinkedIn profile photo URL (200×200)
};

/** Scrape a candidate's own LinkedIn profile via Apify and map it to our profile shape. */
export async function scrapeLinkedInProfile(linkedinUrl: string | null, email: string): Promise<ScrapedLinkedIn> {
  const normUrl = normalizeLinkedInUrl(linkedinUrl);
  const empty: ScrapedLinkedIn = { liProfile: null, resolvedUrl: normUrl || linkedinUrl || null, aboutText: '', photoUrl: null };
  if (!normUrl) return empty;
  const apifyToken = process.env.APIFY_API_TOKEN;
  if (!apifyToken) return empty;
  // PIN the actor build. harvestapi shipped build 0.0.123 on 2026-06-17 15:39 UTC that runs under
  // LIMITED_PERMISSIONS and 403s creating its key-value store → every run FAILS (candidate enrichment
  // went dark at 15:41). 0.0.122 (the prior build) works. Pin it until the author fixes `latest`;
  // override via APIFY_LI_PROFILE_BUILD env (set to 'latest' to un-pin) without a redeploy.
  const liBuild = process.env.APIFY_LI_PROFILE_BUILD || '0.0.122';
  try {
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/harvestapi~linkedin-profile-scraper/run-sync-get-dataset-items?token=${apifyToken}&build=${encodeURIComponent(liBuild)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urls: [normUrl] }), signal: AbortSignal.timeout(35000) }
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
    // Location feeds the deterministic-ish location gate as a freeform string. The actor's
    // `linkedinText` is human-readable but often city/region-only ("San Francisco Bay Area") with
    // NO country word — which makes country-level gating unreliable. The actor also resolves a
    // normalized `location.parsed.country` / `countryCode`; append it when the text doesn't already
    // name the country, so the gate always sees a country even for city-only strings.
    const locObj = (pr.location && typeof pr.location === 'object') ? pr.location : null;
    const locText = typeof pr.location === 'string' ? pr.location : (locObj?.linkedinText || locObj?.text || null);
    const locCountry = locObj?.parsed?.country || locObj?.parsed?.countryFull || null;
    const liLoc = locText
      ? (locCountry && !String(locText).toLowerCase().includes(String(locCountry).toLowerCase()) ? `${locText}, ${locCountry}` : locText)
      : locCountry;
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

    // current_title from the most recent REAL job title, not the headline. LinkedIn headlines are
    // marketing taglines ("Building X — helping Y", "Helping founders scale") — using them as the
    // title makes the matcher mis-read the candidate's profession and reject every genuine fit.
    // field is NOT derived from the headline for the same reason (let the résumé parse own it).
    const liMostRecentTitle = (liExperience[0]?.title || '').trim();
    const liProfile: CandProfile = {
      name: liName, email, current_title: liMostRecentTitle || (typeof pr.headline === 'string' ? pr.headline : null), field: null,
      skills: liSkills, summary: pr.about || '', experience_years: liExpYears,
      experience: liExperience, education: liEducation, certifications: liCerts,
      languages: allLangs, location: liLoc,
    };
    const resolvedUrl = (typeof pr.linkedinUrl === 'string' && pr.linkedinUrl.includes('linkedin.com')) ? pr.linkedinUrl : linkedinUrl;
    const photoUrl: string | null = (typeof pr.photo === 'string' && pr.photo) ? pr.photo
      : (pr.profilePicture?.url && typeof pr.profilePicture.url === 'string') ? pr.profilePicture.url
      : null;
    const aboutText = pr.about ? `${liName || ''}\n${pr.headline || ''}\n\n${pr.about}\n\nSkills: ${(liSkills as string[]).join(', ')}` : '';
    console.log(`[LinkedIn] scraped for ${email}: ${liName}, ${(liSkills as string[]).length} skills, photo=${!!photoUrl}`);
    return { liProfile, resolvedUrl, aboutText, photoUrl };
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
    // Résumé is the authoritative base for the title too — its parsed current_title comes from real
    // work history. Only fall back to LinkedIn's (now a real job title, not the headline) if absent.
    current_title: resumeProfile.current_title || liProfile.current_title,
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
