// Generates a clean HTML résumé from a user's parsed profile, for legacy candidates whose
// original PDF was never stored (resumeUrl = "uploaded:<name>" placeholder — see the
// resume-blob-fix history). The recruiter portal serves this so there's always something to
// open; recruiters can Cmd/Ctrl+P → "Save as PDF" from their browser.

type CvExperience = { title?: string; company?: string; dates?: string; description?: string };
type CvEducation = { degree?: string; title?: string; school?: string; institution?: string; dates?: string; year?: string };

export type CvProfile = {
  name?: string;
  current_title?: string;
  field?: string;
  email?: string;
  location?: string;
  experience_years?: number;
  summary?: string;
  skills?: unknown[];
  languages?: unknown[];
  experience?: CvExperience[];
  education?: CvEducation[];
  certifications?: unknown[];
};

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** True when there's enough structured data to render a meaningful résumé. */
export function hasRenderableCv(profile: CvProfile | null | undefined): boolean {
  if (!profile) return false;
  return (
    arr(profile.skills).length > 0 ||
    arr(profile.experience).length > 0 ||
    (typeof profile.summary === 'string' && profile.summary.trim().length > 0)
  );
}

function esc(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Full standalone HTML document for the résumé. */
export function buildResumeHtml(profile: CvProfile, fallbackName?: string): string {
  const p = profile || {};

  const exp = arr(p.experience)
    .map((raw) => {
      const e = (raw || {}) as CvExperience;
      if (!e.title && !e.company && !e.description) return '';
      return `
      <div class="exp">
        <div class="exp-head">
          <div><span class="exp-title">${esc(e.title || '')}</span>${e.company ? ` <span class="exp-co">· ${esc(e.company)}</span>` : ''}</div>
          <div class="exp-dates">${esc(e.dates || '')}</div>
        </div>
        ${e.description ? `<div class="exp-desc">${esc(e.description)}</div>` : ''}
      </div>`;
    })
    .join('');

  const skills = arr(p.skills)
    .map((s) => `<span class="chip">${esc(s)}</span>`)
    .join('');

  const edu = arr(p.education)
    .map((raw) => {
      const e = (raw || {}) as CvEducation;
      const degree = e.degree || e.title || '';
      const school = e.school || e.institution || '';
      // When there's no degree (common from LinkedIn), promote the school to the title
      // so we never render a dangling "· School" with an empty heading.
      const head = degree || school || '';
      if (!head) return '';
      const sub = degree && school ? ` <span class="exp-co">· ${esc(school)}</span>` : '';
      return `<div class="exp"><div class="exp-head"><div><span class="exp-title">${esc(head)}</span>${sub}</div><div class="exp-dates">${esc(e.dates || e.year || '')}</div></div></div>`;
    })
    .join('');

  const certs = arr(p.certifications)
    .map((c) => `<span class="chip">${esc(typeof c === 'string' ? c : ((c as { name?: string })?.name || ''))}</span>`)
    .filter((c) => !c.includes('></span>'))
    .join('');

  const metaBits = [
    p.location ? esc(p.location) : null,
    p.experience_years ? `${esc(p.experience_years)}+ yrs experience` : null,
    p.field ? esc(p.field) : null,
  ]
    .filter(Boolean)
    .join('&nbsp;&nbsp;·&nbsp;&nbsp;');

  const languages = arr(p.languages).map(esc).filter(Boolean);

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.name || fallbackName || 'Candidate')} — Résumé</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; font-size: 11.5px; line-height: 1.5; background: #f3f4f1; }
  .sheet { max-width: 760px; margin: 24px auto; background: #fff; padding: 44px 48px; box-shadow: 0 1px 4px rgba(0,0,0,.08); border-radius: 6px; }
  .name { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
  .title { font-size: 13.5px; color: #2f6f4f; font-weight: 600; margin-top: 2px; }
  .meta { font-size: 10.5px; color: #777; margin-top: 7px; }
  .langs { font-size: 10.5px; color: #555; margin-top: 4px; }
  .langs b { color: #1a1a1a; }
  .rule { height: 2px; background: #1a1a1a; margin-top: 16px; }
  h2 { font-size: 10.5px; text-transform: uppercase; letter-spacing: 1.2px; color: #2f6f4f; margin: 20px 0 9px; font-weight: 700; }
  .summary { color: #333; text-align: justify; }
  .exp { margin-bottom: 12px; }
  .exp-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  .exp-title { font-weight: 700; font-size: 12px; }
  .exp-co { color: #555; font-weight: 500; }
  .exp-dates { color: #999; font-size: 10px; white-space: nowrap; }
  .exp-desc { color: #444; margin-top: 3px; text-align: justify; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { background: #f2f5ef; border: 1px solid #e2e8dd; color: #2a4034; border-radius: 6px; padding: 3px 9px; font-size: 10px; }
  .footer { margin-top: 30px; padding-top: 11px; border-top: 1px solid #eee; font-size: 9px; color: #aaa; text-align: center; }
  .footer b { color: #888; }
  .bar { max-width: 760px; margin: 0 auto; padding: 0 48px; display: flex; justify-content: flex-end; }
  .printbtn { margin-top: 18px; background: #0B0C0F; color: #fff; border: 0; border-radius: 8px; padding: 9px 18px; font-size: 12px; font-weight: 600; cursor: pointer; }
  @media print {
    body { background: #fff; }
    .sheet { box-shadow: none; margin: 0; max-width: none; padding: 0; border-radius: 0; }
    .bar, .printbtn { display: none !important; }
  }
</style></head>
<body>
  <div class="bar"><button class="printbtn" onclick="window.print()">⤓ Save as PDF</button></div>
  <div class="sheet">
    <div class="name">${esc(p.name || fallbackName || 'Candidate')}</div>
    ${p.current_title ? `<div class="title">${esc(p.current_title)}</div>` : ''}
    ${metaBits || p.email ? `<div class="meta">${metaBits}${p.email ? `${metaBits ? '&nbsp;&nbsp;·&nbsp;&nbsp;' : ''}${esc(p.email)}` : ''}</div>` : ''}
    ${languages.length ? `<div class="langs"><b>Languages:</b> ${languages.join(', ')}</div>` : ''}
    <div class="rule"></div>

    ${p.summary ? `<h2>Summary</h2><div class="summary">${esc(p.summary)}</div>` : ''}
    ${exp ? `<h2>Experience</h2>${exp}` : ''}
    ${skills ? `<h2>Skills &amp; Tools</h2><div class="chips">${skills}</div>` : ''}
    ${edu ? `<h2>Education</h2>${edu}` : ''}
    ${certs ? `<h2>Certifications</h2><div class="chips">${certs}</div>` : ''}

    <div class="footer">Compiled by <b>Freelanly</b> from the résumé this candidate submitted · structured via AI from the original document</div>
  </div>
</body></html>`;
}
