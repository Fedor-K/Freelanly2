import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import './templates-design.css';

export const metadata: Metadata = {
  title: 'Templates — Freelanly',
};

export const revalidate = 60;

// Extract {{variables}} from template body
function extractVars(text: string): string[] {
  const matches = text.match(/\{\{([^}]+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches)];
}

const VAR_SOURCES: Record<string, string> = {
  '{{first_name}}': '→ extracted from LinkedIn poster',
  '{{job_title}}': '→ parsed from job posting',
  '{{company_name}}': '→ parsed from job posting',
  '{{credibility_one_liner}}': '→ matched from your case studies',
  '{{tech_overlap}}': '→ intersection of your skills × job requirements',
  '{{relevant_link}}': '→ best-fit case study from portfolio',
  '{{location}}': '→ from your profile',
  '{{availability}}': '→ from your profile',
  '{{start_date}}': '→ from your calendar',
  '{{portfolio_url}}': '→ from your profile',
  '{{my_name}}': '→ from your profile',
  '{{your_name}}': '→ from your profile',
};

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const userId = session.user.id;

  const templates = await prisma.coverLetterTemplate.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { replyCount: 'desc' }],
    select: {
      id: true, name: true, subject: true, body: true,
      isDefault: true, sentCount: true, replyCount: true,
    },
  });

  const first = templates[0] || null;
  const firstVars = first ? extractVars(first.body + ' ' + first.subject) : [];

  // Render template body with highlighted variables
  function renderBody(body: string) {
    return body.replace(/\{\{([^}]+)\}\}/g, '<span class="var">{{$1}}</span>');
  }

  return (
    <div className="page">

      <div className="page-header">
        <div className="page-title">
          <h1>Templates</h1>
          <p>Reusable opener structures. Edit once, personalize per gig with variables.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-acid">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            New template
          </button>
        </div>
      </div>

      <div className="tpl-grid">

        {/* Template list */}
        <div className="card">
          <div className="card-head" style={{padding: '12px 16px'}}>
            <h3>Templates</h3>
            <span className="meta">{templates.length} active</span>
          </div>
          {templates.length === 0 ? (
            <div style={{padding: '40px 16px', textAlign: 'center', color: 'var(--ink-4)', fontSize: '13px'}}>
              No templates yet. Create your first one.
            </div>
          ) : templates.map((tpl, i) => {
            const replyRate = tpl.sentCount > 0 ? (tpl.replyCount / tpl.sentCount * 100).toFixed(1) : '0';
            const isWinning = templates.length > 1 && i === 0 && tpl.replyCount > 0;
            return (
              <div key={tpl.id} className={`tpl-item${i === 0 ? ' active' : ''}`}>
                <div className="row between">
                  <span className="name">{tpl.name}</span>
                  {isWinning && <span className="chip chip-acid-soft" style={{height: '18px', padding: '0 7px', fontSize: '9.5px'}}>winning</span>}
                  {tpl.isDefault && <span className="chip" style={{height: '18px', padding: '0 7px', fontSize: '9.5px'}}>default</span>}
                </div>
                <div className="stat">Reply rate: <b>{replyRate}%</b> · used {tpl.sentCount}x</div>
              </div>
            );
          })}
        </div>

        {/* Editor + Variables */}
        <div className="col gap-4">

          {first ? (
            <>
              {/* Editor */}
              <div className="card">
                <div className="card-head">
                  <div className="row gap-3">
                    <h3>{first.name}</h3>
                  </div>
                  <div className="row gap-2">
                    <button className="btn btn-ghost btn-sm">Duplicate</button>
                    <button className="btn btn-ghost btn-sm">Preview send</button>
                    <button className="btn btn-acid btn-sm">Save</button>
                  </div>
                </div>
                <div style={{padding: '14px 20px', borderBottom: '1px solid var(--line)', background: 'var(--bg-2)'}}>
                  <div style={{fontSize: '12px', color: 'var(--ink-3)', marginBottom: '4px'}}>Subject line</div>
                  <div style={{fontFamily: "'Geist Mono', monospace", fontSize: '13.5px'}} dangerouslySetInnerHTML={{__html: renderBody(first.subject)}} />
                </div>
                <div className="editor-body" dangerouslySetInnerHTML={{__html: first.body.split('\n').map(line => `<p>${renderBody(line)}</p>`).join('')}} />
                <div style={{padding: '12px 20px', background: 'var(--bg-2)', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <div className="meta">{first.body.length} chars · tone: casual-direct</div>
                  <div className="row gap-2">
                    <button className="btn btn-ghost btn-sm">Insert variable</button>
                  </div>
                </div>
              </div>

              {/* Variable inspector */}
              <div className="card">
                <div className="card-head"><h3>Variables in this template</h3><span className="meta">{firstVars.length} used · all auto-filled</span></div>
                {firstVars.map(v => (
                  <div key={v} className="var-row">
                    <span className="v">{v}</span>
                    <span className="src">{VAR_SOURCES[v] || '→ auto-filled'}</span>
                  </div>
                ))}
                {firstVars.length === 0 && (
                  <div style={{padding: '16px', textAlign: 'center', color: 'var(--ink-4)', fontSize: '12px'}}>No variables found. Use {`{{variable_name}}`} syntax in your template.</div>
                )}
              </div>
            </>
          ) : (
            <div className="card card-pad" style={{textAlign: 'center', padding: '60px 24px', color: 'var(--ink-4)'}}>
              <p>Select a template to edit, or create a new one.</p>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
