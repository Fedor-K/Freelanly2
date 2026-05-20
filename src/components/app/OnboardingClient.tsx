'use client';

import { useState, useRef } from 'react';

const ROLES = [
  { id: 'engineer', ico: '{ }', title: 'Senior engineer · contract / freelance', desc: 'React, full-stack, mobile, infra. Looking for project work or part-time retainers.', tags: ['React', 'TypeScript', 'Remote'] },
  { id: 'designer', ico: '✎', title: 'Designer · brand / product', desc: 'Brand systems, product UI, design sprints, illustration. Project and retainer work.', tags: ['Figma', 'Brand'] },
  { id: 'marketer', ico: '∿', title: 'Marketer · growth / content', desc: 'SEO, paid, lifecycle, content writing. Retainers and project work.', tags: ['SEO', 'Lifecycle'] },
  { id: 'consultant', ico: '▲', title: 'Indie consultant / advisor', desc: 'Strategy, fractional roles, deep-dive engagements. Long-term advisory relationships.', tags: ['Strategy', 'Fractional'] },
  { id: 'studio', ico: '◉', title: 'Studio / small team', desc: '2–10 people. Project-based delivery. Larger engagements, longer cycles.', tags: ['Studio', 'Long projects'] },
  { id: 'other', ico: '+', title: 'Something else', desc: "We'll ask you a few questions to build a custom profile.", tags: [] },
];

export function OnboardingClient({ firstName, hasResume }: { firstName: string; hasResume: boolean }) {
  const [selectedRole, setSelectedRole] = useState('engineer');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadResult(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/user/resume', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        setUploadResult('Resume uploaded and parsed!');
      } else {
        const data = await res.json();
        setUploadResult(data.error || 'Upload failed');
      }
    } catch {
      setUploadResult('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleContinue() {
    setSaving(true);
    try {
      // Save role preference
      await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selectedRole }),
      });

      // Import LinkedIn if URL provided
      if (linkedinUrl.trim()) {
        await fetch('/api/user/portfolio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: linkedinUrl }),
        });
      }

      // Mark onboarding complete
      await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'complete' }),
      });

      window.location.href = '/dashboard';
    } catch {
      window.location.href = '/dashboard';
    }
  }

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
        <span></span>
      </header>

      <main className="onboard-main">
        <div className="onboard-eyebrow">Step {hasResume ? '2' : '1'} of 3</div>
        <h1 className="onboard-h">What kind of work are you looking for?</h1>
        <p className="onboard-sub">Pick a starting profile. Freelanly will tune the discovery feed and pre-load 4–5 templates that match. You can adjust anything later.</p>

        <div className="role-grid">
          {ROLES.map(role => (
            <div
              key={role.id}
              className={`role-card${selectedRole === role.id ? ' selected' : ''}`}
              onClick={() => setSelectedRole(role.id)}
            >
              <div className="ico">{role.ico}</div>
              <div className="ttl">{role.title}</div>
              <div className="dsc">{role.desc}</div>
              {role.tags.length > 0 && (
                <div className="tags">
                  {role.tags.map(t => (
                    <span key={t} className={`tag${selectedRole === role.id ? ' tag-acid' : ''}`}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop: '36px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 500, margin: '0 0 10px' }}>Or import from your résumé / LinkedIn so we can auto-fill</h3>
          <div className="grid grid-2" style={{ gap: '12px' }}>
            <div className="import-card">
              <div className="ico">in</div>
              <div style={{ fontSize: '13.5px', fontWeight: 500, marginBottom: '4px' }}>LinkedIn URL</div>
              <div className="meta">We&apos;ll pull skills, experience, and headline</div>
              <input
                className="field"
                placeholder="linkedin.com/in/yourname"
                value={linkedinUrl}
                onChange={e => setLinkedinUrl(e.target.value)}
                style={{ marginTop: '12px', padding: '7px 10px', fontSize: '12px', width: '100%' }}
              />
            </div>
            <div className="import-card" onClick={() => fileRef.current?.click()}>
              <div className="ico">↑</div>
              <div style={{ fontSize: '13.5px', fontWeight: 500, marginBottom: '4px' }}>Upload résumé</div>
              <div className="meta">PDF or DOCX · we extract role, skills, experience</div>
              <input ref={fileRef} type="file" accept=".pdf,.docx,.doc" hidden onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
              <button className="btn btn-soft btn-sm mt-3" disabled={uploading}>
                {uploading ? 'Uploading...' : 'Choose file'}
              </button>
              {uploadResult && <div style={{ fontSize: '12px', marginTop: '8px', color: uploadResult.includes('!') ? 'var(--good)' : 'var(--bad)' }}>{uploadResult}</div>}
            </div>
          </div>
        </div>

        <div className="onboard-actions">
          <div></div>
          <div className="row gap-3">
            <button className="btn btn-acid" onClick={handleContinue} disabled={saving || (!hasResume && !uploadResult?.includes('!'))}>
              {saving ? 'Saving...' : (!hasResume && !uploadResult?.includes('!')) ? 'Upload résumé to continue' : 'Continue → Dashboard'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </div>
        </div>

        <div style={{ marginTop: '60px', padding: '18px 22px', background: 'var(--ink)', color: '#FAFAF7', borderRadius: '12px', display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ flexShrink: 0, width: '40px', height: '40px', borderRadius: '999px', background: 'var(--acid, #C7F94A)', color: '#000', display: 'grid', placeItems: 'center', fontFamily: "'Geist Mono', monospace", fontWeight: 700, fontSize: '14px' }}>★</div>
          <div style={{ flex: 1, fontSize: '13.5px', lineHeight: 1.5, color: 'rgba(250,250,247,0.85)' }}>
            Once you finish setup, your first 20 applications will go out as <b style={{ color: 'var(--acid, #C7F94A)' }}>drafts</b> for you to review — not auto-sent. You stay in control until you&apos;re confident.
          </div>
        </div>
      </main>
    </div>
  );
}
