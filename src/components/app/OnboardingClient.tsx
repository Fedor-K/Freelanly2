'use client';

import { useState, useRef } from 'react';

// Tech-niche role cards (owner 2026-07-23): the product is for remote tech candidates —
// engineering / data / devops / qa. The old generic-freelancer set (designer/marketer/consultant/
// studio) invited audiences the feed no longer serves.
const ROLES = [
  { id: 'frontend', ico: '{ }', title: 'Frontend / full-stack developer', desc: 'React, Vue, Angular, Node, TypeScript. Remote roles and contract work.', tags: ['React', 'TypeScript', 'Node'] },
  { id: 'backend', ico: '⚙', title: 'Backend / cloud & DevOps', desc: 'APIs, Python, Java, Go, .NET, AWS, Kubernetes, SRE, platform work.', tags: ['Python', 'AWS', 'K8s'] },
  { id: 'data', ico: '◫', title: 'Data / ML engineer or analyst', desc: 'Pipelines, analytics, BI, machine learning, LLM engineering.', tags: ['SQL', 'Python', 'ML'] },
  { id: 'qa', ico: '✓', title: 'QA / automation engineer', desc: 'Manual and automated testing, SDET, test frameworks, quality tooling.', tags: ['Automation', 'SDET'] },
  { id: 'mobile', ico: '▯', title: 'Mobile developer', desc: 'iOS, Android, React Native, Flutter. Product and contract roles.', tags: ['iOS', 'Android', 'Flutter'] },
  { id: 'other', ico: '+', title: 'Something else', desc: "We'll build your profile from your résumé — it works for any role.", tags: [] },
];

export function OnboardingClient({ firstName, email, hasResume, hasLinkedin }: { firstName: string; email: string; hasResume: boolean; hasLinkedin: boolean }) {
  const [selectedRole, setSelectedRole] = useState('engineer');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [linkedinError, setLinkedinError] = useState<string | null>(null);
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
    // Phase-1 minimal onboarding (owner 2026-07-23): résumé OR LinkedIn — either one unlocks the
    // feed. No-file path generates a CV from the LinkedIn profile via resume-preauth (same as the
    // OTP signup flow), which is what actually sets resumeUrl — the gate every dashboard page checks.
    const liVal = linkedinUrl.trim();
    const resumeOk = hasResume || !!uploadResult?.includes('!');
    const linkedinOk = hasLinkedin || /linkedin\.com\/in\//i.test(liVal);
    if (!resumeOk && !linkedinOk) {
      setLinkedinError('Add your LinkedIn URL — or upload a résumé.');
      return;
    }
    setLinkedinError(null);
    setSaving(true);
    try {
      // Save role preference (best-effort)
      await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selectedRole }),
      }).catch(() => {});

      if (!resumeOk && linkedinOk) {
        // LinkedIn-only: scrape → parse → GENERATE a CV (sets resumeUrl + creates the loop).
        const fd = new FormData();
        fd.append('email', email);
        fd.append('linkedinUrl', liVal);
        fd.append('buildFromLinks', 'true');
        const pre = await fetch('/api/user/resume-preauth', { method: 'POST', body: fd });
        if (!pre.ok) {
          const d = await pre.json().catch(() => ({}));
          setSaving(false);
          setLinkedinError(typeof (d as { error?: string }).error === 'string'
            ? (d as { error?: string }).error!
            : 'Could not read that LinkedIn profile — check the URL or upload a résumé instead.');
          return;
        }
      } else if (!hasLinkedin && liVal) {
        // Résumé already on file + LinkedIn entered → enrichment only, best-effort (never blocks).
        await fetch('/api/user/linkedin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: liVal }),
        }).catch(() => {});
      }

      // Mark onboarding complete
      await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'complete' }),
      });

      window.location.href = '/dashboard/discovery';
    } catch {
      window.location.href = '/dashboard/discovery';
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
        <p className="onboard-sub">Pick a starting profile — it helps us understand what you do. You can adjust anything later.</p>

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
          <h3 style={{ fontSize: '14px', fontWeight: 500, margin: '0 0 10px' }}>Add your résumé <b>or</b> LinkedIn — either one unlocks your feed</h3>
          <div className="grid grid-2" style={{ gap: '12px' }}>
            <div className="import-card">
              <div className="ico">in</div>
              <div style={{ fontSize: '13.5px', fontWeight: 500, marginBottom: '4px' }}>LinkedIn URL{hasLinkedin && <span style={{ color: 'var(--good, #047857)' }}> ✓ on file</span>}</div>
              <div className="meta">No CV file? We&apos;ll build one from your LinkedIn</div>
              <input
                className="field"
                placeholder={hasLinkedin ? 'Already linked — leave blank to keep it' : 'linkedin.com/in/yourname'}
                value={linkedinUrl}
                onChange={e => { setLinkedinUrl(e.target.value); if (linkedinError) setLinkedinError(null); }}
                style={{ marginTop: '12px', padding: '7px 10px', fontSize: '12px', width: '100%' }}
              />
              {linkedinError && <div style={{ fontSize: '12px', marginTop: '6px', color: '#B91C1C' }}>{linkedinError}</div>}
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
            {(() => {
              const resumeOk = hasResume || !!uploadResult?.includes('!');
              const linkedinOk = hasLinkedin || /linkedin\.com\/in\//i.test(linkedinUrl.trim());
              const anyOk = resumeOk || linkedinOk;
              const label = saving ? 'Saving...' : !anyOk ? 'Add résumé or LinkedIn to continue' : 'Continue → Dashboard';
              return (
                <button className="btn btn-acid" onClick={handleContinue} disabled={saving || !anyOk}>
                  {label}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </button>
              );
            })()}
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
