'use client';

import { useState } from 'react';

type AppRow = {
  id: string;
  jobTitle: string;
  companyName: string;
  status: string;
  subject: string;
  date: string;
  followUp: string | null;
  replyCategory: string | null;
  matchScore: number | null;
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Queued', cls: 'queued' },
  REVIEW: { label: 'Review', cls: 'queued' },
  SENDING: { label: 'Sending', cls: 'sent' },
  SENT: { label: 'Sent', cls: 'sent' },
  DELIVERED: { label: 'Sent', cls: 'sent' },
  OPENED: { label: 'Opened', cls: 'opened' },
  REPLIED: { label: 'Replied', cls: 'replied' },
  INTERVIEW: { label: 'Interview', cls: 'interview' },
  OFFER: { label: 'Offer', cls: 'interview' },
  REJECTED: { label: 'Rejected', cls: 'rejected' },
  FAILED: { label: 'Failed', cls: 'failed' },
};

const FILTERS = [
  { label: 'All', value: null },
  { label: 'Sent', value: ['SENT', 'DELIVERED'] },
  { label: 'Opened', value: ['OPENED'] },
  { label: 'Replied', value: ['REPLIED', 'INTERVIEW', 'OFFER'] },
  { label: 'Queued', value: ['PENDING', 'REVIEW', 'SENDING'] },
  { label: 'Failed', value: ['FAILED'] },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ApplicationsTable({ rows }: { rows: AppRow[] }) {
  const [filter, setFilter] = useState<string[] | null>(null);

  const filtered = filter ? rows.filter(r => filter.includes(r.status)) : rows;

  return (
    <div>
      <div style={{ padding: '8px 16px 0', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f.label}
            className={`filter-tab ${JSON.stringify(filter) === JSON.stringify(f.value) ? 'active' : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
            {f.value ? ` (${rows.filter(r => f.value!.includes(r.status)).length})` : ` (${rows.length})`}
          </button>
        ))}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="app-table">
          <thead>
            <tr>
              <th>Job title</th>
              <th>Company</th>
              <th>Date</th>
              <th>Status</th>
              <th>Subject</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-4)', padding: '32px 16px' }}>
                  No applications yet
                </td>
              </tr>
            ) : filtered.map(app => {
              const st = STATUS_MAP[app.status] || { label: app.status, cls: 'sent' };
              return (
                <tr key={app.id}>
                  <td className="job-title">{app.jobTitle}</td>
                  <td className="company">{app.companyName}</td>
                  <td className="date">{formatDate(app.date)}</td>
                  <td>
                    <span className={`status-chip ${st.cls}`}>{st.label}</span>
                    {app.followUp && app.followUp !== 'sent' && (
                      <div className="followup">Follow-up {app.followUp}</div>
                    )}
                    {app.followUp === 'sent' && (
                      <div className="followup">Follow-up sent</div>
                    )}
                  </td>
                  <td className="subject">{app.subject || ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
