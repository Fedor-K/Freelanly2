'use client';

import { useState, useEffect, useRef } from 'react';
import { useTracker } from '@/hooks/useTracker';

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

export function ProjectPageClient({ project, signals, similar }: ProjectProps) {
  const { track } = useTracker();
  const [showAuth, setShowAuth] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const startTime = useRef(Date.now());
  const scrollDepth = useRef(0);

  // Track page view + time on page + scroll depth
  useEffect(() => {
    track('PAGE_VIEW', { page: 'project', projectId: project.id, title: project.title, company: project.companyName });

    const handleScroll = () => {
      const depth = Math.round((window.scrollY + window.innerHeight) / document.body.scrollHeight * 100);
      if (depth > scrollDepth.current) scrollDepth.current = depth;
    };
    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      const timeSpent = Math.round((Date.now() - startTime.current) / 1000);
      track('PAGE_VIEW', { page: 'project_exit', projectId: project.id, timeSpent, scrollDepth: scrollDepth.current });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleApply() {
    if (!email) {
      track('OPPORTUNITY_APPLY_CLICK', { projectId: project.id, step: 'show_email' });
      setShowAuth(true);
      return;
    }
    track('SIGNUP_START', { projectId: project.id, email });
    setLoading(true);
    try {
      // Check if user exists
      const checkRes = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const checkData = await checkRes.json();

      if (checkData.exists) {
        // Existing user — send code and show OTP input
        const { signIn } = await import('next-auth/react');
        await signIn('resend', { email, callbackUrl: '/dashboard', redirect: false });
        setSent(true);
      } else {
        // New user — redirect to registration form
        window.location.href = `/auth/signin?email=${encodeURIComponent(email)}&ref=project&projectId=${project.id}`;
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

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
        window.location.href = '/dashboard/auto-apply';
      } else {
        setOtpError(data.error || 'Invalid code');
        setOtpCode('');
      }
    } catch {
      setOtpError('Something went wrong. Please try again.');
    } finally {
      setOtpLoading(false);
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
        <a href="/auth/signin" onClick={() => track('SIGNUP_START', { projectId: project.id, source: 'nav_button' })} style={{ padding: '8px 16px', background: '#C7F94A', color: '#000', borderRadius: '8px', fontSize: '13px', fontWeight: 500, textDecoration: 'none' }}>Sign up free</a>
      </nav>

      <div className="project-layout" style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px', display: 'grid', gridTemplateColumns: '1fr 380px', gap: '40px', alignItems: 'start' }}>
        {/* Left: project details */}
        <div className="project-main">
          {/* Breadcrumb */}
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

          {/* Skills */}
          {project.skills.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '24px' }}>
              {project.skills.map(s => (
                <span key={s} style={{ padding: '4px 10px', background: '#F0EDE5', borderRadius: '6px', fontSize: '12px', color: '#555' }}>{s}</span>
              ))}
            </div>
          )}

          {/* Description */}
          <div style={{ fontSize: '15px', lineHeight: 1.7, color: '#333', whiteSpace: 'pre-wrap' }}>
            {project.description}
          </div>

          {/* Poster — hidden, contact info behind platform */}

          {/* Similar */}
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
        <div className="project-sidebar" style={{ position: 'sticky', top: '24px' }}>
          <div style={{ background: '#fff', border: '1px solid #E8E5DC', borderRadius: '16px', padding: '28px', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
            {/* Signals */}
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

            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', letterSpacing: '-0.02em' }}>Apply with AI cover letter</h2>
            <p style={{ fontSize: '14px', color: '#8A8780', lineHeight: 1.5, marginBottom: '20px' }}>
              AI writes a personalized application in 19 seconds. Just upload your resume.
            </p>

            {!showAuth && !sent && (
              <button onClick={() => setShowAuth(true)} style={{
                width: '100%', padding: '14px', background: '#C7F94A', color: '#000', border: 'none',
                borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginBottom: '12px',
              }}>
                Apply now — free
              </button>
            )}

            {showAuth && !sent && (
              <div>
                <input
                  type="email" placeholder="you@email.com" value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleApply()}
                  autoFocus
                  style={{ width: '100%', padding: '12px', border: '1px solid #D5D1C8', borderRadius: '8px', fontSize: '14px', marginBottom: '8px' }}
                />
                <button onClick={handleApply} disabled={loading || !email} style={{
                  width: '100%', padding: '14px', background: '#C7F94A', color: '#000', border: 'none',
                  borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1,
                }}>
                  {loading ? 'Sending code...' : 'Send me a code →'}
                </button>
              </div>
            )}

            {sent && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ padding: '10px', background: '#ECFDF5', borderRadius: '10px', fontSize: '13px', color: '#047857', marginBottom: '12px' }}>
                  Code sent to {email}
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="Enter 6-digit code"
                  value={otpCode}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtpCode(v);
                    setOtpError('');
                    if (v.length === 6) handleOtpSubmit(v);
                  }}
                  autoFocus
                  disabled={otpLoading}
                  style={{ width: '100%', padding: '14px', border: `1px solid ${otpError ? '#B91C1C' : '#D5D1C8'}`, borderRadius: '8px', fontSize: '18px', textAlign: 'center', letterSpacing: '8px', fontWeight: 600, marginBottom: '8px' }}
                />
                {otpError && <div style={{ fontSize: '12px', color: '#B91C1C', marginBottom: '8px' }}>{otpError}</div>}
                {otpLoading && <div style={{ fontSize: '12px', color: '#047857' }}>Verifying...</div>}
                <button onClick={() => { setSent(false); setOtpCode(''); setOtpError(''); }} style={{ fontSize: '12px', color: '#8A8780', background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px' }}>
                  Use a different email
                </button>
              </div>
            )}

            <div style={{ marginTop: '16px', fontSize: '12px', color: '#8A8780', textAlign: 'center' }}>
              No credit card · First 15 applications free
            </div>
          </div>

          {/* Preview */}
          <div style={{ marginTop: '16px', padding: '20px', background: '#fff', border: '1px solid #E8E5DC', borderRadius: '12px' }}>
            <div style={{ fontSize: '11px', fontFamily: "'Geist Mono', monospace", color: '#8A8780', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '8px' }}>AI cover letter preview</div>
            <div style={{ fontSize: '13px', color: '#AAA', lineHeight: 1.6, fontStyle: 'italic' }}>
              &ldquo;Hi [Hiring Manager], I saw your post — I&apos;ve [relevant experience] using [matching skills], and it&apos;s the work I&apos;m most excited about...&rdquo;
            </div>
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#8A8780' }}>Generated in ~19 seconds from your resume</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ maxWidth: '1100px', margin: '60px auto 0', padding: '24px', borderTop: '1px solid #E8E5DC', fontSize: '12px', color: '#8A8780', textAlign: 'center' }}>
        © 2026 Freelanly · <a href="/terms" style={{ color: '#8A8780' }}>Terms</a> · <a href="/privacy" style={{ color: '#8A8780' }}>Privacy</a>
      </div>
    </div>
  );
}
