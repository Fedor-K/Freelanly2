import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import '../design-app.css';
import './onboarding-design.css';

export const metadata: Metadata = {
  title: 'Welcome — Freelanly',
};

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, resumeText: true, parsedProfile: true },
  });

  const hasResume = !!(user?.resumeText || user?.parsedProfile);
  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div className="onboard-shell">

      <header className="onboard-top">
        <div className="onboard-logo">freelanly</div>
        <div className="steps-bar">
          <div className={`step ${hasResume ? 'done' : 'active'}`}>
            <span className="num">{hasResume ? '✓' : '1'}</span>
            <span>Your background</span>
          </div>
          <div className="line"></div>
          <div className={`step ${hasResume ? 'active' : ''}`}>
            <span className="num">2</span>
            <span>Categories</span>
          </div>
          <div className="line"></div>
          <div className="step">
            <span className="num">3</span>
            <span>Email</span>
          </div>
        </div>
        <a href="/dashboard" className="muted" style={{fontSize: '12px', textDecoration: 'none'}}>Skip setup</a>
      </header>

      <main className="onboard-main">
        <div className="onboard-eyebrow">Step {hasResume ? '2' : '1'} of 3</div>
        <h1 className="onboard-h">What kind of work are you looking for?</h1>
        <p className="onboard-sub">Pick a starting profile. Freelanly will tune the discovery feed and pre-load 4–5 templates that match. You can adjust anything later.</p>

        <div className="role-grid">

          <div className="role-card selected">
            <div className="ico">{`{ }`}</div>
            <div className="ttl">Senior engineer · contract / freelance</div>
            <div className="dsc">React, full-stack, mobile, infra. Looking for project work or part-time retainers.</div>
            <div className="tags">
              <span className="tag tag-acid">React</span>
              <span className="tag tag-acid">TypeScript</span>
              <span className="tag">Remote</span>
            </div>
          </div>

          <div className="role-card">
            <div className="ico">✎</div>
            <div className="ttl">Designer · brand / product</div>
            <div className="dsc">Brand systems, product UI, design sprints, illustration. Project and retainer work.</div>
            <div className="tags">
              <span className="tag">Figma</span>
              <span className="tag">Brand</span>
            </div>
          </div>

          <div className="role-card">
            <div className="ico">∿</div>
            <div className="ttl">Marketer · growth / content</div>
            <div className="dsc">SEO, paid, lifecycle, content writing. Retainers and project work.</div>
            <div className="tags">
              <span className="tag">SEO</span>
              <span className="tag">Lifecycle</span>
            </div>
          </div>

          <div className="role-card">
            <div className="ico">▲</div>
            <div className="ttl">Indie consultant / advisor</div>
            <div className="dsc">Strategy, fractional roles, deep-dive engagements. Long-term advisory relationships.</div>
            <div className="tags">
              <span className="tag">Strategy</span>
              <span className="tag">Fractional</span>
            </div>
          </div>

          <div className="role-card">
            <div className="ico">◉</div>
            <div className="ttl">Studio / small team</div>
            <div className="dsc">2–10 people. Project-based delivery. Larger engagements, longer cycles.</div>
            <div className="tags">
              <span className="tag">Studio</span>
              <span className="tag">Long projects</span>
            </div>
          </div>

          <div className="role-card">
            <div className="ico">+</div>
            <div className="ttl">Something else</div>
            <div className="dsc">We&apos;ll ask you a few questions to build a custom profile.</div>
          </div>

        </div>

        <div style={{marginTop: '36px'}}>
          <h3 style={{fontSize: '14px', fontWeight: 500, margin: '0 0 10px'}}>Or import from your résumé / LinkedIn so we can auto-fill</h3>
          <div className="grid grid-2" style={{gap: '12px'}}>
            <div className="import-card">
              <div className="ico">in</div>
              <div style={{fontSize: '13.5px', fontWeight: 500, marginBottom: '4px'}}>LinkedIn URL</div>
              <div className="meta">We&apos;ll pull skills, experience, and headline</div>
              <input className="field" placeholder="linkedin.com/in/yourname" style={{marginTop: '12px', padding: '7px 10px', fontSize: '12px', width: '100%'}} />
            </div>
            <div className="import-card">
              <div className="ico">↑</div>
              <div style={{fontSize: '13.5px', fontWeight: 500, marginBottom: '4px'}}>Upload résumé</div>
              <div className="meta">PDF or DOCX · we extract role, skills, experience</div>
              <button className="btn btn-soft btn-sm mt-3">Choose file</button>
            </div>
          </div>
        </div>

        <div className="onboard-actions">
          <button className="btn btn-ghost">← Back</button>
          <div className="row gap-3">
            <span className="meta">Press <kbd style={{fontFamily: "'Geist Mono', monospace", padding: '2px 7px', background: 'var(--bg-2)', borderRadius: '5px', border: '1px solid var(--line)', fontSize: '10.5px'}}>Enter</kbd> to continue</span>
            <a href="/dashboard" className="btn btn-acid">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              Continue → Email setup
            </a>
          </div>
        </div>

        <div style={{marginTop: '60px', padding: '18px 22px', background: 'var(--ink)', color: '#FAFAF7', borderRadius: '12px', display: 'flex', gap: '16px', alignItems: 'center'}}>
          <div style={{flexShrink: 0, width: '40px', height: '40px', borderRadius: '999px', background: 'var(--acid, #C7F94A)', color: '#000', display: 'grid', placeItems: 'center', fontFamily: "'Geist Mono', monospace", fontWeight: 700, fontSize: '14px'}}>★</div>
          <div style={{flex: 1, fontSize: '13.5px', lineHeight: 1.5, color: 'rgba(250,250,247,0.85)'}}>
            Once you finish setup, your first 20 applications will go out as <b style={{color: 'var(--acid, #C7F94A)'}}>drafts</b> for you to review — not auto-sent. You stay in control until you&apos;re confident.
          </div>
        </div>

      </main>
    </div>
  );
}
