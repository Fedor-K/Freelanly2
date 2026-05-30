'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';

const ICONS: Record<string, string> = {
  home:    '<path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1V9.5z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M16 8l-2 6-6 2 2-6 6-2z"/>',
  inbox:   '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/>',
  columns: '<rect x="3" y="3" width="6" height="18" rx="1"/><rect x="11" y="3" width="6" height="13" rx="1"/><rect x="19" y="3" width="2" height="9" rx="1"/>',
  edit:    '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  bar:     '<path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 6-6"/>',
  cog:     '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/>',
  card:    '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  bell:    '<path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>',
  search:  '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  plus:    '<path d="M12 5v14M5 12h14"/>',
  menu:    '<path d="M3 12h18M3 6h18M3 18h18"/>',
  chevron: '<path d="M9 18l6-6-6-6"/>',
};

function SvgIcon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[name] || '' }} />
  );
}

type NavItem = { id: string; href: string; label: string; icon: string; count?: number };
const NAV: { label: string; items: NavItem[] }[] = [
  { label: 'PRIMARY', items: [
    { id: 'dashboard', href: '/dashboard',            label: 'Dashboard',  icon: 'home' },
    { id: 'discovery', href: '/dashboard/discovery',   label: 'Discovery', icon: 'compass' },
    { id: 'inbox',     href: '/dashboard/inbox',        label: 'Inbox',     icon: 'inbox' },
    { id: 'pipeline',  href: '/dashboard/pipeline',     label: 'Pipeline',  icon: 'columns' },
  ]},
  { label: 'CONTENT', items: [
    { id: 'templates', href: '/dashboard/templates',    label: 'Templates', icon: 'edit' },
    { id: 'analytics', href: '/dashboard/analytics',    label: 'Analytics', icon: 'bar' },
  ]},
  { label: 'ACCOUNT', items: [
    { id: 'settings', href: '/dashboard/settings',      label: 'Settings', icon: 'cog' },
    { id: 'billing',  href: '/dashboard/billing',       label: 'Billing',  icon: 'card' },
  ]},
];

type SearchResult = { id: string; type: 'application' | 'opportunity' | 'job'; jobTitle: string; companyName: string; status: string };

