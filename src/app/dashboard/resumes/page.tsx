import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import './resumes-design.css';

export const metadata: Metadata = {
  title: 'Resume Templates — Freelanly',
};

const TEMPLATES = [
  { id: 'sequence', name: 'Sequence', sub: 'Freelanly-native', file: '/resumes/sequence.html', corner: '01 · A4 · single page', desc: 'A dark sidebar carries identity and contact; the right column is reserved for experience with a quiet acid accent on the current role. The on-brand pick for engineers applying to product-led teams.', tags: ['recommended', 'two-column', 'engineer', 'dark sidebar'], featured: true, ribbon: 'Recommended', stats: '312×', lift: '14%' },
  { id: 'wire', name: 'Wire', sub: 'Editorial minimal', file: '/resumes/wire.html', corner: '02 · A4 · single page', desc: 'Single column, generous air, hairline rules. Calm and grown-up — works well for senior roles where you want the reader\'s eye on the words, not the layout.', tags: ['single-column', 'minimal', 'classic', 'all roles'], featured: false, stats: '184×', lift: '11%' },
  { id: 'stack', name: 'Stack', sub: 'Engineer · dense', file: '/resumes/stack.html', corner: '03 · A4 · single page', desc: 'Terminal-style header, monospace meta, a skill matrix, and four hero stats at the top. Designed for engineering hiring managers who skim — every metric is one glance away.', tags: ['technical', 'data-dense', 'monospace', 'infra / sre'], featured: false, stats: '97×', lift: '16%' },
  { id: 'spread', name: 'Spread', sub: 'Magazine editorial', file: '/resumes/spread.html', corner: '04 · A4 · single page', desc: 'A serif display name, an editorial pull-quote in the middle of the page, and a confident two-column body. For designers and design-adjacent engineers shopping to senior creative teams.', tags: ['editorial', 'serif display', 'design', 'two-column'], featured: false, stats: '61×', lift: '9%' },
  { id: 'brief', name: 'Brief', sub: 'One-page summary', file: '/resumes/brief.html', corner: '05 · A4 · single-page brief', desc: 'Big stats up top — your numbers in 44px. Three selected work tiles, a career-path strip, a single skills line. For founders, hiring managers, or any inbox where you have 30 seconds to land.', tags: ['highest reply rate', 'one-pager', 'numbers-led', 'senior IC'], featured: false, ribbon: 'Best for short list', stats: '42×', lift: '21%' },
];

export default async function ResumesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, parsedProfile: true },
  });

  const profile = user?.parsedProfile as Record<string, unknown> | null;
  const skills = (profile?.skills as string[]) || [];
  const userName = user?.name || 'User';

  return (
    <div className="page">

      <div className="page-header">
        <div className="page-title">
          <h1>Resume templates</h1>
          <p>PDF-ready CV templates. Pre-filled with your profile — open, refine, save as PDF, attach in your next application.</p>
        </div>
      </div>

      {/* Status banner */}
      <div className="res-banner">
        <div>
          <div className="ttl">Profile detected · <span className="sub">{userName}{skills.length > 0 ? ` — ${skills.slice(0, 3).join(', ')}` : ''}</span></div>
          <div className="dsc">Every template is auto-populated from your Freelanly profile. Templates print A4 at 96dpi with embedded fonts.</div>
        </div>
        <div style={{display: 'flex', gap: '8px'}}>
          <a href="/dashboard/settings#profile" className="btn btn-soft">Edit profile</a>
        </div>
      </div>

      {/* Toolbar */}
      <div className="res-toolbar">
        <div className="seg">
          <button className="active">All templates</button>
          <button>Engineering</button>
          <button>Design</button>
          <button>One-pager</button>
        </div>
        <div className="grow"></div>
        <span className="field"><span className="dot"></span><b>5</b> templates</span>
      </div>

      {/* Grid */}
      <div className="res-grid">
        {TEMPLATES.map((tpl) => (
          <article key={tpl.id} className={`res-card${tpl.featured ? ' featured' : ''}`} style={tpl.id === 'brief' ? {gridColumn: '1 / -1'} : undefined}>
            <div className="res-thumb" style={tpl.id === 'brief' ? {height: '420px'} : undefined}>
              <span className="corner">{tpl.corner}</span>
              {tpl.ribbon && (
                <span className="ribbon" style={tpl.id === 'brief' ? {background: 'var(--ink)', color: 'var(--acid)'} : undefined}>{tpl.ribbon}</span>
              )}
              <div style={{width: '210mm', height: '297mm', transform: tpl.id === 'brief' ? 'scale(0.46)' : 'scale(0.40)', transformOrigin: 'top center', pointerEvents: 'none', background: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.10)'}}>
                <iframe src={`/api/user/resume-preview?template=${tpl.id}`} loading="lazy" title={tpl.name} style={{width: '100%', height: '100%', border: 0, display: 'block', background: '#fff'}} />
              </div>
            </div>
            <div className="res-meta">
              <div className="res-meta-head">
                <div className="name">{tpl.name} <span className="sub">{tpl.sub}</span></div>
                <div className="stat">Used <b>{tpl.stats}</b> · {tpl.lift} reply lift</div>
              </div>
              <div className="res-desc">{tpl.desc}</div>
              <div className="res-tags">
                {tpl.tags.map(t => (
                  <span key={t} className={`res-tag${t === 'recommended' || t === 'highest reply rate' ? ' acid' : ''}`}>{t}</span>
                ))}
              </div>
            </div>
            <div className="res-actions">
              <a className="btn btn-ghost btn-sm" href={`/api/user/resume-preview?template=${tpl.id}`} target="_blank" rel="noopener">Preview</a>
              <div className="grow"></div>
              <a className="btn btn-ghost btn-sm" href={`/api/user/resume-preview?template=${tpl.id}`} target="_blank" rel="noopener">Edit</a>
              <a className="btn btn-acid btn-sm" href={`/api/user/resume-preview?template=${tpl.id}&pdf=1`}>Save as PDF</a>
            </div>
          </article>
        ))}
      </div>

      {/* Footer */}
      <div className="res-bottom">
        <div className="ico">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
        </div>
        <div className="copy">
          <div className="t">Need a different vibe — academic CV, cover-letter shell, portfolio one-pager?</div>
          <div className="s">Tell us the layout reference and we&apos;ll build a sixth template tuned to your profile. Most custom templates ship within 24 hours.</div>
        </div>
        <div>
          <button className="btn btn-soft">Request a template</button>
        </div>
      </div>

    </div>
  );
}
