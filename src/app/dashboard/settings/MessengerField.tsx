'use client';

import { useState } from 'react';

// Settings #profile field for the candidate's messenger contact — WhatsApp number (intl format) or
// Telegram @handle. Collected at signup since 2026-07-11; this lets earlier users add it, and anyone
// fix a typo. Free-text: server trims and caps at 80 chars.
export function MessengerField({ initial }: { initial: string }) {
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
        body: JSON.stringify({ section: 'profile', messenger: value }),
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
      <div className="lbl">WhatsApp / Telegram<span className="sub">So a recruiter reply never gets lost</span></div>
      <div className="ctrl">
        <input
          className="field"
          placeholder="+52 1 55 1234 5678 or @username"
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