function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); (ref.current?.querySelector('input') as HTMLInputElement)?.focus(); } };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey); };
  }, []);

  function handleSearch(q: string) {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/user/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
          setOpen(true);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }, 300);
  }

  return (
    <div className="topbar-search" ref={ref} style={{ position: 'relative' }}>
      <SvgIcon name="search" size={14} />
      <input
        placeholder="Search jobs, replies, contacts…"
        value={query}
        onChange={e => handleSearch(e.target.value)}
        onFocus={() => { if (results.length > 0) setOpen(true); }}
      />
      <span className="shortcut">⌘K</span>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-1)', border: '1px solid var(--line-2)', borderRadius: '0 0 10px 10px', boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 100, maxHeight: '320px', overflow: 'auto' }}>
          {loading && <div style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--ink-4)' }}>Searching...</div>}
          {!loading && results.length === 0 && <div style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--ink-4)' }}>No results for &ldquo;{query}&rdquo;</div>}
          {results.map(r => {
            const href = r.type === 'application' ? `/dashboard#${r.id}`
              : r.type === 'opportunity' ? `/dashboard/discovery/${r.id}`
              : `/jobs`;
            const chipCls = r.status === 'OPPORTUNITY' ? 'queued' : r.status === 'JOB' ? 'queued'
              : r.status === 'REPLIED' ? 'replied' : r.status === 'INTERVIEW' ? 'interview'
              : r.status === 'OPENED' ? 'opened' : 'sent';
            const label = r.type === 'application' ? r.status.toLowerCase()
              : r.type === 'opportunity' ? 'opportunity' : 'job';
            return (
              <div
                key={`${r.type}-${r.id}`}
                style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--line)', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseDown={() => { setOpen(false); setQuery(''); router.push(href); }}
              >
                <div>
                  <span style={{ fontWeight: 500 }}>{r.jobTitle}</span>
                  <span style={{ color: 'var(--ink-3)', marginLeft: '8px' }}>{r.companyName}</span>
                </div>
                <span className={`status-chip ${chipCls}`} style={{ fontSize: '10px', padding: '2px 6px' }}>{label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type FeedItem = { id: string; icon: string; text: string; time: string; type: string };

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    // Check for unread on mount
    fetch('/api/user/activity-feed').then(r => r.json()).then(d => {
      if (d.items?.some((i: FeedItem) => i.type === 'reply')) setHasUnread(true);
    }).catch(() => {});
  }, []);

  async function toggle() {
    setOpen(!open);
    if (items.length > 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/user/activity-feed');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setHasUnread(false);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  const TYPE_COLORS: Record<string, string> = { scan: 'var(--ink-4)', match: 'var(--acid-deep)', send: 'var(--info)', sent: 'var(--good)', open: '#6EE7FF', reply: '#C7F94A', skip: 'var(--ink-5)' };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="icon-btn" title="Activity" onClick={toggle} style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative' }}>
        <SvgIcon name="bell" size={16} />
        {hasUnread && <span className="dot"></span>}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, width: '380px', background: 'var(--bg-1)', border: '1px solid var(--line-2)', borderRadius: '12px', boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 100, maxHeight: '440px', overflow: 'auto' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '14px' }}>Activity</span>
            <a href="/dashboard/inbox" style={{ fontSize: '12px', color: 'var(--acid-deep)' }}>Inbox →</a>
          </div>
          {loading && <div style={{ padding: '20px 16px', fontSize: '13px', color: 'var(--ink-4)', textAlign: 'center' }}>Loading...</div>}
          {!loading && items.length === 0 && <div style={{ padding: '20px 16px', fontSize: '13px', color: 'var(--ink-4)', textAlign: 'center' }}>No activity yet</div>}
          {items.map((item, i) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 16px', borderBottom: '1px solid var(--line)', fontSize: '12.5px', animation: `feedSlideIn 0.3s ease ${i * 0.05}s both`, opacity: 0 }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: TYPE_COLORS[item.type] || 'var(--ink-4)', flexShrink: 0, boxShadow: item.type === 'reply' ? '0 0 8px #C7F94A' : 'none' }}></span>
              <span style={{ flex: 1, fontFamily: "'Geist Mono', monospace", fontSize: '11.5px' }}>{item.icon} {item.text}</span>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10px', color: 'var(--ink-4)', flexShrink: 0 }}>{item.time}</span>
            </div>
          ))}
          <style>{`@keyframes feedSlideIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children, userName, userPlan }: { children: React.ReactNode; userName?: string; userPlan?: string }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const initials = userName?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';

  const isActive = (item: { id: string; href: string }) => {
    if (item.href === '/dashboard' && pathname === '/dashboard') return true;
    if (item.href === '/dashboard') return false;
    return pathname?.startsWith(item.href);
  };

  return (
    <div className="app">
      {/* SIDEBAR */}
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`} id="sidebar">
        <div className="sb-logo">
          <span className="sb-logo-mark">F</span>
          <span>Freelanly</span>
        </div>

        {NAV.map(group => (
          <div key={group.label}>
            <div className="sb-section-label">{group.label}</div>
            <ul className="sb-nav">
              {group.items.map(item => (
                <li key={item.id}>
                  <a href={item.href} className={isActive(item) ? 'active' : ''}>
                    <span className="sb-icon"><SvgIcon name={item.icon} size={16} /></span>
                    <span>{item.label}</span>
                    {item.count && <span className="sb-count">{item.count}</span>}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="sb-spacer"></div>

        {userPlan === 'FREE' && (
          <div className="sb-trial">
            <div className="label">Free plan</div>
            <div className="days">20 applies / day</div>
            <div className="bar"><div></div></div>
            <a href="/pricing" className="upgrade">Upgrade → €15/mo</a>
          </div>
        )}

        <div className="sb-user" onClick={() => setShowUserMenu(!showUserMenu)} style={{cursor: 'pointer', position: 'relative'}}>
          <div className="sb-avatar">{initials}</div>
          <div>
            <div className="sb-user-name">{userName || 'User'}</div>
            <div className="sb-user-plan">{userPlan || 'Free'}</div>
          </div>
          <div style={{color: 'var(--ink-on-dark-2)'}}><SvgIcon name="chevron" size={14} /></div>
          {showUserMenu && (
            <div style={{position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '8px', background: 'var(--bg-dark-2)', border: '1px solid var(--line-dark)', borderRadius: '10px', overflow: 'hidden', zIndex: 50}}>
              <a href="/dashboard/settings" style={{display: 'block', padding: '10px 14px', fontSize: '13px', color: 'var(--ink-on-dark)', borderBottom: '1px solid var(--line-dark)'}}>Settings</a>
              <a href="/api/auth/signout" style={{display: 'block', padding: '10px 14px', fontSize: '13px', color: '#F87171'}}>Log out</a>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile backdrop */}
      {sidebarOpen && <div className="sidebar-backdrop show" onClick={() => setSidebarOpen(false)} />}

      {/* MAIN */}
      <main className="main">
        {/* Mobile topbar */}
        <div className="mobile-topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <SvgIcon name="menu" size={18} />
          </button>
          <div className="mlogo">
            <span className="mlogo-mark">F</span>
            <span>Freelanly</span>
          </div>
        </div>

        {/* Desktop topbar */}
        <div className="topbar">
          <div className="crumb">
            <span>Workspace</span>
            <SvgIcon name="chevron" size={12} />
            <strong>Dashboard</strong>
          </div>
          <SearchBar />
          <div className="topbar-actions">
            <NotificationBell />
            <a href="/dashboard/discovery" className="btn btn-acid btn-sm">
              <SvgIcon name="plus" size={14} />
              Apply
            </a>
          </div>
        </div>

        {/* Page content */}
        {children}
      </main>
    </div>
  );
}
