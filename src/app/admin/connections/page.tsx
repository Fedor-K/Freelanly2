import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';

const ADMIN_EMAILS = ['fedor.hatla@gmail.com'];

export const dynamic = 'force-dynamic';

// North-Star view: every recruiter↔candidate connection — who we applied, to which role,
// and what the recruiter wrote back (and via which channel: portal vs email).
type Row = {
  id: string;
  jobTitle: string | null;
  companyName: string | null;
  appliedToEmail: string | null;
  replyText: string | null;
  replyCategory: string | null;
  repliedAt: string | null;
  name: string | null;
  email: string | null;
  title: string | null;
  field: string | null;
  channel: string | null;
};

function fmt(d: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) redirect('/admin');

  const { q } = await searchParams;
  const search = (q || '').trim().toLowerCase();

  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT a.id,
            a."jobTitle", a."companyName", a."appliedToEmail",
            a."replyText", a."replyCategory", CAST(a."repliedAt" AS TEXT) "repliedAt",
            u.name, u.email,
            u."parsedProfile"->>'current_title' title, u."parsedProfile"->>'field' field,
            (SELECT rl.details->>'source' FROM "ActivityLog" rl
               WHERE rl.action='RECRUITER_REPLIED' AND rl.details->>'applicationId'=a.id
               ORDER BY rl."createdAt" DESC LIMIT 1) channel
     FROM "AutoApplication" a JOIN "User" u ON u.id = a."userId"
     WHERE a."repliedAt" IS NOT NULL
       ${search ? `AND (lower(u.name) LIKE '%${search.replace(/'/g, "''")}%' OR lower(u.email) LIKE '%${search.replace(/'/g, "''")}%' OR lower(a."jobTitle") LIKE '%${search.replace(/'/g, "''")}%' OR lower(a."appliedToEmail") LIKE '%${search.replace(/'/g, "''")}%')` : ''}
     ORDER BY a."repliedAt" DESC
     LIMIT 200`
  );

  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#888', borderBottom: '1px solid #e5e5e5', position: 'sticky', top: 0, background: '#fafafa' };
  const td: React.CSSProperties = { padding: '10px', fontSize: '13px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px' }}>Connections</h1>
      <p style={{ color: '#888', fontSize: '13px', margin: '0 0 16px' }}>
        Every recruiter↔candidate connection — candidate, the role we applied them to, and the recruiter’s reply. Showing {rows.length} most recent.
      </p>

      <form method="get" style={{ marginBottom: '16px' }}>
        <input
          name="q" defaultValue={q || ''} placeholder="Search candidate, email, role, recruiter…"
          style={{ width: '360px', maxWidth: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '13px' }}
        />
      </form>

      <div style={{ overflowX: 'auto', border: '1px solid #eee', borderRadius: '10px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <thead>
            <tr>
              <th style={th}>Candidate</th>
              <th style={th}>Applied to (role)</th>
              <th style={th}>Recruiter</th>
              <th style={th}>Channel</th>
              <th style={th}>Recruiter reply</th>
              <th style={th}>When</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{r.name || 'Candidate'}</div>
                  <div style={{ color: '#999', fontSize: '11px' }}>{r.title || r.field || ''}</div>
                  <div style={{ color: '#bbb', fontSize: '11px' }}>{r.email}</div>
                </td>
                <td style={{ ...td, maxWidth: '180px' }}>
                  <div>{r.jobTitle || '—'}</div>
                  <div style={{ color: '#999', fontSize: '11px' }}>{r.companyName || ''}</div>
                </td>
                <td style={{ ...td, fontSize: '12px', color: '#555' }}>{r.appliedToEmail}</td>
                <td style={td}>
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: r.channel === 'recruiter_portal' ? '#e6f9d5' : '#eef2ff', color: r.channel === 'recruiter_portal' ? '#3a6b1a' : '#3949ab' }}>
                    {r.channel === 'recruiter_portal' ? 'Portal' : 'Email'}
                  </span>
                  {r.replyCategory && <div style={{ color: '#aaa', fontSize: '10px', marginTop: '4px' }}>{r.replyCategory}</div>}
                </td>
                <td style={{ ...td, maxWidth: '380px', whiteSpace: 'pre-wrap', color: '#333' }}>
                  {(r.replyText || '').slice(0, 400) || <span style={{ color: '#bbb' }}>—</span>}
                </td>
                <td style={{ ...td, whiteSpace: 'nowrap', color: '#888', fontSize: '12px' }}>{fmt(r.repliedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
