'use client';

import { useState } from 'react';

interface SettingsFormProps {
  initialData: {
    name: string;
    email: string;
  };
}

export function SettingsForm({ initialData }: SettingsFormProps) {
  const [name, setName] = useState(initialData.name);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
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
    <>
      <div className="field-row">
        <div className="lbl">Display name<span className="sub">Appears in every email signature</span></div>
        <div className="ctrl">
          <input className="field" value={name} onChange={e => setName(e.target.value)} />
          <button className="btn btn-acid btn-sm" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </button>
          {message && (
            <span style={{ fontSize: '12px', color: message.type === 'success' ? 'var(--good)' : 'var(--bad)' }}>{message.text}</span>
          )}
        </div>
      </div>
    </>
  );
}
