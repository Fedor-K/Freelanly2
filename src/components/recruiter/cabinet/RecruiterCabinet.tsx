'use client';

import { createContext, useCallback, useContext, useMemo, useState, type CSSProperties } from 'react';
import { RIcon } from './icons';
import { Paywall } from './Paywall';
import {
  FREE_REVEAL_QUOTA, type Msg, type RecruiterCandidate, type RecruiterInfo,
} from './lib';
import { OverviewView } from './views/OverviewView';
import { CandidatesView } from './views/CandidatesView';
import { CandidateDetail } from './views/CandidateDetail';
import { ConversationsView } from './views/ConversationsView';
import { AccountView } from './views/AccountView';

export type View = 'overview' | 'candidates' | 'conversations' | 'account';
export type Density = 'comfortable' | 'dense' | 'detailed';

type Group = { key: string; jobTitle: string; items: RecruiterCandidate[] };

export interface CabinetApi {
  token: string;
  recruiter: RecruiterInfo;
  candidates: RecruiterCandidate[];
  colorIdx: Record<string, number>;
  groups: Group[];
  conversations: RecruiterCandidate[];
  isPro: boolean;

  view: View;
  setView: (v: View) => void;
  detailId: string | null;
  openDetail: (appId: string) => void;
  closeDetail: () => void;

  density: Density;
  setDensity: (d: Density) => void;
  roleFilter: string;
  setRoleFilter: (k: string) => void;

  // reveal
  revealsUsed: number;
  revealsLeft: number;
  isRevealed: (appId: string) => boolean;
  revealedEmail: (appId: string) => string | undefined;
  revealing: string | null;
  doReveal: (appId: string) => void;

  // thread + compose
  getThread: (appId: string) => Msg[];
  isThreadLoading: (appId: string) => boolean;
  loadThread: (appId: string) => void;
  draftOf: (appId: string) => string;
  setDraft: (appId: string, v: string) => void;
  sending: string | null;
  sendError: (appId: string) => string | undefined;
  doSend: (appId: string) => void;

  track: (event: string, appId?: string) => void;
  openPaywall: () => void;
  toast: (msg: string) => void;
}

const Ctx = createContext<CabinetApi | null>(null);
export const useCabinet = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCabinet must be used inside RecruiterCabinet');
  return c;
};

const NAV: { label: string; items: { id: View | 'post'; label: string; icon: string; count?: number; pro?: boolean }[] }[] = [
  { label: 'WORKSPACE', items: [
    { id: 'overview', label: 'Overview', icon: 'home' },
    { id: 'candidates', label: 'Candidates', icon: 'users' },
    { id: 'conversations', label: 'Conversations', icon: 'inbox' },
  ]},
  { label: 'PIPELINE', items: [
    { id: 'post', label: 'Post a role', icon: 'plus', pro: true },
  ]},
  { label: 'ACCOUNT', items: [
    { id: 'account', label: 'Account & plan', icon: 'card' },
  ]},
];

const REG_VOLUMES = ['1', '2-5', '6-20', '20+'] as const;
const REG_LABEL: CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 600, margin: '0 0 5px', color: '#0B0C0F' };
const REG_INPUT: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #E8E5DC', borderRadius: '9px', fontSize: '14px' };

