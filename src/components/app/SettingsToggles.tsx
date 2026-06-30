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

const hourToStr = (h: number) => `${String(h).padStart(2, '0')}:00`;
const strToHour = (s: string) => {
  const h = parseInt(s, 10);
  return Number.isNaN(h) ? 0 : Math.max(0, Math.min(23, h));
};

export function SendingRules({ startHour = 9, endHour = 17 }: { startHour?: number; endHour?: number }) {
  const [sendStart, setSendStart] = useState(hourToStr(startHour));
  const [sendEnd, setSendEnd] = useState(hourToStr(endHour));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'sendingRules',
          sendStartHour: strToHour(sendStart),
          sendEndHour: strToHour(sendEnd),
          sendWeekdaysOnly: true,
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
