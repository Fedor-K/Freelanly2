'use client';

import { useState } from 'react';
import { Toggle } from './SettingsToggles';

/**
 * Auto-apply is OFF by default (self-apply). This toggle lets a user opt in: flipping it ON sets all
 * their loops to mode=AUTO (the matcher's matches get auto-sent); OFF sets them back to MANUAL
 * (matches are only surfaced in the feed, the user applies themselves). Reuses PATCH /api/user/auto-apply.
 */
export function AutoApplyOptIn({ loopIds, initialOn }: { loopIds: string[]; initialOn: boolean }) {
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');

  async function setMode(on: boolean) {
    if (!loopIds.length) { setNote('Add a search first to enable auto-apply.'); return; }
    setSaving(true);
    setNote('');
    try {
      await Promise.all(loopIds.map(id =>
        fetch('/api/user/auto-apply', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, mode: on ? 'AUTO' : 'MANUAL' }),
        })
      ));
      setNote(on ? 'Auto-apply on — we’ll send for strong matches.' : 'Auto-apply off — you apply yourself.');
      setTimeout(() => setNote(''), 3000);
    } catch {
      setNote('Could not save — try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="field-row">
      <div className="lbl">
        Auto-apply
        <span className="sub">Off by default — you apply yourself. On = we send applications for your strong matches automatically.</span>
      </div>
      <div className="ctrl">
        <Toggle initial={initialOn} onToggle={setMode} />
        <span style={{ fontSize: '13px' }}>{saving ? 'Saving…' : note || (initialOn ? 'On' : 'Off')}</span>
      </div>
    </div>
  );
}
