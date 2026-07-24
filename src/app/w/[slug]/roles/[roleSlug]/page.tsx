import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { watcherBySlug } from '@/config/watchers';
import '../../../../marketing-styles.css';
import '../../../../landing-design.css';

export const revalidate = 600;

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; roleSlug: string }> }): Promise<Metadata> {
  const { slug, roleSlug } = await params;
  const w = watcherBySlug(slug);
  const o = await prisma.opportunity.findUnique({ where: { slug: roleSlug }, select: { title: true } }).catch(() => null);
  if (!w || !o) return {};
  return {
    title: `${o.title} — ${w.name}`,
    description: `Remote ${w.roleShort} role, caught in a LinkedIn hiring post by ${w.name}. Apply with a drafted application.`,
    robots: { index: false }, // role pages churn in 30 days — keep them out of the index like /freelance
  };
}

/** Vacancy page on a watcher domain: the post + the watcher frame + proof stream. */
export default async function WatcherRolePage({ params }: { params: Promise<{ slug: string; roleSlug: string }> }) {
  const { slug, roleSlug } = await params;
  const w = watcherBySlug(slug);
  if (!w) notFound();

  const o = await prisma.opportunity.findUnique({
    where: { slug: roleSlug },
    select: { id: true, title: true, description: true, createdAt: true, location: true, skills: true, salaryMin: true, salaryMax: true, salaryCurrency: true, salaryPeriod: true, level: true, isActive: true },
  }).catch(() => null);
  if (!o) notFound();

  const also = await prisma.opportunity.findMany({
    where: { isActive: true, createdAt: { gte: new Date(Date.now() - 3 * 86400000) }, applyEmail: { not: null }, id: { not: o.id } },
    select: { id: true, slug: true, title: true, skills: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 300,
  }).catch(() => []);
  const proof = also.filter((x) => w.titleRe.test(x.title) || x.skills.some((s) => w.titleRe.test(s))).slice(0, 6);

  const salary = o.salaryMin && o.salaryPeriod !== 'YEAR'
    ? `${o.salaryCurrency || 'USD'} ${o.salaryMin.toLocaleString()}${o.salaryMax ? `–${o.salaryMax.toLocaleString()}` : ''}/${(o.salaryPeriod || '').toLowerCase() || 'mo'}`
    : null;

  return (
    <>
<nav className="nav">
  <div className="nav-inner">
    <a href="/" className="logo">
      <span className="logo-mark" style={{ background: 'var(--accent)', color: '#000' }}>{w.roleShort[0]}</span>
      <span>{w.name}</span>
    </a>
    <div className="nav-cta">
      <a href="/join" className="btn btn-primary btn-sm">Get started</a>
    </div>
  </div>
</nav>

<main className="container" style={{ paddingTop: '110px', paddingBottom: '60px', maxWidth: '760px' }}>
  <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: 'var(--accent)', marginBottom: '12px' }}>
    ⚡ Caught by {w.name} · {timeAgo(o.createdAt)}
  </div>
  <h1 style={{ fontSize: 'clamp(26px, 3.6vw, 40px)', fontWeight: 650, letterSpacing: '-0.02em', marginBottom: '10px' }}>{o.title}</h1>
  <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--ink-3)', marginBottom: '22px' }}>
    {o.location && <span>📍 {o.location}</span>}
    {salary && <span>💰 {salary}</span>}
    {o.level && <span>· {o.level}</span>}
    {!o.isActive && <span style={{ color: 'var(--bad)' }}>· no longer active</span>}
  </div>

  <div style={{ border: '1px solid var(--line-2)', borderRadius: '14px', padding: '22px 24px', fontSize: '14.5px', lineHeight: 1.7, color: 'var(--ink-2)', whiteSpace: 'pre-wrap', marginBottom: '18px' }}>
    {o.description.slice(0, 3000)}
  </div>

  {o.skills.length > 0 && (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '26px' }}>
      {o.skills.slice(0, 8).map((s) => (
        <span key={s} className="tag" style={{ fontSize: '12px' }}>{s}</span>
      ))}
    </div>
  )}

  <a href={`/join?role=${roleSlug}`} className="btn btn-primary btn-lg" style={{ width: '100%', textAlign: 'center' }}>
    Apply to this role →
  </a>
  <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--ink-4)', marginTop: '10px' }}>
    Application drafted for you · sent only when you click Send
  </div>

  {proof.length > 0 && (
    <div style={{ marginTop: '46px' }}>
      <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-4)', marginBottom: '12px' }}>
        Your watcher also caught recently
      </div>
      <div style={{ border: '1px solid var(--line-2)', borderRadius: '14px', overflow: 'hidden' }}>
        {proof.map((p, i) => (
          <a key={p.id} href={`/roles/${p.slug}`} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '13px 18px', borderBottom: i < proof.length - 1 ? '1px solid var(--line)' : 'none', textDecoration: 'none', color: 'inherit' }}>
            <span style={{ flexShrink: 0, fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: 'var(--ink-4)', width: '58px' }}>{timeAgo(p.createdAt)}</span>
            <span style={{ flex: 1, fontSize: '13.5px' }}>{p.title.slice(0, 70)}</span>
            <span style={{ flexShrink: 0, color: 'var(--accent)', fontSize: '12px' }}>→</span>
          </a>
        ))}
      </div>
    </div>
  )}
</main>

<footer className="footer">
  <div className="container">
    <div className="footer-bottom" style={{ borderTop: 'none', paddingTop: 0 }}>
      <span>© 2026 {w.name} · an IntentPond product</span>
    </div>
  </div>
</footer>
    </>
  );
}
