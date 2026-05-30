import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * /admin/recruiter-funnel — the validation instrument.
 *
 * The hypothesis: recruiters who receive AI-applied candidates engage with them (open the
 * portal → view profiles/CVs → reveal contacts → reply). This page pulls the signal — which
 * today is scattered across AutoApplication, ActivityLog, ContactReveal, Message and Recruiter —
 * into one recruiter-demand funnel. No monetization: reveals are free + logged, this just reads.
 *
 * Each stage counts DISTINCT recruiter emails, so it reads top-to-bottom as a real funnel.
 * Admin-guarded by /admin/layout.tsx.
 */

const num = (r: Array<{ n: number | bigint }>): number => Number(r?.[0]?.n ?? 0);
const pct = (a: number, b: number): string => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—');

type RevealRow = {
  recruiterEmail: string;
  revealedAt: Date;
  jobTitle: string | null;
  companyName: string | null;
  candidateName: string | null;
};
type TopRow = { recruiterEmail: string; actions: number | bigint };

export default async function RecruiterFunnelPage() {
  const [
    contacted, visited, engaged, revealedRecruiters, revealsTotal, replied, registered, since7dReveals,
    recentReveals, topRecruiters,
  ] = await Promise.all([
    // 1. Contacted — distinct recruiter inboxes we've actually sent an application to.
    prisma.$queryRawUnsafe<Array<{ n: number }>>(`SELECT CAST(COUNT(DISTINCT lower("appliedToEmail")) AS INTEGER) n FROM "AutoApplication" WHERE "sentAt" IS NOT NULL`),
    // 2. Visited the portal at least once.
    prisma.$queryRawUnsafe<Array<{ n: number }>>(`SELECT CAST(COUNT(DISTINCT lower(details->>'recruiterEmail')) AS INTEGER) n FROM "ActivityLog" WHERE action = 'RECRUITER_PORTAL_VISIT'`),
    // 3. Engaged — opened a profile/chat or viewed a CV (active interest, not just a pageview).
    prisma.$queryRawUnsafe<Array<{ n: number }>>(`SELECT CAST(COUNT(DISTINCT lower(details->>'recruiterEmail')) AS INTEGER) n FROM "ActivityLog" WHERE action = 'RECRUITER_PORTAL_ACTION' AND details->>'event' IN ('view_cv','open_chat','open_profile')`),
    // 4a. Revealed a candidate's real contact (the core demand signal).
    prisma.$queryRawUnsafe<Array<{ n: number }>>(`SELECT CAST(COUNT(DISTINCT lower("recruiterEmail")) AS INTEGER) n FROM "ContactReveal"`),
    // 4b. Total reveals (intensity — repeat reveals = stronger demand).
    prisma.$queryRawUnsafe<Array<{ n: number }>>(`SELECT CAST(COUNT(*) AS INTEGER) n FROM "ContactReveal"`),
    // 5. Replied to a candidate (portal reply or inbound email).
    prisma.$queryRawUnsafe<Array<{ n: number }>>(`SELECT CAST(COUNT(DISTINCT lower("appliedToEmail")) AS INTEGER) n FROM "AutoApplication" WHERE "repliedAt" IS NOT NULL OR status IN ('REPLIED','INTERVIEW','OFFER')`),
    // 6. Registered as a recruiter (asked at first reply).
    prisma.$queryRawUnsafe<Array<{ n: number }>>(`SELECT CAST(COUNT(*) AS INTEGER) n FROM "Recruiter"`),
    // Reveals in the last 7 days (momentum).
    prisma.$queryRawUnsafe<Array<{ n: number }>>(`SELECT CAST(COUNT(*) AS INTEGER) n FROM "ContactReveal" WHERE "revealedAt" >= NOW() - INTERVAL '7 days'`),
    // Recent reveals (who revealed whom).
    prisma.$queryRawUnsafe<RevealRow[]>(`
      SELECT cr."recruiterEmail", cr."revealedAt", aa."jobTitle", aa."companyName", u."name" AS "candidateName"
      FROM "ContactReveal" cr
      JOIN "AutoApplication" aa ON aa.id = cr."applicationId"
      LEFT JOIN "User" u ON u.id = aa."userId"
      ORDER BY cr."revealedAt" DESC LIMIT 25`),
    // Most-engaged recruiters by portal actions.
    prisma.$queryRawUnsafe<TopRow[]>(`
      SELECT lower(details->>'recruiterEmail') AS "recruiterEmail", CAST(COUNT(*) AS INTEGER) AS actions
      FROM "ActivityLog" WHERE action = 'RECRUITER_PORTAL_ACTION' AND details->>'recruiterEmail' IS NOT NULL
      GROUP BY 1 ORDER BY actions DESC LIMIT 15`),
  ]);

  const nContacted = num(contacted), nVisited = num(visited), nEngaged = num(engaged);
  const nRevealed = num(revealedRecruiters), nReplied = num(replied), nRegistered = num(registered);

  const stages = [
    { label: 'Contacted', desc: 'distinct recruiter inboxes we applied to', value: nContacted, base: nContacted },
    { label: 'Visited portal', desc: 'opened the candidate list', value: nVisited, base: nContacted },
    { label: 'Engaged', desc: 'opened a profile/chat or viewed a CV', value: nEngaged, base: nContacted },
    { label: 'Revealed contact', desc: 'unlocked a candidate’s real email', value: nRevealed, base: nContacted },
    { label: 'Replied', desc: 'messaged a candidate back', value: nReplied, base: nContacted },
    { label: 'Registered', desc: 'created a recruiter account', value: nRegistered, base: nContacted },
  ];
  const maxVal = Math.max(nContacted, 1);

  const card: React.CSSProperties = { background: 'var(--bg-1, #fff)', border: '1px solid var(--line, #E8E5DC)', borderRadius: 12, padding: 20 };
  const muted: React.CSSProperties = { color: '#8A8780', fontSize: 12 };

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '24px 8px 64px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Recruiter demand funnel</h1>
      <p style={{ ...muted, margin: '0 0 20px' }}>
        The validation instrument. Each row = distinct recruiters reaching that step.
        {' '}<strong>{num(revealsTotal)}</strong> reveals total · <strong>{num(since7dReveals)}</strong> in the last 7 days. Monetization off — reveals are free + logged.
      </p>

      {/* Funnel */}
      <div style={{ ...card, marginBottom: 20 }}>
        {stages.map((s, i) => {
          const widthPct = Math.max((s.value / maxVal) * 100, s.value > 0 ? 4 : 0);
          const prev = i === 0 ? null : stages[i - 1].value;
          return (
            <div key={s.label} style={{ marginBottom: i === stages.length - 1 ? 0 : 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{s.label} <span style={{ ...muted, fontWeight: 400 }}>· {s.desc}</span></span>
                <span style={{ fontSize: 13 }}>
                  <strong>{s.value}</strong>
                  <span style={muted}> · {pct(s.value, nContacted)} of contacted{prev !== null && prev > 0 ? ` · ${pct(s.value, prev)} step` : ''}</span>
                </span>
              </div>
              <div style={{ height: 22, background: 'var(--bg-2, #F5F3EE)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${widthPct}%`, background: i >= 3 ? '#C7F94A' : '#A8B5FF', transition: 'width .2s' }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Recent reveals */}
        <div style={card}>
          <h2 style={{ fontSize: 15, margin: '0 0 12px' }}>Recent reveals</h2>
          {recentReveals.length === 0 ? (
            <p style={muted}>No reveals yet. They’ll appear here as recruiters unlock contacts.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentReveals.map((r, i) => (
                <div key={i} style={{ fontSize: 12.5, borderBottom: '1px solid var(--line, #F0EEE8)', paddingBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>{r.recruiterEmail}</div>
                  <div style={muted}>
                    {r.candidateName || 'Candidate'} · {r.jobTitle || r.companyName || '—'} · {new Date(r.revealedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Most-engaged recruiters */}
        <div style={card}>
          <h2 style={{ fontSize: 15, margin: '0 0 12px' }}>Most-engaged recruiters</h2>
          {topRecruiters.length === 0 ? (
            <p style={muted}>No portal actions logged yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topRecruiters.map((t, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>{t.recruiterEmail}</span>
                  <strong>{Number(t.actions)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
