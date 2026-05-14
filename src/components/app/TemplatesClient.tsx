'use client';

import { useState } from 'react';

type Template = {
  id: string;
  name: string;
  subject: string;
  body: string;
  isDefault: boolean;
  sentCount: number;
  replyCount: number;
};

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
  '{{portfolio_url}}': '→ from your profile',
  '{{my_name}}': '→ from your profile',
  '{{your_name}}': '→ from your profile',
};

export function TemplatesClient({ templates: initial }: { templates: Template[] }) {
  const [templates, setTemplates] = useState(initial);
  const [activeId, setActiveId] = useState(initial[0]?.id || null);
  const [editName, setEditName] = useState(initial[0]?.name || '');
  const [editSubject, setEditSubject] = useState(initial[0]?.subject || '');
  const [editBody, setEditBody] = useState(initial[0]?.body || '');
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showNew, setShowNew] = useState(false);

  const active = templates.find(t => t.id === activeId) || null;
  const vars = extractVars(editBody + ' ' + editSubject);

  function selectTemplate(t: Template) {
    setActiveId(t.id);
    setEditName(t.name);
    setEditSubject(t.subject);
    setEditBody(t.body);
  }

  async function handleSave() {
    if (!activeId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/user/templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeId, name: editName, subject: editSubject, body: editBody }),
      });
      if (res.ok) {
        setTemplates(prev => prev.map(t => t.id === activeId ? { ...t, name: editName, subject: editSubject, body: editBody } : t));
      }
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/user/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, subject: 'Re: {{job_title}}', body: 'Hi {{first_name}},\n\n\n\n— {{my_name}}' }),
      });
      if (res.ok) {
        const data = await res.json();
        const newTpl = { id: data.id, name: newName, subject: 'Re: {{job_title}}', body: 'Hi {{first_name}},\n\n\n\n— {{my_name}}', isDefault: false, sentCount: 0, replyCount: 0 };
        setTemplates(prev => [...prev, newTpl]);
        selectTemplate(newTpl);
        setShowNew(false);
        setNewName('');
      }
    } catch { /* ignore */ }
    finally { setCreating(false); }
  }

  async function handleDuplicate() {
    if (!active) return;
    try {
      const res = await fetch('/api/user/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${active.name} (copy)`, subject: active.subject, body: active.body }),
      });
      if (res.ok) {
        const data = await res.json();
        const dup = { ...active, id: data.id, name: `${active.name} (copy)`, sentCount: 0, replyCount: 0 };
        setTemplates(prev => [...prev, dup]);
        selectTemplate(dup);
      }
    } catch { /* ignore */ }
  }

  function renderBody(body: string) {
    return body.replace(/\{\{([^}]+)\}\}/g, '<span class="var">{{$1}}</span>');
  }

  return (
    <div className="tpl-grid">
      {/* Template list */}
      <div className="card">
        <div className="card-head" style={{ padding: '12px 16px' }}>
          <h3>Templates</h3>
          <span className="meta">{templates.length} active</span>
        </div>
        {templates.map((tpl, i) => {
          const rate = tpl.sentCount > 0 ? (tpl.replyCount / tpl.sentCount * 100).toFixed(1) : '0';
          const isWinning = templates.length > 1 && i === 0 && tpl.replyCount > 0;
          return (
            <div key={tpl.id} className={`tpl-item${tpl.id === activeId ? ' active' : ''}`} onClick={() => selectTemplate(tpl)}>
              <div className="row between">
                <span className="name">{tpl.name}</span>
                {isWinning && <span className="chip chip-acid-soft" style={{ height: '18px', padding: '0 7px', fontSize: '9.5px' }}>winning</span>}
                {tpl.isDefault && <span className="chip" style={{ height: '18px', padding: '0 7px', fontSize: '9.5px' }}>default</span>}
              </div>
              <div className="stat">Reply rate: <b>{rate}%</b> · used {tpl.sentCount}x</div>
            </div>
          );
        })}
        {showNew ? (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)' }}>
            <input className="field" placeholder="Template name" value={newName} onChange={e => setNewName(e.target.value)} style={{ marginBottom: '8px' }} />
            <div className="row gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={creating}>{creating ? 'Creating...' : 'Create'}</button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)' }}>
            <button className="btn btn-acid btn-sm" style={{ width: '100%' }} onClick={() => setShowNew(true)}>
              + New template
            </button>
          </div>
        )}
      </div>

      {/* Editor */}
      <div className="col gap-4">
        {active ? (
          <>
            <div className="card">
              <div className="card-head">
                <div className="row gap-3">
                  <input value={editName} onChange={e => setEditName(e.target.value)} style={{ fontSize: '16px', fontWeight: 500, border: 'none', background: 'none', outline: 'none', padding: 0, width: '200px' }} />
                </div>
                <div className="row gap-2">
                  <button className="btn btn-ghost btn-sm" onClick={handleDuplicate}>Duplicate</button>
                  <button className="btn btn-acid btn-sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                </div>
              </div>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', background: 'var(--bg-2)' }}>
                <div style={{ fontSize: '12px', color: 'var(--ink-3)', marginBottom: '4px' }}>Subject line</div>
                <input value={editSubject} onChange={e => setEditSubject(e.target.value)} className="field" style={{ fontFamily: "'Geist Mono', monospace", fontSize: '13px' }} />
              </div>
              <div style={{ padding: '14px 20px' }}>
                <div style={{ fontSize: '12px', color: 'var(--ink-3)', marginBottom: '4px' }}>Body</div>
                <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={10} className="field" style={{ fontFamily: "'Geist Mono', monospace", fontSize: '13px', lineHeight: 1.6, resize: 'vertical' }} />
              </div>
              <div style={{ padding: '12px 20px', background: 'var(--bg-2)', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="meta">{editBody.length} chars</div>
                <div className="meta">Variables: {vars.length}</div>
              </div>
            </div>

            {/* Preview */}
            <div className="card card-pad">
              <h3 style={{ marginBottom: '10px' }}>Preview</h3>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', background: 'var(--bg-2)', borderRadius: '8px', marginBottom: '10px' }}>
                <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '13px' }} dangerouslySetInnerHTML={{ __html: renderBody(editSubject) }} />
              </div>
              <div className="editor-body" dangerouslySetInnerHTML={{ __html: editBody.split('\n').map(line => `<p>${renderBody(line)}</p>`).join('') }} />
            </div>

            {/* Variables */}
            <div className="card">
              <div className="card-head"><h3>Variables</h3><span className="meta">{vars.length} used</span></div>
              {vars.map(v => (
                <div key={v} className="var-row">
                  <span className="v">{v}</span>
                  <span className="src">{VAR_SOURCES[v] || '→ auto-filled'}</span>
                </div>
              ))}
              {vars.length === 0 && (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--ink-4)', fontSize: '12px' }}>Use {`{{variable}}`} syntax</div>
              )}
            </div>
          </>
        ) : (
          <div className="card card-pad" style={{ textAlign: 'center', padding: '60px', color: 'var(--ink-4)' }}>
            Create or select a template to start editing.
          </div>
        )}
      </div>
    </div>
  );
}
