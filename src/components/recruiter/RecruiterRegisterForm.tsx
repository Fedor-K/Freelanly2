'use client';

import { useState } from 'react';

// First-touch recruiter registration, shown once before the candidate list on /r/[token].
// Three short fields, all pre-filled from what we already know (email from the token, company
// guessed from the domain, role from their most-applied jobTitle). No password / no code — the
// link proves the inbox. On success we reload so the (now-registered) server page shows candidates.
const VOLUMES = ['1', '2-5', '6-20', '20+'] as const;

export function RecruiterRegisterForm({
  token,
  email,
  candidateCount,
  prefill,
}: {
  token: string;
  email: string;
  candidateCount: number;
  prefill: { company: string; hiringFor: string };
}) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState(prefill.company);
  const [hiringFor, setHiringFor] = useState(prefill.hiringFor);
  const [hiringVolume, setHiringVolume] = useState<string>('');
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle');

  async function submit() {
    if (state === 'saving') return;
    setState('saving');
    try {
      const r = await fetch('/api/recruiter/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name, company, hiringFor, hiringVolume }),
      });
      if (!r.ok) throw new Error();
      window.location.reload(); // server page now finds the Recruiter row → renders the list
    } catch {
      setState('error');
    }
  }

  const label: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 600, margin: '0 0 5px', color: '#0B0C0F' };
  const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #E8E5DC', borderRadius: '9px', fontSize: '14px' };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'system-ui, sans-serif', color: '#0B0C0F' }}>
      <div style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg-1)', padding: '16px 24px' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto' }}><strong style={{ fontSize: '16px' }}>Freelanly</strong></div>
      </div>

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '40px 24px 64px' }}>
        <h1 style={{ fontSize: '22px', margin: '0 0 6px' }}>
          {candidateCount > 0
            ? `${candidateCount} candidate${candidateCount === 1 ? '' : 's'} applied to your roles`
            : 'Set up your recruiter view'}
        </h1>
        <p className="meta" style={{ margin: '0 0 24px' }}>
          A few quick details and you’ll see them. Takes 10 seconds — no password needed.
        </p>

        <div className="card" style={{ padding: '22px' }}>
          <div style={{ marginBottom: '16px' }}>
            <span style={label}>Your email</span>
            <input value={email} readOnly disabled style={{ ...input, background: '#F6F5F1', color: '#8A8780' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={label}>Your name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane" style={input} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={label}>Company</label>
              <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme" style={input} />
            </div>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={label}>What are you hiring for?</label>
            <input value={hiringFor} onChange={(e) => setHiringFor(e.target.value)} placeholder="e.g. React developer, Interpreter" style={input} />
          </div>
          <div style={{ marginBottom: '22px' }}>
            <label style={label}>How many people are you looking to hire?</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {VOLUMES.map((v) => (
                <button
                  key={v}
                  onClick={() => setHiringVolume(v)}
                  style={{
                    flex: 1, padding: '9px 0', borderRadius: '9px', fontSize: '14px', cursor: 'pointer',
                    border: hiringVolume === v ? '1.5px solid #0B0C0F' : '1px solid #E8E5DC',
                    background: hiringVolume === v ? '#0B0C0F' : '#fff',
                    color: hiringVolume === v ? '#fff' : '#0B0C0F', fontWeight: hiringVolume === v ? 600 : 400,
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={submit}
            disabled={state === 'saving'}
            className="btn"
            style={{ width: '100%', padding: '13px', fontSize: '15px', fontWeight: 600, background: '#0B0C0F', color: '#fff', border: 0, borderRadius: '10px', cursor: state === 'saving' ? 'default' : 'pointer', opacity: state === 'saving' ? 0.6 : 1 }}
          >
            {state === 'saving'
              ? 'Loading…'
              : candidateCount > 0
                ? `See your ${candidateCount} candidate${candidateCount === 1 ? '' : 's'} →`
                : 'Continue →'}
          </button>
          {state === 'error' && (
            <p style={{ color: '#c0392b', fontSize: '13px', margin: '10px 0 0', textAlign: 'center' }}>Something went wrong — try again.</p>
          )}
        </div>
      </div>
    </div>
  );
}
