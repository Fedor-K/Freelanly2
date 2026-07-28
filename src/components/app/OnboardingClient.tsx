'use client';

import { useState, useRef } from 'react';

// Onboarding is now a SINGLE real action: add résumé OR LinkedIn to unlock the feed (owner 2026-07-28).
// The old role-picker, the fake "1 Your background · 2 Categories · 3 Email" step bar (steps 2 & 3 never
// existed — Continue went straight to the feed), and the "first 20 applications go out as drafts" banner
// (describes dead auto-apply) were removed as misleading cruft.
export function OnboardingClient({ firstName, email, hasResume, hasLinkedin }: { firstName: string; email: string; hasResume: boolean; hasLinkedin: boolean }) {
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
      const res = await fetch('/api/user/resume', { method: 'POST', body: formData });
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
    // Résumé OR LinkedIn — either one unlocks the feed. LinkedIn-only generates a CV via resume-preauth
    // (same as the OTP signup flow), which sets resumeUrl — the gate every dashboard page checks.
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

  const resumeOk = hasResume || !!uploadResult?.includes('!');
  const linkedinOk = hasLinkedin || /linkedin\.com\/in\//i.test(linkedinUrl.trim());
  const anyOk = resumeOk || linkedinOk;
  const greeting = firstName && firstName !== 'there' ? `Almost there, ${firstName}` : 'One step to unlock your feed';

  return (
    <div className="onboard-shell">
      <header className="onboard-top">
        <div className="onboard-logo">freelanly</div>
        <span></span>
      </header>

      <main className="onboard-main">
        <h1 className="onboard-h">{greeting}</h1>
        <p className="onboard-sub">Add your résumé <b>or</b> LinkedIn — either one unlocks your matched roles. You can change it anytime.</p>

        <div style={{ marginTop: '28px' }}>
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
            <button className="btn btn-acid" onClick={handleContinue} disabled={saving || !anyOk}>
              {saving ? 'Saving...' : !anyOk ? 'Add résumé or LinkedIn to continue' : 'Continue → Dashboard'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
