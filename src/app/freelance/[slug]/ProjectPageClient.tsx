'use client';

import { useState, useEffect, useRef } from 'react';
import { useTracker } from '@/hooks/useTracker';
import { categories, languages } from '@/config/site';

interface ProjectProps {
  project: {
    id: string;
    title: string;
    description: string;
    companyName: string;
    skills: string[];
    location: string | null;
    locationType: string | null;
    country: string | null;
    level: string | null;
    category: string | null;
    postedAgo: string;
    sourceUrl: string | null;
    poster: { name: string; headline: string | null; avatar: string | null; linkedIn: string | null } | null;
  };
  signals: { applicationCount: number; isEarly: boolean; totalProjects: number };
  similar: Array<{ slug: string; title: string; companyName: string; skills: string[] }>;
}

type Phase = 'guest' | 'auth' | 'generating' | 'review' | 'sent';

export function ProjectPageClient({ project, signals, similar }: ProjectProps) {
  const { track } = useTracker();
  const startTime = useRef(Date.now());
  const scrollDepth = useRef(0);

  // Main phase
  const [phase, setPhase] = useState<Phase>('guest');

  // Auth state
  const [email, setEmail] = useState('');
  const [isExisting, setIsExisting] = useState<boolean | null>(null);
  const [hasResume, setHasResume] = useState<boolean | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // OTP state
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');

  // Cover letter state
  const [coverLetter, setCoverLetter] = useState('');
  const [subject, setSubject] = useState('');
  const [sendTo, setSendTo] = useState('');
  const [genError, setGenError] = useState('');

  // Send state
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  // Check if already authenticated + auto-apply on ?apply=1
  const [isAuthed, setIsAuthed] = useState(false);
  useEffect(() => {
    const hasApplyFlag = new URLSearchParams(window.location.search).get('apply') === '1';

    // If ?apply=1, skip settings check and go straight to cover letter
    if (hasApplyFlag) {
      const url = new URL(window.location.href);
      url.searchParams.delete('apply');
      window.history.replaceState({}, '', url.toString());
      setIsAuthed(true);
      setPhase('generating');
      fetch('/api/user/quick-apply', { credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: project.id, draftOnly: true }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.ok || data.coverLetter) {
            setCoverLetter(data.coverLetter || '');
            setSubject(data.subject || `Application: ${project.title}`);
            setSendTo(data.to || '');
            setPhase('review');
          } else if (data.error === 'already_applied') {
            setGenError('You already applied to this project.');
            setPhase('sent');
          } else {
            setCoverLetter('');
            setSubject(`Application: ${project.title}`);
            setGenError(data.message || 'Write your cover letter below.');
            setPhase('review');
          }
        })
        .catch(() => {
          setCoverLetter('');
          setSubject(`Application: ${project.title}`);
          setGenError('Write your cover letter below.');
          setPhase('review');
        });
      return;
    }

    // Normal auth check
    fetch('/api/user/settings', { method: 'GET', credentials: 'include' })
      .then(r => { if (r.ok) setIsAuthed(true); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track page view
  useEffect(() => {
    track('PAGE_VIEW', { page: 'project', projectId: project.id, title: project.title, company: project.companyName });
    const handleScroll = () => {
      const depth = Math.round((window.scrollY + window.innerHeight) / document.body.scrollHeight * 100);
      if (depth > scrollDepth.current) scrollDepth.current = depth;
    };
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      track('PAGE_VIEW', { page: 'project_exit', projectId: project.id, timeSpent: Math.round((Date.now() - startTime.current) / 1000), scrollDepth: scrollDepth.current });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check email on blur
  async function checkEmail() {
    if (!email || !email.includes('@') || !email.includes('.')) return;
    setCheckingEmail(true);
    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setIsExisting(data.exists);
      setHasResume(data.hasResume ?? false);
    } catch {
      setIsExisting(null);
      setHasResume(null);
    } finally {
      setCheckingEmail(false);
    }
  }

  // Send OTP code
  async function handleSendCode() {
    if (!email || isExisting === null) return;
    setAuthLoading(true);
    setAuthError('');

    try {
      // Validate for users without resume
      if (hasResume === false && selectedCategories.length === 0) {
        setAuthError('Select at least one job category');
        setAuthLoading(false);
        return;
      }

      // Register (new users) or update alerts (existing without resume)
      if (hasResume === false) {
        // Only call register for new users; for existing users just upload resume
        if (isExisting === false) {
          const regRes = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              categories: selectedCategories,
              languages: selectedCategories.includes('translation') ? selectedLanguages : undefined,
              agreedToTerms: true,
            }),
          });
          if (!regRes.ok) {
            const data = await regRes.json();
            throw new Error(data.error || 'Registration failed');
          }
        }

        // Upload resume (non-blocking)
        if (resumeFile) {
          const fd = new FormData();
          fd.append('file', resumeFile);
          fd.append('email', email);
          if (linkedinUrl) fd.append('linkedinUrl', linkedinUrl);
          fetch('/api/user/resume-preauth', { method: 'POST', body: fd }).catch(() => {});
        } else if (linkedinUrl) {
          const fd = new FormData();
          fd.append('email', email);
          fd.append('linkedinUrl', linkedinUrl);
          fetch('/api/user/resume-preauth', { method: 'POST', body: fd }).catch(() => {});
        }
      }

      // Send magic link / OTP
      const { signIn } = await import('next-auth/react');
      await signIn('resend', { email, callbackUrl: '/dashboard', redirect: false });

      setCodeSent(true);
      setOtpCode('');
      setOtpError('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setAuthLoading(false);
    }
  }

  // Verify OTP → generate cover letter
  async function handleOtpSubmit(code: string) {
    if (code.length !== 6) return;
    setOtpLoading(true);
    setOtpError('');
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Authenticated! Reload with apply flag to trigger cover letter generation
        const url = new URL(window.location.href);
        url.searchParams.set('apply', '1');
        window.location.href = url.toString();
        return;
      } else {
        setOtpError(data.error || 'Invalid code');
        setOtpCode('');
      }
    } catch {
      setOtpError('Something went wrong');
    } finally {
      setOtpLoading(false);
    }
  }

  // Generate AI cover letter
  async function generateCoverLetter() {
    setGenError('');
    try {
      const res = await fetch('/api/user/quick-apply', { credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: project.id, draftOnly: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setCoverLetter(data.coverLetter || '');
        setSubject(data.subject || `Application: ${project.title}`);
        setSendTo(data.to || '');
        setPhase('review');
      } else {
        if (data.error === 'resume_required') {
          setGenError('Resume required. Please go back and upload your resume.');
          setPhase('auth');
        } else if (data.error === 'already_applied') {
          setGenError('You already applied to this project.');
          setPhase('sent');
        } else {
          // Let user write their own
          setCoverLetter('');
          setSubject(`Application: ${project.title}`);
          setSendTo('');
          setGenError(data.error || 'Could not generate cover letter. Write your own below.');
          setPhase('review');
        }
      }
    } catch {
      setCoverLetter('');
      setSubject(`Application: ${project.title}`);
      setGenError('Generation failed. Write your cover letter below.');
      setPhase('review');
    }
  }

  // Send application
  async function handleSend() {
    setSending(true);
    setSendError('');
    try {
      const res = await fetch('/api/user/quick-apply', { credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: project.id, coverLetter, subject }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSendTo(data.sentTo || sendTo);
        setPhase('sent');
        track('JOB_APPLY', { projectId: project.id, method: 'project_page' });
      } else {
        setSendError(data.message || data.error || 'Failed to send');
      }
    } catch {
      setSendError('Network error. Try again.');
    } finally {
      setSending(false);
    }
  }

  // Whether code has been sent (we're waiting for OTP)
  const [codeSent, setCodeSent] = useState(false);

  // Render CTA card content based on phase
  function renderCTA() {
    // PHASE: GUEST — show "Apply now" button
    if (phase === 'guest') {
      return (
        <>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', letterSpacing: '-0.02em' }}>Apply with AI cover letter</h2>
          <p style={{ fontSize: '14px', color: '#8A8780', lineHeight: 1.5, marginBottom: '20px' }}>
            AI writes a personalized application in 19 seconds. Just upload your resume.
          </p>
          <button onClick={() => {
            track('OPPORTUNITY_APPLY_CLICK', { projectId: project.id });
            if (isAuthed) {
              setPhase('generating');
              generateCoverLetter();
            } else {
              setPhase('auth');
            }
          }} style={{
            width: '100%', padding: '14px', background: '#C7F94A', color: '#000', border: 'none',
            borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer',
          }}>
            Apply now — free
          </button>
          <div style={{ marginTop: '16px', fontSize: '12px', color: '#8A8780', textAlign: 'center' }}>
            No credit card · First 20 applications free
          </div>
        </>
      );
    }

    // PHASE: AUTH — email + onboarding fields + OTP
    if (phase === 'auth') {
      if (codeSent) {
        // OTP input
        return (
          <div style={{ textAlign: 'center' }}>
            <div style={{ padding: '10px', background: '#ECFDF5', borderRadius: '10px', fontSize: '13px', color: '#047857', marginBottom: '12px' }}>
              Code sent to {email}
            </div>
            <input
              type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
              placeholder="000000" value={otpCode}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                setOtpCode(v);
                setOtpError('');
                if (v.length === 6) handleOtpSubmit(v);
              }}
              autoFocus disabled={otpLoading}
              style={{ width: '100%', padding: '14px', border: `1px solid ${otpError ? '#B91C1C' : '#D5D1C8'}`, borderRadius: '8px', fontSize: '24px', textAlign: 'center', letterSpacing: '12px', fontWeight: 600, marginBottom: '8px', fontFamily: "'Geist Mono', monospace" }}
            />
            {otpError && <div style={{ fontSize: '12px', color: '#B91C1C', marginBottom: '8px' }}>{otpError}</div>}
            {otpLoading && <div style={{ fontSize: '12px', color: '#047857' }}>Verifying...</div>}
            {genError && <div style={{ fontSize: '12px', color: '#B91C1C', marginBottom: '8px' }}>{genError}</div>}
            <button onClick={() => { setCodeSent(false); setOtpCode(''); setOtpError(''); }} style={{ fontSize: '12px', color: '#8A8780', background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px' }}>
              ← Back
            </button>
          </div>
        );
      }

      // Email + onboarding fields
      return (
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>Enter your email to apply</h2>

          <input
            type="email" placeholder="you@email.com" value={email}
            onChange={e => { setEmail(e.target.value); setIsExisting(null); setHasResume(null); }}
            onBlur={checkEmail}
            onKeyDown={e => e.key === 'Enter' && isExisting !== null && handleSendCode()}
            autoFocus
            style={{ width: '100%', padding: '12px', border: '1px solid #D5D1C8', borderRadius: '8px', fontSize: '14px', marginBottom: '8px' }}
          />
          {checkingEmail && <div style={{ fontSize: '11px', color: '#8A8780', marginBottom: '8px' }}>Checking...</div>}

          {/* Onboarding fields for users without resume */}
          {hasResume === false && isExisting !== null && (
            <div style={{ marginTop: '8px' }}>
              {/* Resume upload */}
              <div style={{ marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#555', display: 'block', marginBottom: '4px' }}>Resume (PDF)</label>
                <div
                  onClick={() => { const inp = document.getElementById('resume-input') as HTMLInputElement; inp?.click(); }}
                  style={{ padding: '10px 14px', border: '1px dashed #D5D1C8', borderRadius: '8px', fontSize: '13px', color: resumeFile ? '#047857' : '#8A8780', cursor: 'pointer', background: resumeFile ? '#ECFDF5' : '#fff' }}
                >
                  {resumeFile ? `✓ ${resumeFile.name}` : 'Click to upload PDF'}
                  <input id="resume-input" type="file" accept=".pdf,.docx" hidden onChange={e => setResumeFile(e.target.files?.[0] || null)} />
                </div>
              </div>

              {/* LinkedIn */}
              <div style={{ marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#555', display: 'block', marginBottom: '4px' }}>LinkedIn <span style={{ color: '#AAA' }}>optional</span></label>
                <input
                  type="url" placeholder="linkedin.com/in/yourname" value={linkedinUrl}
                  onChange={e => setLinkedinUrl(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #D5D1C8', borderRadius: '8px', fontSize: '13px' }}
                />
              </div>

              {/* Categories */}
              <div style={{ marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#555', display: 'block', marginBottom: '6px' }}>What kind of work?</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {categories.map(cat => (
                    <span
                      key={cat.slug}
                      onClick={() => setSelectedCategories(prev => prev.includes(cat.slug) ? prev.filter(c => c !== cat.slug) : [...prev, cat.slug])}
                      style={{
                        padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer',
                        background: selectedCategories.includes(cat.slug) ? '#0A0B0F' : '#F0EDE5',
                        color: selectedCategories.includes(cat.slug) ? '#fff' : '#555',
                      }}
                    >
                      {cat.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Languages for translation */}
              {selectedCategories.includes('translation') && (
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: '#555', display: 'block', marginBottom: '6px' }}>Your languages</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
                    {languages.filter(l => l.code !== 'EN').map(lang => (
                      <span
                        key={lang.code}
                        onClick={() => setSelectedLanguages(prev => prev.includes(lang.code) ? prev.filter(c => c !== lang.code) : [...prev, lang.code])}
                        style={{
                          padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer',
                          background: selectedLanguages.includes(lang.code) ? '#0A0B0F' : '#F0EDE5',
                          color: selectedLanguages.includes(lang.code) ? '#fff' : '#555',
                        }}
                      >
                        {lang.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {authError && <div style={{ fontSize: '13px', color: '#B91C1C', padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', marginBottom: '8px' }}>{authError}</div>}

          <button
            onClick={handleSendCode}
            disabled={authLoading || isExisting === null || (hasResume === false && selectedCategories.length === 0)}
            style={{
              width: '100%', padding: '14px', background: '#C7F94A', color: '#000', border: 'none',
              borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '8px',
              opacity: authLoading || isExisting === null ? 0.6 : 1,
            }}
          >
            {authLoading ? 'Sending code...' : 'Send me a code →'}
          </button>

          <button onClick={() => setPhase('guest')} style={{ fontSize: '12px', color: '#8A8780', background: 'none', border: 'none', cursor: 'pointer', marginTop: '8px', display: 'block', margin: '8px auto 0' }}>
            ← Back
          </button>
        </div>
      );
    }

    // PHASE: GENERATING
    if (phase === 'generating') {
      return (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>✍️</div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '6px' }}>Writing your cover letter...</h2>
          <p style={{ fontSize: '13px', color: '#8A8780' }}>AI is reading the job post and matching with your profile</p>
        </div>
      );
    }

    // PHASE: REVIEW
    if (phase === 'review') {
      return (
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>Review & send</h2>

          {sendTo && (
            <div style={{ fontSize: '12px', color: '#8A8780', marginBottom: '8px', fontFamily: "'Geist Mono', monospace" }}>
              To: {sendTo}
            </div>
          )}

          <div style={{ marginBottom: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: 500, color: '#8A8780', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subject</label>
            <input
              value={subject} onChange={e => setSubject(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #D5D1C8', borderRadius: '8px', fontSize: '13px', marginTop: '4px' }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', fontWeight: 500, color: '#8A8780', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cover letter</label>
            <textarea
              value={coverLetter} onChange={e => setCoverLetter(e.target.value)}
              rows={8}
              style={{ width: '100%', padding: '12px', border: '1px solid #D5D1C8', borderRadius: '8px', fontSize: '13px', lineHeight: 1.6, resize: 'vertical', marginTop: '4px' }}
            />
          </div>

          {genError && <div style={{ fontSize: '12px', color: '#B45309', marginBottom: '8px' }}>{genError}</div>}
          {sendError && <div style={{ fontSize: '12px', color: '#B91C1C', marginBottom: '8px' }}>{sendError}</div>}

          <button
            onClick={handleSend}
            disabled={sending || !coverLetter.trim()}
            style={{
              width: '100%', padding: '14px', background: '#C7F94A', color: '#000', border: 'none',
              borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer',
              opacity: sending ? 0.6 : 1,
            }}
          >
            {sending ? 'Sending...' : 'Send application →'}
          </button>

          <button
            onClick={() => { setPhase('generating'); generateCoverLetter(); }}
            style={{ fontSize: '12px', color: '#8A8780', background: 'none', border: 'none', cursor: 'pointer', marginTop: '8px', display: 'block', margin: '8px auto 0' }}
          >
            Regenerate cover letter
          </button>
        </div>
      );
    }

    // PHASE: SENT
    if (phase === 'sent') {
      return (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ width: '48px', height: '48px', background: '#ECFDF5', borderRadius: '50%', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '6px' }}>Application sent!</h2>
          {sendTo && <p style={{ fontSize: '13px', color: '#8A8780', marginBottom: '16px' }}>Sent to {sendTo}</p>}
          {genError && <p style={{ fontSize: '13px', color: '#8A8780', marginBottom: '16px' }}>{genError}</p>}
          <a href="/dashboard" style={{
            display: 'inline-block', padding: '12px 24px', background: '#C7F94A', color: '#000',
            borderRadius: '10px', fontSize: '14px', fontWeight: 600, textDecoration: 'none',
          }}>
            Go to Dashboard →
          </a>
          <p style={{ fontSize: '13px', color: '#555', marginTop: '12px', lineHeight: 1.5 }}>
            We&apos;ll notify you when the recruiter replies and start auto-applying to up to 20 projects every day matching your profile.
          </p>
          <a href="https://t.me/FLalarmbot" target="_blank" rel="noopener" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            marginTop: '12px', padding: '10px', background: '#E0F2FE', border: '1px solid #BAE6FD',
            borderRadius: '10px', textDecoration: 'none', color: '#0369A1', fontSize: '13px', fontWeight: 500,
          }}>
            <span>📱</span> Get instant alerts via Telegram
          </a>
        </div>
      );
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF7' }}>
      <style>{`
        @media (max-width: 768px) {
          .project-layout {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
            padding: 24px 16px !important;
          }
          .project-sidebar {
            position: static !important;
            order: -1;
          }
          .project-main h1 {
            font-size: 24px !important;
          }
        }
      `}</style>
      {/* Nav */}
      <nav style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E8E5DC', maxWidth: '1100px', margin: '0 auto' }}>
        <a href="/" style={{ fontWeight: 700, fontSize: '18px', color: '#000', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ background: '#000', color: '#fff', width: '28px', height: '28px', display: 'grid', placeItems: 'center', borderRadius: '7px', fontSize: '13px', fontWeight: 700 }}>F</span>
          Freelanly
        </a>
        <a href="/auth/signin" style={{ padding: '8px 16px', background: '#C7F94A', color: '#000', borderRadius: '8px', fontSize: '13px', fontWeight: 500, textDecoration: 'none' }}>Sign up free</a>
      </nav>

      <div className="project-layout" style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px', display: 'grid', gridTemplateColumns: '1fr 380px', gap: '40px', alignItems: 'start' }}>
        {/* Left: project details */}
        <div className="project-main">
          <div style={{ fontSize: '12px', color: '#8A8780', marginBottom: '16px', fontFamily: "'Geist Mono', monospace", letterSpacing: '0.04em' }}>
            <a href="/jobs" style={{ color: '#8A8780', textDecoration: 'none' }}>Jobs</a>
            {project.category && <> → <a href={`/jobs/${project.category.toLowerCase()}`} style={{ color: '#8A8780', textDecoration: 'none' }}>{project.category}</a></>}
            <> → {project.title}</>
          </div>

          <h1 style={{ fontSize: '32px', fontWeight: 600, letterSpacing: '-0.03em', marginBottom: '12px', lineHeight: 1.2 }}>{project.title}</h1>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 500, color: '#333' }}>{project.companyName}</span>
            {project.location && <span style={{ fontSize: '13px', color: '#8A8780' }}>{project.location}</span>}
            {project.level && <span style={{ fontSize: '12px', padding: '2px 8px', background: '#F0EDE5', borderRadius: '4px', color: '#555' }}>{project.level}</span>}
            <span style={{ fontSize: '12px', color: '#8A8780', fontFamily: "'Geist Mono', monospace" }}>Posted {project.postedAgo}</span>
          </div>

          {project.skills.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '24px' }}>
              {project.skills.map(s => (
                <span key={s} style={{ padding: '4px 10px', background: '#F0EDE5', borderRadius: '6px', fontSize: '12px', color: '#555' }}>{s}</span>
              ))}
            </div>
          )}

          <div style={{ fontSize: '15px', lineHeight: 1.7, color: '#333', whiteSpace: 'pre-wrap' }}>
            {project.description}
          </div>

          {similar.length > 0 && (
            <div style={{ marginTop: '40px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Similar projects</h3>
              {similar.map(s => (
                <a key={s.slug} href={`/freelance/${s.slug}`} onClick={() => track('JOB_VIEW', { projectId: project.id, type: 'similar_click', targetSlug: s.slug })} style={{ display: 'block', padding: '12px 16px', border: '1px solid #E8E5DC', borderRadius: '10px', marginBottom: '8px', textDecoration: 'none', color: '#333' }}>
                  <div style={{ fontWeight: 500, fontSize: '14px' }}>{s.title}</div>
                  <div style={{ fontSize: '12px', color: '#8A8780', marginTop: '2px' }}>{s.companyName} {s.skills.length > 0 && `· ${s.skills.join(', ')}`}</div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Right: CTA card */}
        <div className="project-sidebar" style={{ position: phase === 'guest' ? 'sticky' : 'static', top: '24px' }}>
          <div style={{ background: '#fff', border: '1px solid #E8E5DC', borderRadius: '16px', padding: '28px', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
            {/* Signals — only in guest/auth phase */}
            {(phase === 'guest' || phase === 'auth') && (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                {signals.isEarly && (
                  <span style={{ padding: '4px 10px', background: '#ECFDF5', color: '#047857', borderRadius: '6px', fontSize: '11px', fontWeight: 500, fontFamily: "'Geist Mono', monospace" }}>
                    Early · {signals.applicationCount} applied
                  </span>
                )}
                <span style={{ padding: '4px 10px', background: '#FEF3C7', color: '#92400E', borderRadius: '6px', fontSize: '11px', fontWeight: 500, fontFamily: "'Geist Mono', monospace" }}>
                  1 of {signals.totalProjects.toLocaleString()} projects
                </span>
              </div>
            )}

            {renderCTA()}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '60px auto 0', padding: '24px', borderTop: '1px solid #E8E5DC', fontSize: '12px', color: '#8A8780', textAlign: 'center' }}>
        © 2026 Freelanly · <a href="/terms" style={{ color: '#8A8780' }}>Terms</a> · <a href="/privacy" style={{ color: '#8A8780' }}>Privacy</a>
      </div>
    </div>
  );
}
