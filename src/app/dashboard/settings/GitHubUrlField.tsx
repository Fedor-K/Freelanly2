'use client';

import { useState } from 'react';

// Settings #profile field for the candidate's GitHub profile URL. Server normalizes to
// https://github.com/<username> and rejects non-profile URLs; the link feeds the GitHub
// verification report shown to hirers.
export function GitHubUrlField({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'profile', githubUrl: value }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Saved!' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="field-row">
      <div className="lbl">GitHub<span className="sub">Verified GitHub sharpens your matches</span></div>
      <div className="ctrl">
        <input
          className="field"
          placeholder="github.com/username"
          value={value}
          onChange={e => setValue(e.target.value)}
        />
        <button className="btn btn-acid btn-sm" onClick={handleSave} disabled={loading}>
          {loading ? 'Saving...' : 'Save'}
        </button>
        {message && (
          <span style={{ fontSize: '12px', color: message.type === 'success' ? 'var(--good)' : 'var(--bad)' }}>{message.text}</span>
        )}
      </div>
    </div>
  );
}
