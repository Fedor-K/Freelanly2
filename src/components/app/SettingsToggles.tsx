'use client';

import { useState } from 'react';

export function Toggle({ initial = false, onToggle }: { initial?: boolean; onToggle?: (v: boolean) => void }) {
  const [on, setOn] = useState(initial);
  return (
    <span
      className={`toggle${on ? ' on' : ''}`}
      onClick={() => {
        const next = !on;
        setOn(next);
        onToggle?.(next);
      }}
    ></span>
  );
}

export function SendingRules() {
  const [sendStart, setSendStart] = useState('09:00');
  const [sendEnd, setSendEnd] = useState('17:00');
  const [dailyCap, setDailyCap] = useState(25);
  const [followUp, setFollowUp] = useState('3');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sendingRules: { sendStart, sendEnd, dailyCap, followUpTouches: parseInt(followUp) },
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  return (
    <>
      <div className="field-row">
        <div className="lbl">Send window<span className="sub">In your local timezone</span></div>
        <div className="ctrl">
          <input className="field" value={sendStart} onChange={e => setSendStart(e.target.value)} style={{maxWidth: '100px'}} />
          <span className="muted">→</span>
          <input className="field" value={sendEnd} onChange={e => setSendEnd(e.target.value)} style={{maxWidth: '100px'}} />
          <span className="meta f-mono">Mon–Fri only</span>
        </div>
      </div>
      <div className="field-row">
        <div className="lbl">Daily cap</div>
        <div className="ctrl">
          <input className="field" type="number" value={dailyCap} onChange={e => setDailyCap(parseInt(e.target.value) || 0)} style={{maxWidth: '100px'}} />
          <span className="muted f-mono" style={{fontSize: '11px'}}>applications / day</span>
        </div>
      </div>
      <div className="field-row">
        <div className="lbl">Follow-up cadence</div>
        <div className="ctrl">
          <select className="field" style={{maxWidth: '280px'}} value={followUp} onChange={e => setFollowUp(e.target.value)}>
            <option value="3">3 touches · day 0, +4, +8</option>
            <option value="2">2 touches · day 0, +5</option>
            <option value="1">1 touch · day 0 only</option>
          </select>
        </div>
      </div>
      <div className="field-row">
        <div className="lbl"></div>
        <div className="ctrl">
          <button className="btn btn-acid btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save rules'}
          </button>
        </div>
      </div>
    </>
  );
}

export function NotificationToggles() {
  async function saveNotif(key: string, value: boolean) {
    await fetch('/api/user/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notifications: { [key]: value } }),
    }).catch(() => {});
  }

  return (
    <>
      <div className="field-row">
        <div className="lbl">New reply</div>
        <div className="ctrl"><Toggle initial={true} onToggle={v => saveNotif('newReply', v)} /><span style={{fontSize: '13px'}}>Email notification</span></div>
      </div>
      <div className="field-row">
        <div className="lbl">Daily digest</div>
        <div className="ctrl"><Toggle initial={true} onToggle={v => saveNotif('dailyDigest', v)} /><span style={{fontSize: '13px'}}>Email at 09:00</span></div>
      </div>
      <div className="field-row">
        <div className="lbl">Weekly insights</div>
        <div className="ctrl"><Toggle initial={true} onToggle={v => saveNotif('weeklyInsights', v)} /><span style={{fontSize: '13px'}}>Performance + template suggestions</span></div>
      </div>
    </>
  );
}
