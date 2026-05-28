'use client';

import { useEffect, useState } from 'react';

// Dashboard prompt for EXISTING users who never stated an expected rate (the inline post-submit
// step only catches new/inline applicants). Optional, dismissible (persisted), reuses the same
// endpoint. Candidate-side → contact-neutral, safe during the shadow window.
export function SalaryPrompt() {
  const [amt, setAmt] = useState('');
  const [per, setPer] = useState('mo');
  const [state, setState] = useState<'hidden' | 'open' | 'saving' | 'done'>('hidden');

  useEffect(() => {
    try { if (localStorage.getItem('salary_prompt_dismissed')) return; } catch { /* ignore */ }
    setState('open');
  }, []);

  async function save() {
    if (!amt.trim()) return;
    setState('saving');
    try {
      const r = await fetch('/api/user/salary-expectation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt, period: per }),
      });
      setState(r.ok ? 'done' : 'open');
    } catch { setState('open'); }
  }
  function dismiss() { try { localStorage.setItem('salary_prompt_dismissed', '1'); } catch {} setState('hidden'); }

  if (state === 'hidden') return null;
  if (state === 'done') {
    return (
      <div style={{ margin: '0 0 16px', padding: '12px 16px', borderRadius: '12px', background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#047857', fontSize: '13px' }}>
        ✓ Saved — recruiters will see your expected rate.
      </div>
    );
  }
  return (
    <div style={{ margin: '0 0 16px', padding: '14px 18px', borderRadius: '12px', background: '#fff', border: '1px solid #E8E5DC' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{ fontSize: '14px', fontWeight: 600 }}>Add your expected rate</span>
        <button onClick={dismiss} style={{ background: 'none', border: 'none', color: '#8A8780', fontSize: '12px', cursor: 'pointer' }}>Not now</button>
      </div>
      <div style={{ fontSize: '12.5px', color: '#8A8780', margin: '2px 0 10px' }}>Recruiters prioritize candidates who state it. Optional.</div>
      <div style={{ display: 'flex', gap: '6px', maxWidth: '360px' }}>
        <input value={amt} onChange={e => setAmt(e.target.value)} inputMode="numeric" placeholder="e.g. 1500"
          style={{ flex: 1, minWidth: 0, padding: '9px 11px', border: '1px solid #E8E5DC', borderRadius: '8px', fontSize: '13px' }} />
        <select value={per} onChange={e => setPer(e.target.value)} style={{ padding: '9px', border: '1px solid #E8E5DC', borderRadius: '8px', fontSize: '13px' }}>
          <option value="mo">/ month</option><option value="hr">/ hour</option><option value="yr">/ year</option>
        </select>
        <button onClick={save} disabled={state === 'saving' || !amt.trim()}
          style={{ padding: '9px 16px', background: '#0B0C0F', color: '#fff', border: 0, borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: state === 'saving' || !amt.trim() ? 'default' : 'pointer', opacity: state === 'saving' || !amt.trim() ? 0.5 : 1 }}>
          {state === 'saving' ? '…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
