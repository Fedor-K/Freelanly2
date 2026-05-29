'use client';

import { useEffect, useState } from 'react';

// Dashboard prompt for EXISTING users to fill the few things recruiters ask for most after the CV:
// expected rate, when they can start, and a portfolio/GitHub link. The inline post-submit step only
// catches new applicants — this catches everyone else, in one place (no separate popups). Optional,
// dismissible (persisted). Candidate-side → contact-neutral. Posts to the salary + profile-extra endpoints.
const NOTICE_OPTIONS = ['Immediately', 'Within 2 weeks', 'Within a month', 'More than a month'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'PKR', 'PHP', 'IDR', 'NGN', 'BDT', 'BRL', 'EGP', 'AED', 'CAD', 'AUD'];

export function SalaryPrompt() {
  const [amt, setAmt] = useState('');
  const [cur, setCur] = useState('USD');
  const [per, setPer] = useState('mo');
  const [noticeFrom, setNoticeFrom] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [state, setState] = useState<'hidden' | 'open' | 'saving' | 'done'>('hidden');

  useEffect(() => {
    try { if (localStorage.getItem('salary_prompt_dismissed')) return; } catch { /* ignore */ }
    setState('open');
  }, []);

  async function save() {
    const hasSalary = !!amt.trim();
    const hasExtra = !!noticeFrom || !!portfolio.trim();
    if (!hasSalary && !hasExtra) return;
    setState('saving');
    try {
      const reqs: Promise<Response>[] = [];
      if (hasSalary) reqs.push(fetch('/api/user/salary-expectation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt, period: per, currency: cur }),
      }));
      if (hasExtra) reqs.push(fetch('/api/user/profile-extra', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availableFrom: noticeFrom || undefined, portfolioUrl: portfolio.trim() || undefined }),
      }));
      const results = await Promise.all(reqs);
      setState(results.every(r => r.ok) ? 'done' : 'open');
    } catch { setState('open'); }
  }
  function dismiss() { try { localStorage.setItem('salary_prompt_dismissed', '1'); } catch {} setState('hidden'); }

  if (state === 'hidden') return null;
  if (state === 'done') {
    return (
      <div style={{ margin: '0 0 16px', padding: '12px 16px', borderRadius: '12px', background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#047857', fontSize: '13px' }}>
        ✓ Saved — recruiters will see this on your applications.
      </div>
    );
  }

  const canSave = !!amt.trim() || !!noticeFrom || !!portfolio.trim();
  const inputStyle: React.CSSProperties = { padding: '9px 11px', border: '1px solid #E8E5DC', borderRadius: '8px', fontSize: '13px' };
  return (
    <div style={{ margin: '0 0 16px', padding: '14px 18px', borderRadius: '12px', background: '#fff', border: '1px solid #E8E5DC' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{ fontSize: '14px', fontWeight: 600 }}>Help recruiters say yes</span>
        <button onClick={dismiss} style={{ background: 'none', border: 'none', color: '#8A8780', fontSize: '12px', cursor: 'pointer' }}>Not now</button>
      </div>
      <div style={{ fontSize: '12.5px', color: '#8A8780', margin: '2px 0 10px' }}>The few things recruiters ask for most. All optional — fill what you like.</div>

      <div style={{ display: 'flex', gap: '6px', maxWidth: '420px', marginBottom: '8px' }}>
        <select value={cur} onChange={e => setCur(e.target.value)} style={inputStyle} aria-label="Currency">
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={amt} onChange={e => setAmt(e.target.value)} inputMode="numeric" placeholder="Expected rate, e.g. 1500"
          style={{ ...inputStyle, flex: 1, minWidth: 0 }} />
        <select value={per} onChange={e => setPer(e.target.value)} style={inputStyle}>
          <option value="mo">/ month</option><option value="hr">/ hour</option><option value="yr">/ year</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: '6px', maxWidth: '360px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <select value={noticeFrom} onChange={e => setNoticeFrom(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '150px', background: '#fff' }}>
          <option value="">When can you start?</option>
          {NOTICE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <input value={portfolio} onChange={e => setPortfolio(e.target.value)} placeholder="Portfolio / GitHub / site"
          style={{ ...inputStyle, flex: 1, minWidth: '150px' }} />
      </div>

      <button onClick={save} disabled={state === 'saving' || !canSave}
        style={{ padding: '9px 16px', background: '#0B0C0F', color: '#fff', border: 0, borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: state === 'saving' || !canSave ? 'default' : 'pointer', opacity: state === 'saving' || !canSave ? 0.5 : 1 }}>
        {state === 'saving' ? '…' : 'Save'}
      </button>
    </div>
  );
}
