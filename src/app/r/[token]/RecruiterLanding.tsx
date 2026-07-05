'use client';

import { useState } from 'react';

export type AnonCandidate = {
  appId: string;
  profession: string;
  location: string | null;
  whyFit: string | null;
  strength: string | null;      // Strong | Good | Weak
  years: number | null;
  skills: string[];
  matched: number | null;
  total: number | null;
  availability: string | null;
  availableFrom: string | null;
  salaryExpectation: string | null;
  timezone: string | null;
  githubVerified: boolean;
  hasPortfolio: boolean;
};

const STRENGTH: Record<string, { c: string; bg: string }> = {
  Strong: { c: '#166534', bg: '#dcfce7' },
  Good: { c: '#1e40af', bg: '#dbeafe' },
  Weak: { c: '#6b7280', bg: '#f3f4f6' },
};

export function RecruiterLanding({ token, company, role, candidates }: {
  token: string; company: string; role: string; candidates: AnonCandidate[];
}) {
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');

  async function interested() {
    setState('sending');
    try {
      const res = await fetch('/api/recruiter/interest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
      });
      setState(res.ok ? 'done' : 'idle');
    } catch { setState('idle'); }
  }

  const n = candidates.length;
  return (
    <div style={{ minHeight: '100vh', background: '#FBFAF6', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#0B0C0F' }}>
      {/* brand bar */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #ececec', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 26, height: 26, borderRadius: 7, background: '#C7F94A', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 15 }}>F</span>
        <strong style={{ fontSize: 15 }}>Freelanly</strong>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: '#8A8780', background: '#f0efe9', padding: '2px 6px', borderRadius: 5 }}>FOR RECRUITERS</span>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px 140px' }}>
        {/* hero */}
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 10px', lineHeight: 1.2 }}>
          {n} vetted candidate{n === 1 ? '' : 's'} for your{role ? ` ${role}` : ''} role{company ? `, ${company}` : ''}
        </h1>
        <p style={{ fontSize: 15, color: '#555', margin: '0 0 28px', lineHeight: 1.55 }}>
          We matched these from our pool and vetted each against your requirements. Profiles are anonymized —
          tell us you&apos;re interested and we&apos;ll introduce you to the ones you want, with CVs and contact.
        </p>

        {/* candidate cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {candidates.map((c, i) => {
            const s = STRENGTH[c.strength || 'Weak'] || STRENGTH.Weak;
            return (
              <div key={c.appId} style={{ border: '1px solid #e6e4dd', borderRadius: 14, padding: 18, background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#C7F94A', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>#{i + 1}</span>
                  <strong style={{ fontSize: 16 }}>{c.profession}</strong>
                  {c.strength && <span style={{ fontSize: 11, fontWeight: 700, color: s.c, background: s.bg, padding: '2px 9px', borderRadius: 20 }}>{c.strength} match</span>}
                </div>
                <div style={{ fontSize: 13.5, color: '#555', marginBottom: 8, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  {c.location && <span>📍 {c.location}</span>}
                  {c.timezone && <span>🕒 {c.timezone}</span>}
                  {c.years != null && <span>🧭 {c.years} yr{c.years === 1 ? '' : 's'} experience</span>}
                  {c.availableFrom && <span>▶ starts {c.availableFrom}</span>}
                  {c.availability && <span>{c.availability}</span>}
                  {c.salaryExpectation && <span>💵 {c.salaryExpectation} <span style={{ color: '#999' }}>(expected)</span></span>}
                  {c.matched != null && c.total != null && c.total > 0 && <span>✓ matches {c.matched} of {c.total} requirements</span>}
                </div>
                {(c.githubVerified || c.hasPortfolio) && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {c.githubVerified && <span style={{ fontSize: 11, fontWeight: 700, color: '#166534', background: '#dcfce7', borderRadius: 5, padding: '3px 8px' }}>✓ GitHub-verified</span>}
                    {c.hasPortfolio && <span style={{ fontSize: 11, color: '#555', background: '#f0efe9', borderRadius: 5, padding: '3px 8px' }}>Portfolio available</span>}
                  </div>
                )}
                {c.skills.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {c.skills.slice(0, 8).map((sk, j) => (
                      <span key={j} style={{ fontSize: 12, background: '#f5f4ef', border: '1px solid #e6e4dd', borderRadius: 6, padding: '3px 8px' }}>{sk}</span>
                    ))}
                  </div>
                )}
                {c.whyFit && (
                  <div style={{ marginTop: 10, fontSize: 13.5, color: '#3a3a3a', lineHeight: 1.55, background: '#f8faf0', border: '1px solid #e8f0d0', borderRadius: 8, padding: '10px 12px' }}>
                    <span style={{ fontWeight: 700, color: '#5a6b1e' }}>Why this fit: </span>{c.whyFit}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {n === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#888', border: '1px dashed #ddd', borderRadius: 14 }}>
            No candidates to show right now — check back from your latest shortlist email.
          </div>
        )}
      </div>

      {/* sticky CTA */}
      {n > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px 24px', background: 'rgba(251,250,246,0.92)', backdropFilter: 'blur(8px)', borderTop: '1px solid #e6e4dd' }}>
          <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            {state === 'done' ? (
              <div style={{ fontSize: 15, fontWeight: 600, color: '#166534' }}>✓ Thanks! We&apos;ll be in touch shortly to introduce you to these candidates.</div>
            ) : (
              <>
                <div style={{ fontSize: 13.5, color: '#555' }}>Like what you see? We&apos;ll introduce you — free.</div>
                <button onClick={interested} disabled={state === 'sending'}
                  style={{ padding: '13px 26px', borderRadius: 12, border: 'none', background: '#0B0C0F', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {state === 'sending' ? 'Sending…' : "I'm interested — I want to hire"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
