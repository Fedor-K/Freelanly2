'use client';

import { useEffect, useState } from 'react';

// Dashboard prompt for dev-titled users without a GitHub link: verified GitHub = evidence for
// hirers = faster shortlisting. Single input, dismissible (persisted), posts to the settings
// PATCH which normalizes/validates the URL. Rendered only when isDev && !githubUrl (server-side).
export function GitHubPrompt() {
  const [value, setValue] = useState('');
  const [state, setState] = useState<'hidden' | 'open' | 'saving' | 'done'>('hidden');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try { if (localStorage.getItem('github_prompt_dismissed')) return; } catch { /* ignore */ }
    setState('open');
  }, []);

  async function save() {
    if (!value.trim()) return;
    setState('saving');
    setError(null);
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'profile', githubUrl: value.trim() }),
      });
      if (res.ok) {
        setState('done');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save');
        setState('open');
      }
    } catch {
      setError('Failed to save');
      setState('open');
    }
  }
  function dismiss() { try { localStorage.setItem('github_prompt_dismissed', '1'); } catch { /* ignore */ } setState('hidden'); }

  if (state === 'hidden') return null;
  if (state === 'done') {
    return (
      <div style={{ margin: '0 0 16px', padding: '12px 16px', borderRadius: '12px', background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#047857', fontSize: '13px' }}>
        ✓ Saved — we&apos;ll verify your GitHub and show the evidence to hirers.
      </div>
    );
  }

  return (
    <div style={{ margin: '0 0 16px', padding: '14px 18px', borderRadius: '12px', background: '#fff', border: '1px solid #E8E5DC' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{ fontSize: '14px', fontWeight: 600 }}>Add your GitHub — get shortlisted faster</span>
        <button onClick={dismiss} style={{ background: 'none', border: 'none', color: '#9A958A', fontSize: '12px', cursor: 'pointer' }}>Not now</button>
      </div>
      <div style={{ fontSize: '12px', color: '#6E6A5F', margin: '4px 0 10px' }}>
        A live GitHub is the strongest proof of your skills — we verify it and attach the evidence when pitching you to hirers.
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input
          style={{ flex: '1 1 220px', padding: '9px 11px', border: '1px solid #E8E5DC', borderRadius: '8px', fontSize: '13px' }}
          placeholder="github.com/username"
          value={value}
          onChange={e => setValue(e.target.value)}
        />
        <button
          onClick={save}
          disabled={state === 'saving' || !value.trim()}
          style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', background: '#D4F24B', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: state === 'saving' || !value.trim() ? 0.6 : 1 }}
        >
          {state === 'saving' ? 'Saving…' : 'Save'}
        </button>
      </div>
      {error && <div style={{ fontSize: '12px', color: '#B91C1C', marginTop: '6px' }}>{error}</div>}
    </div>
  );
}
