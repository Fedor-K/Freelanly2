'use client';

import { useState } from 'react';

export type DraftView = {
  id: string;
  companyName: string;
  contactEmail: string;
  contactDomain: string;
  contactMethod: string;
  roleTitle: string;
  roleUrl: string | null;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  candidateCount: number;
  candidates: Array<{ userId: string; name: string | null; profession: string; location: string; label: string | null; email: string }>;
  status: string;
};

const methodColor: Record<string, string> = { verified: '#16a34a', 'catch-all': '#ca8a04', guess: '#9ca3af' };

export function OutreachClient({ drafts: initial, counts, fromEmail }: { drafts: DraftView[]; counts: Record<string, number>; fromEmail: string }) {
  const [drafts, setDrafts] = useState(initial);
  const [filter, setFilter] = useState<'DRAFT' | 'SENT' | 'SKIPPED'>('DRAFT');
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function setStatus(id: string, action: 'sent' | 'skip' | 'draft') {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/outreach/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const next = action === 'sent' ? 'SENT' : action === 'skip' ? 'SKIPPED' : 'DRAFT';
        setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, status: next } : d)));
      }
    } finally { setBusy(null); }
  }

  async function sendNow(d: DraftView) {
    if (!confirm(`Send this pitch to ${d.contactEmail}?\n\nIt emails them from ${fromEmail} (our domain), with the ${d.candidateCount} candidates and an unsubscribe link.`)) return;
    setBusy(d.id); setNote(null);
    try {
      const res = await fetch(`/api/admin/outreach/${d.id}`, { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.sent) {
        setDrafts((ds) => ds.map((x) => (x.id === d.id ? { ...x, status: 'SENT' } : x)));
        setNote(`✓ Sent to ${d.contactEmail} from ${j.from || fromEmail}`);
      } else {
        setNote(`✗ Not sent: ${j.reason || 'error'}`);
      }
    } catch { setNote('✗ Network error'); }
    finally { setBusy(null); }
  }

  async function copy(id: string, text: string, tag: string) {
    try { await navigator.clipboard.writeText(text); setCopied(`${id}:${tag}`); setTimeout(() => setCopied(null), 1500); } catch { /* clipboard blocked */ }
  }

  const shown = drafts.filter((d) => d.status === filter);
  const tabs: Array<[typeof filter, string]> = [['DRAFT', 'To send'], ['SENT', 'Sent'], ['SKIPPED', 'Skipped']];

  return (
    <div>
      <div style={{ padding: '10px 14px', marginBottom: 14, borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', fontSize: 12.5, color: '#78350f' }}>
        <strong>Send now</strong> emails the recruiter from <code>{fromEmail}</code> via Postal. If that&apos;s your OTP/login domain, prefer <strong>Copy email</strong> + send from your own inbox — cold outreach can hurt that domain&apos;s deliverability.
      </div>
      {note && <div style={{ padding: '8px 12px', marginBottom: 12, borderRadius: 8, fontSize: 13, background: note.startsWith('✓') ? '#f0fdf4' : '#fef2f2', color: note.startsWith('✓') ? '#166534' : '#b91c1c', border: '1px solid ' + (note.startsWith('✓') ? '#bbf7d0' : '#fecaca') }}>{note}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: '1px solid ' + (filter === key ? '#111' : '#ddd'),
              background: filter === key ? '#111' : '#fff', color: filter === key ? '#fff' : '#444' }}>
            {label} <span style={{ opacity: 0.6 }}>{counts[key] ?? 0}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#888', fontSize: 14, border: '1px dashed #ddd', borderRadius: 12 }}>
          {filter === 'DRAFT'
            ? <>No drafts yet. Run the build on the worker:<br /><code style={{ fontSize: 12 }}>curl -X POST &quot;https://freelanly.com/api/cron/build-outreach&quot; -H &quot;Authorization: Bearer $CRON_SECRET&quot;</code></>
            : `No ${filter.toLowerCase()} drafts.`}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {shown.map((d) => (
          <div key={d.id} style={{ border: '1px solid #e5e5e5', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
            {/* header */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{d.companyName} <span style={{ color: '#999', fontWeight: 400 }}>· {d.roleTitle}</span></div>
                <div style={{ fontSize: 13, color: '#555', marginTop: 2 }}>
                  <span style={{ fontFamily: 'monospace' }}>{d.contactEmail}</span>
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: methodColor[d.contactMethod] || '#9ca3af', textTransform: 'uppercase' }}>{d.contactMethod}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {d.status === 'DRAFT' && <button onClick={() => sendNow(d)} disabled={busy === d.id} style={btnSend}>{busy === d.id ? 'Sending…' : '➤ Send now'}</button>}
                <button onClick={() => copy(d.id, d.contactEmail, 'to')} style={btnGhost}>{copied === `${d.id}:to` ? '✓ Copied' : 'Copy recipient'}</button>
                <button onClick={() => copy(d.id, `Subject: ${d.subject}\n\n${d.bodyText}`, 'email')} style={btnGhost}>{copied === `${d.id}:email` ? '✓ Copied' : 'Copy email'}</button>
                {d.status !== 'SENT' && <button onClick={() => setStatus(d.id, 'sent')} disabled={busy === d.id} style={btnGhost}>Mark sent</button>}
                {d.status === 'DRAFT' && <button onClick={() => setStatus(d.id, 'skip')} disabled={busy === d.id} style={btnGhost}>Skip</button>}
                {d.status !== 'DRAFT' && <button onClick={() => setStatus(d.id, 'draft')} disabled={busy === d.id} style={btnGhost}>↩ To draft</button>}
              </div>
            </div>

            {/* candidates */}
            <div style={{ padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 6, background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
              {d.candidates.map((c, i) => (
                <span key={i} title={`${c.name || 'candidate'} · ${c.email}`} style={{ fontSize: 12, background: '#fff', border: '1px solid #e5e5e5', borderRadius: 6, padding: '3px 8px' }}>
                  <strong>{c.profession}</strong> · {c.location}{c.label ? ` · ${c.label}` : ''}
                </span>
              ))}
            </div>

            {/* email preview */}
            <details>
              <summary style={{ padding: '10px 16px', fontSize: 13, color: '#555', cursor: 'pointer', userSelect: 'none' }}>
                Preview email — <strong>{d.subject}</strong>
              </summary>
              <div style={{ padding: '0 16px 16px' }}>
                <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 16, background: '#fff' }} dangerouslySetInnerHTML={{ __html: d.bodyHtml }} />
              </div>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}

const btnGhost: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: '1px solid #ddd', background: '#fff', color: '#444' };
const btnSend: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: '1px solid #15803d', background: '#16a34a', color: '#fff' };
