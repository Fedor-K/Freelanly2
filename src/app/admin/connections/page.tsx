import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';

const ADMIN_EMAILS = ['fedor.hatla@gmail.com'];

export const dynamic = 'force-dynamic';

// North-Star view: every recruiter↔candidate connection with the FULL thread (all messages,
// both sides, all-time) so we can read the whole correspondence and the real reply count.
type Conn = {
  id: string;
  jobTitle: string | null;
  companyName: string | null;
  appliedToEmail: string | null;
  repliedAt: string | null;
  name: string | null;
  email: string | null;
  title: string | null;
  channel: string | null;
};
type Msg = { applicationId: string; from: string; text: string | null; attachmentUrl: string | null; createdAt: string };

// Moscow time (the operator is in Europe/Moscow).
function msk(d: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) redirect('/admin');

  const { q } = await searchParams;
  const search = (q || '').trim().toLowerCase();
  const esc = (s: string) => s.replace(/'/g, "''");

  const conns = await prisma.$queryRawUnsafe<Conn[]>(
    `SELECT a.id, a."jobTitle", a."companyName", a."appliedToEmail", CAST(a."repliedAt" AS TEXT) "repliedAt",
            u.name, u.email, u."parsedProfile"->>'current_title' title,
            (SELECT rl.details->>'source' FROM "ActivityLog" rl
               WHERE rl.action='RECRUITER_REPLIED' AND rl.details->>'applicationId'=a.id
               ORDER BY rl."createdAt" DESC LIMIT 1) channel
     FROM "AutoApplication" a JOIN "User" u ON u.id = a."userId"
     WHERE a."repliedAt" IS NOT NULL
       ${search ? `AND (lower(u.name) LIKE '%${esc(search)}%' OR lower(u.email) LIKE '%${esc(search)}%' OR lower(a."jobTitle") LIKE '%${esc(search)}%' OR lower(a."appliedToEmail") LIKE '%${esc(search)}%')` : ''}
     ORDER BY a."repliedAt" DESC
     LIMIT 100`
  );

  const ids = conns.map((c) => c.id);
  const msgs = ids.length
    ? await prisma.$queryRawUnsafe<Msg[]>(
        `SELECT "applicationId", "from", text, "attachmentUrl", CAST("createdAt" AS TEXT) "createdAt"
         FROM "Message" WHERE "applicationId" IN (${ids.map((id) => `'${esc(id)}'`).join(',')})
         ORDER BY "createdAt" ASC`
      )
    : [];
  const byApp = new Map<string, Msg[]>();
  for (const m of msgs) {
    if (!byApp.has(m.applicationId)) byApp.set(m.applicationId, []);
    byApp.get(m.applicationId)!.push(m);
  }

  return (
    <div style={{ padding: '24px 28px', width: '100%' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px' }}>Connections</h1>
      <p style={{ color: '#888', fontSize: '13px', margin: '0 0 16px' }}>
        Recruiter↔candidate connections with the full thread (all messages, both sides). Time in MSK. Showing {conns.length} most recent — search for any.
      </p>

      <form method="get" style={{ marginBottom: '18px' }}>
        <input
          name="q" defaultValue={q || ''} placeholder="Search candidate, email, role, recruiter…"
          style={{ width: '420px', maxWidth: '100%', padding: '9px 13px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '13px' }}
        />
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {conns.map((c) => {
          const thread = byApp.get(c.id) || [];
          const recruiterMsgs = thread.filter((m) => m.from === 'recruiter').length;
          const userMsgs = thread.filter((m) => m.from === 'user').length;
          return (
            <div key={c.id} style={{ border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden', background: '#fff' }}>
              {/* Header */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'baseline', padding: '12px 16px', background: '#fafafa', borderBottom: '1px solid #eee' }}>
                <div style={{ minWidth: '200px' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{c.name || 'Candidate'}</div>
                  <div style={{ color: '#999', fontSize: '11px' }}>{c.title || ''}{c.title ? ' · ' : ''}{c.email}</div>
                </div>
                <div style={{ minWidth: '160px' }}>
                  <div style={{ fontSize: '13px' }}>{c.jobTitle || '—'}</div>
                  <div style={{ color: '#999', fontSize: '11px' }}>{c.companyName || ''}</div>
                </div>
                <div style={{ fontSize: '12px', color: '#555', minWidth: '160px' }}>↳ {c.appliedToEmail}</div>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: c.channel === 'recruiter_portal' ? '#e6f9d5' : '#eef2ff', color: c.channel === 'recruiter_portal' ? '#3a6b1a' : '#3949ab' }}>
                  {c.channel === 'recruiter_portal' ? 'Portal' : 'Email'}
                </span>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', color: '#333', fontWeight: 600 }}>💬 {thread.length} msgs · {recruiterMsgs} recruiter · {userMsgs} candidate</div>
                  <div style={{ fontSize: '11px', color: '#aaa' }}>first reply {msk(c.repliedAt)}</div>
                </div>
              </div>

              {/* Full thread */}
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '460px', overflowY: 'auto' }}>
                {thread.length === 0 && <div style={{ color: '#bbb', fontSize: '12px' }}>No stored messages.</div>}
                {thread.map((m, i) => {
                  const isRecruiter = m.from === 'recruiter';
                  return (
                    <div key={i} style={{ alignSelf: isRecruiter ? 'flex-start' : 'flex-end', maxWidth: '78%' }}>
                      <div style={{
                        background: isRecruiter ? '#fff' : '#0B0C0F',
                        color: isRecruiter ? '#1a1a1a' : '#fff',
                        border: isRecruiter ? '1px solid #e0e0e0' : 'none',
                        borderRadius: isRecruiter ? '12px 12px 12px 3px' : '12px 12px 3px 12px',
                        padding: '8px 12px', fontSize: '12.5px', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>{m.text || ''}{m.attachmentUrl ? '  📎' : ''}</div>
                      <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px', textAlign: isRecruiter ? 'left' : 'right' }}>
                        {isRecruiter ? '🧑‍💼 ' + (c.appliedToEmail || 'recruiter') : '👤 ' + (c.name || 'candidate')} · {msk(m.createdAt)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