export function RecruiterCabinet({
  token,
  recruiter,
  candidates,
  revealedContacts,
  needsRegistration = false,
  prefill = { company: '', hiringFor: '' },
}: {
  token: string;
  recruiter: RecruiterInfo;
  candidates: RecruiterCandidate[];
  revealedContacts: Record<string, string>;   // appId → real email, for contacts already revealed
  needsRegistration?: boolean;
  prefill?: { company: string; hiringFor: string };
}) {
  const isPro = recruiter.plan === 'pro';

  const [view, setViewRaw] = useState<View>('candidates');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [density, setDensity] = useState<Density>('comfortable');
  const [roleFilter, setRoleFilter] = useState('all');
  const [mobileNav, setMobileNav] = useState(false);

  // reveal — seed from the recruiter's existing ContactReveal rows (server supplies the real
  // email for each, since they've already been revealed to this recruiter).
  const [revealed, setRevealed] = useState<Record<string, string>>(() => ({ ...revealedContacts }));
  const [revealing, setRevealing] = useState<string | null>(null);

  const [threads, setThreads] = useState<Record<string, Msg[]>>({});
  const [threadLoading, setThreadLoading] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);
  const [sendErr, setSendErr] = useState<Record<string, string>>({});

  const [paywall, setPaywall] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // registration (value-first: asked at first reply)
  const [registered, setRegistered] = useState(false);
  const [regOpen, setRegOpen] = useState(false);
  const [pendingReplyAppId, setPendingReplyAppId] = useState<string | null>(null);
  const [regName, setRegName] = useState(recruiter.name || '');
  const [regCompany, setRegCompany] = useState(prefill.company);
  const [regHiringFor, setRegHiringFor] = useState(prefill.hiringFor);
  const [regVol, setRegVol] = useState('');
  const [regSaving, setRegSaving] = useState(false);
  const [regErr, setRegErr] = useState('');

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg((m) => (m === msg ? null : m)), 2600);
  }, []);

  const track = useCallback((event: string, appId?: string) => {
    fetch('/api/recruiter/track', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, event, appId }),
    }).catch(() => {});
  }, [token]);

  const setView = useCallback((v: View) => { setDetailId(null); setViewRaw(v); setMobileNav(false); }, []);
  const openDetail = useCallback((appId: string) => { setDetailId(appId); setViewRaw('candidates'); window.scrollTo(0, 0); }, []);
  const closeDetail = useCallback(() => setDetailId(null), []);

  // ----- grouping / colour index (stable by sorted position, like the prototype) -----
  const { colorIdx, groups, conversations } = useMemo(() => {
    const ci: Record<string, number> = {};
    const order: string[] = [];
    const map: Record<string, RecruiterCandidate[]> = {};
    candidates.forEach((c, i) => {
      ci[c.appId] = i;
      if (!map[c.listingKey]) { map[c.listingKey] = []; order.push(c.listingKey); }
      map[c.listingKey].push(c);
    });
    const gs: Group[] = order.map((k) => ({ key: k, jobTitle: map[k][0].jobTitle, items: map[k] }));
    const convs = candidates.filter((c) => c.repliedAt || (c.status || '').toUpperCase() === 'REPLIED' || (c.status || '').toUpperCase() === 'INTERVIEW' || (c.status || '').toUpperCase() === 'OFFER');
    return { colorIdx: ci, groups: gs, conversations: convs };
  }, [candidates]);

  // ----- reveal mechanic (2 free → paywall) -----
  const revealsUsed = Object.keys(revealed).length;
  const revealsLeft = isPro ? Infinity : Math.max(0, FREE_REVEAL_QUOTA - revealsUsed);

  const isRevealed = useCallback((appId: string) => isPro || appId in revealed, [isPro, revealed]);
  const revealedEmail = useCallback((appId: string) => revealed[appId] || undefined, [revealed]);

  const doReveal = useCallback(async (appId: string) => {
    if (appId in revealed) return;               // already revealed
    if (!isPro && revealsLeft <= 0) { setPaywall(true); return; }
    if (revealing) return;
    track('reveal_contact', appId);
    setRevealing(appId);
    try {
      const res = await fetch('/api/recruiter/reveal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, applicationId: appId }),
      });
      const data = await res.json();
      if (res.ok && data.email) {
        setRevealed((r) => ({ ...r, [appId]: data.email }));
        const left = isPro ? Infinity : Math.max(0, FREE_REVEAL_QUOTA - (revealsUsed + 1));
        toast(isPro ? 'Contact revealed' : `Contact revealed · ${left} free ${left === 1 ? 'reveal' : 'reveals'} left`);
      }
    } catch {
      /* recruiter can retry */
    } finally {
      setRevealing(null);
    }
  }, [revealed, isPro, revealsLeft, revealing, track, token, revealsUsed, toast]);

  // ----- thread -----
  const loadThread = useCallback(async (appId: string) => {
    if (threads[appId] || threadLoading[appId]) return;
    setThreadLoading((l) => ({ ...l, [appId]: true }));
    try {
      const res = await fetch(`/api/recruiter/thread?token=${encodeURIComponent(token)}&appId=${encodeURIComponent(appId)}`);
      const data = await res.json();
      setThreads((t) => ({ ...t, [appId]: Array.isArray(data.thread) ? data.thread : [] }));
    } catch {
      setThreads((t) => ({ ...t, [appId]: [] }));
    } finally {
      setThreadLoading((l) => ({ ...l, [appId]: false }));
    }
  }, [threads, threadLoading, token]);

  const doSendRaw = useCallback(async (appId: string) => {
    const message = (drafts[appId] || '').trim();
    if (!message) return;
    track('send_click', appId);
    setSending(appId);
    setSendErr((e) => ({ ...e, [appId]: '' }));
    try {
      const res = await fetch('/api/recruiter/reply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, applicationId: appId, message }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setThreads((t) => ({ ...t, [appId]: [...(t[appId] || []), { from: 'recruiter', text: message, at: new Date().toISOString() }] }));
        setDrafts((d) => ({ ...d, [appId]: '' }));
      } else {
        setSendErr((e) => ({ ...e, [appId]: data.error || 'Failed to send' }));
      }
    } catch {
      setSendErr((e) => ({ ...e, [appId]: 'Network error' }));
    } finally {
      setSending(null);
    }
  }, [drafts, track, token]);

  const doSend = useCallback((appId: string) => {
    if (!(drafts[appId] || '').trim()) return;
    if (needsRegistration && !registered) { setPendingReplyAppId(appId); setRegErr(''); setRegOpen(true); return; }
    void doSendRaw(appId);
  }, [drafts, needsRegistration, registered, doSendRaw]);

  const completeRegistration = useCallback(async () => {
    if (regSaving) return;
    setRegSaving(true); setRegErr('');
    try {
      const r = await fetch('/api/recruiter/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name: regName, company: regCompany, hiringFor: regHiringFor, hiringVolume: regVol }),
      });
      if (!r.ok) throw new Error();
      setRegistered(true); setRegOpen(false);
      const pid = pendingReplyAppId; setPendingReplyAppId(null);
      if (pid) void doSendRaw(pid);
    } catch {
      setRegErr('Something went wrong — try again.');
    } finally {
      setRegSaving(false);
    }
  }, [regSaving, token, regName, regCompany, regHiringFor, regVol, pendingReplyAppId, doSendRaw]);

  const onSubscribe = useCallback(() => {
    track('subscribe_intent');
    setPaywall(false);
    toast('Thanks — we&rsquo;ll email you to set up Pro.');
  }, [track, toast]);

  const api: CabinetApi = {
    token, recruiter, candidates, colorIdx, groups, conversations, isPro,
    view, setView, detailId, openDetail, closeDetail,
    density, setDensity, roleFilter, setRoleFilter,
    revealsUsed, revealsLeft, isRevealed, revealedEmail, revealing, doReveal,
    getThread: (id) => threads[id] || [],
    isThreadLoading: (id) => !!threadLoading[id],
    loadThread,
    draftOf: (id) => drafts[id] || '',
    setDraft: (id, v) => setDrafts((d) => ({ ...d, [id]: v })),
    sending, sendError: (id) => sendErr[id] || undefined, doSend,
    track, openPaywall: () => setPaywall(true), toast,
  };

  const activeNav: View = view;

  return (
    <Ctx.Provider value={api}>
      <div className={`app sb-light ${density}`}>
        {/* ---------- sidebar ---------- */}
        <aside className={`sidebar${mobileNav ? ' open' : ''}`}>
          <div className="sb-logo">
            <span className="sb-logo-mark">F</span>
            <span>Freelanly</span>
            <span className="sb-logo-tag">for recruiters</span>
          </div>
          {NAV.map((group) => (
            <div key={group.label}>
              <div className="sb-section-label">{group.label}</div>
              <ul className="sb-nav">
                {group.items.map((item) => {
                  const count = item.id === 'candidates' ? candidates.length
                    : item.id === 'conversations' ? conversations.length : undefined;
                  const isActive = item.id === activeNav;
                  return (
                    <li key={item.id}>
                      <a
                        href="#"
                        className={isActive ? 'active' : ''}
                        onClick={(e) => {
                          e.preventDefault();
                          if (item.id === 'post') { if (!isPro) setPaywall(true); return; }
                          setView(item.id as View);
                        }}
                      >
                        <span className="sb-icon"><RIcon name={item.icon} size={16} /></span>
                        <span>{item.label}</span>
                        {item.pro && !isPro ? <span className="sb-count"><RIcon name="lock" size={11} /></span>
                          : count != null ? <span className="sb-count">{count}</span> : null}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <div className="sb-spacer" />
          {isPro ? (
            <div className="sb-trial" style={{ background: 'linear-gradient(180deg,rgba(199,249,74,0.12),rgba(199,249,74,0.04))' }}>
              <div className="label">Pro plan · active</div>
              <div className="days" style={{ fontSize: '14px' }}>Unlimited reveals</div>
              <a href="#" className="upgrade" onClick={(e) => { e.preventDefault(); setView('account'); }}>Manage plan →</a>
            </div>
          ) : (
            <div className="sb-trial">
              <div className="label">Free plan</div>
              <div className="days" style={{ fontSize: '15px' }}>{revealsLeft} of {FREE_REVEAL_QUOTA} reveals left</div>
              <div className="bar"><div style={{ width: `${(Math.max(0, revealsLeft as number) / FREE_REVEAL_QUOTA) * 100}%` }} /></div>
              <a href="#" className="upgrade" onClick={(e) => { e.preventDefault(); setPaywall(true); }}>Unlock unlimited → $49/mo</a>
            </div>
          )}
          <div className="sb-user" onClick={() => setView('account')}>
            <div className="sb-avatar">{(recruiter.name || recruiter.email).slice(0, 2).toUpperCase()}</div>
            <div>
              <div className="sb-user-name">{recruiter.name || 'Recruiter'}</div>
              <div className="sb-user-plan">{recruiter.company || recruiter.email}</div>
            </div>
            <div style={{ color: 'var(--ink-4)' }}><RIcon name="chevron" size={14} /></div>
          </div>
        </aside>
        {mobileNav && <div className="sidebar-backdrop show" onClick={() => setMobileNav(false)} />}

        {/* ---------- main ---------- */}
        <main className="main">
          <div className="mobile-topbar">
            <button className="menu-btn" onClick={() => setMobileNav(true)}><RIcon name="menu" size={18} /></button>
            <div className="mlogo"><span className="mlogo-mark">F</span><span>Freelanly</span></div>
          </div>
          <div className="topbar">
            <div className="crumb">
              <span>Workspace</span><RIcon name="chevron" size={12} />
              <strong>{detailId ? 'Candidate' : view === 'overview' ? 'Overview' : view === 'candidates' ? 'Candidates' : view === 'conversations' ? 'Conversations' : 'Account'}</strong>
            </div>
            <div className="topbar-actions">
              <span className="tb-email mono">{recruiter.email}</span>
              {isPro
                ? <span className="plan-pill pro"><RIcon name="bolt" size={12} /> Pro</span>
                : <a href="#" className="plan-pill free" onClick={(e) => { e.preventDefault(); setPaywall(true); }}>{revealsLeft}/{FREE_REVEAL_QUOTA} reveals</a>}
              {!isPro && <a href="#" className="btn btn-acid btn-sm" onClick={(e) => { e.preventDefault(); setPaywall(true); }}><RIcon name="bolt" size={14} /> Upgrade</a>}
            </div>
          </div>

          <div className="page">
            {detailId ? <CandidateDetail appId={detailId} />
              : view === 'overview' ? <OverviewView />
              : view === 'candidates' ? <CandidatesView />
              : view === 'conversations' ? <ConversationsView />
              : <AccountView />}
          </div>
        </main>
      </div>

      {/* paywall */}
      <Paywall open={paywall} onClose={() => setPaywall(false)} onSubscribe={onSubscribe} />

      {/* toast */}
      <div className={`fl-toast${toastMsg ? ' show' : ''}`}>
        <RIcon name="check" size={15} /><span>{toastMsg}</span>
      </div>

      {/* registration modal (first reply) */}
      {regOpen && (
        <div onClick={() => { if (!regSaving) setRegOpen(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 250 }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ padding: '22px', maxWidth: '420px', width: '100%' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '18px' }}>One quick step to reply</h3>
            <p className="meta" style={{ margin: '0 0 16px', fontSize: '13px' }}>A few details and your message goes straight to the candidate. No password needed.</p>
            <div style={{ marginBottom: '12px' }}>
              <span style={REG_LABEL}>Your email</span>
              <input value={recruiter.email} readOnly disabled style={{ ...REG_INPUT, background: '#F6F5F1', color: '#8A8780' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}><label style={REG_LABEL}>Your name</label><input value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Jane" style={REG_INPUT} /></div>
              <div style={{ flex: 1 }}><label style={REG_LABEL}>Company</label><input value={regCompany} onChange={(e) => setRegCompany(e.target.value)} placeholder="Acme" style={REG_INPUT} /></div>
            </div>
            <div style={{ marginBottom: '12px' }}><label style={REG_LABEL}>What are you hiring for?</label><input value={regHiringFor} onChange={(e) => setRegHiringFor(e.target.value)} placeholder="e.g. React developer, Interpreter" style={REG_INPUT} /></div>
            <div style={{ marginBottom: '18px' }}>
              <label style={REG_LABEL}>How many people are you looking to hire?</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {REG_VOLUMES.map((v) => (
                  <button key={v} onClick={() => setRegVol(v)} style={{ flex: 1, padding: '8px 0', borderRadius: '9px', fontSize: '14px', cursor: 'pointer', border: regVol === v ? '1.5px solid #0B0C0F' : '1px solid #E8E5DC', background: regVol === v ? '#0B0C0F' : '#fff', color: regVol === v ? '#fff' : '#0B0C0F', fontWeight: regVol === v ? 600 : 400 }}>{v}</button>
                ))}
              </div>
            </div>
            <button onClick={completeRegistration} disabled={regSaving} className="btn" style={{ width: '100%', padding: '12px', fontSize: '15px', fontWeight: 600, background: '#0B0C0F', color: '#fff', border: 0, borderRadius: '10px', cursor: regSaving ? 'default' : 'pointer', opacity: regSaving ? 0.6 : 1 }}>
              {regSaving ? 'Sending…' : 'Save & send message →'}
            </button>
            {regErr && <p style={{ color: '#c0392b', fontSize: '13px', margin: '10px 0 0', textAlign: 'center' }}>{regErr}</p>}
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
