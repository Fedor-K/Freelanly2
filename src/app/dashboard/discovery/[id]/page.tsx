import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import '../job-design.css';

export const metadata: Metadata = { title: 'Job Detail — Freelanly' };

const COLORS = ['#FF6B6B','#A8E024','#6EE7FF','#FFB951','#A78BFA','#34D399'];

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const { id } = await params;

  // Try AutoApplication first
  const app = await prisma.autoApplication.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true, companyName: true, jobTitle: true, coverLetter: true,
      subject: true, matchScore: true, status: true, appliedToEmail: true,
      sentAt: true, createdAt: true, replyText: true, replyCategory: true,
      user: { select: { name: true, email: true } },
    },
  });

  if (!app) notFound();

  // Get job description
  let description = '';
  let sourceUrl: string | null = null;
  const appFull = await prisma.autoApplication.findFirst({
    where: { id },
    select: { jobId: true, opportunityId: true },
  });
  if (appFull?.jobId) {
    const job = await prisma.job.findUnique({ where: { id: appFull.jobId }, select: { description: true, sourceUrl: true } });
    description = job?.description || '';
    sourceUrl = job?.sourceUrl || null;
  } else if (appFull?.opportunityId) {
    const opp = await prisma.opportunity.findUnique({
      where: { id: appFull.opportunityId },
      select: { description: true, sourceUrl: true, clientName: true, clientHeadline: true },
    });
    description = opp?.description || '';
    sourceUrl = opp?.sourceUrl || null;
  }

  const matchScore = app.matchScore || 0;
  const color = COLORS[Math.abs(app.companyName.charCodeAt(0)) % COLORS.length];

  return (
    <div className="page">

      <a href="/dashboard/discovery" className="muted" style={{fontSize: '13px', fontFamily: "'Geist Mono', monospace"}}>← Back to discovery</a>

      <div className="page-header mt-3">
        <div className="row gap-3" style={{alignItems: 'flex-start'}}>
          <div style={{width: '64px', height: '64px', borderRadius: '14px', background: color, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '28px', color: '#000', fontFamily: "'Geist Mono', monospace"}}>{app.companyName[0]}</div>
          <div>
            <h1 style={{margin: 0}}>{app.jobTitle}</h1>
            <p style={{margin: '6px 0 10px'}}>{app.companyName} · {app.status.toLowerCase()}</p>
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost">Skip</button>
          <button className="btn btn-acid">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            Send application
          </button>
        </div>
      </div>

      <div className="job-grid">

        {/* LEFT — DRAFT */}
        <div className="col gap-4">

          {/* Original posting */}
          {description && (
            <div className="card card-pad">
              <div className="section-head">
                <h2>Original posting</h2>
                {sourceUrl && <a className="muted f-mono" style={{fontSize: '11px'}} href={sourceUrl} target="_blank" rel="noopener">View source ↗</a>}
              </div>
              <div style={{fontSize: '13.5px', lineHeight: 1.6, color: 'var(--ink-2)', marginTop: '6px'}} dangerouslySetInnerHTML={{__html: description.replace(/\n/g, '<br/>')}} />
            </div>
          )}

          {/* Draft */}
          {app.coverLetter && (
            <div>
              <div className="row between mb-2">
                <h2 style={{margin: 0}}>Your application draft</h2>
                <div className="row gap-2">
                  <span className="chip"><span className="chip-dot live"></span>AI-personalized</span>
                </div>
              </div>

              <div className="draft-editor">
                <div className="draft-header">
                  <div className="row gap-3">
                    <div className="avatar av-sm" style={{background: 'var(--acid)', color: '#000'}}>{(app.user.name || 'U').slice(0, 2).toUpperCase()}</div>
                    <span style={{fontSize: '13px', color: 'var(--ink-2)'}}>From <b style={{color: 'var(--ink)', fontWeight: 500}}>{app.user.name}</b> &lt;{app.user.email}&gt;</span>
                  </div>
                  <span className="meta">{app.sentAt ? `Sent ${app.sentAt.toLocaleDateString()}` : 'Draft'}</span>
                </div>
                <div className="draft-field">
                  <span className="lbl">To</span>
                  <span className="val">{app.appliedToEmail}</span>
                </div>
                <div className="draft-field">
                  <span className="lbl">Subject</span>
                  <span className="val">{app.subject}</span>
                </div>
                <div className="draft-body" dangerouslySetInnerHTML={{__html: app.coverLetter.replace(/\n/g, '<br/>')}} />
                <div className="draft-toolbar">
                  <div className="row gap-2">
                    <button className="btn btn-ghost btn-sm">Regenerate</button>
                    <button className="btn btn-ghost btn-sm">Swap template</button>
                  </div>
                  <div className="row gap-2">
                    <button className="btn btn-soft btn-sm">Save draft</button>
                    <button className="btn btn-primary btn-sm">Send now</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reply if exists */}
          {app.replyText && (
            <div className="card card-pad">
              <h2>Recruiter reply</h2>
              <div style={{marginTop: '10px', padding: '14px 16px', background: 'var(--bg-2)', borderRadius: '10px', fontSize: '13.5px', lineHeight: 1.6, color: 'var(--ink)'}} dangerouslySetInnerHTML={{__html: app.replyText.replace(/\n/g, '<br/>')}} />
              {app.replyCategory && <div className="chip chip-acid-soft mt-2" style={{display: 'inline-flex'}}>{app.replyCategory.toLowerCase()}</div>}
            </div>
          )}
        </div>

        {/* RIGHT — match + context */}
        <div className="col gap-4">

          {/* Match */}
          <div className="card card-pad">
            <div className="row between mb-3">
              <h3 style={{margin: 0}}>Match score</h3>
              <div style={{width: '56px', height: '56px', borderRadius: '999px', background: matchScore >= 80 ? 'var(--acid)' : 'var(--bg-2)', display: 'grid', placeItems: 'center', fontFamily: "'Geist Mono', monospace", fontSize: '18px', fontWeight: 600, color: matchScore >= 80 ? '#000' : 'var(--ink)'}}>{matchScore}</div>
            </div>
            {matchScore > 0 && (
              <div className="match-breakdown">
                <div className="match-row"><span className="lbl">Overall</span><div className="bar"><div className="fill" style={{width: `${matchScore}%`}}></div></div><span className="pct">{matchScore}%</span></div>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="card card-pad">
            <h3 className="mb-2">Application details</h3>
            <div style={{fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.7}}>
              <div className="row between" style={{padding: '6px 0', borderBottom: '1px solid var(--line)'}}>
                <span>Status</span><span style={{fontWeight: 500, color: 'var(--ink)'}}>{app.status}</span>
              </div>
              <div className="row between" style={{padding: '6px 0', borderBottom: '1px solid var(--line)'}}>
                <span>Company</span><span style={{fontWeight: 500, color: 'var(--ink)'}}>{app.companyName}</span>
              </div>
              <div className="row between" style={{padding: '6px 0', borderBottom: '1px solid var(--line)'}}>
                <span>Applied to</span><span style={{fontFamily: "'Geist Mono', monospace", fontSize: '11px'}}>{app.appliedToEmail}</span>
              </div>
              <div className="row between" style={{padding: '6px 0'}}>
                <span>Created</span><span style={{fontFamily: "'Geist Mono', monospace", fontSize: '11px'}}>{app.createdAt.toLocaleDateString()}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
