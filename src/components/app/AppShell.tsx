'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';

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

const NAV = [
  { label: 'PRIMARY', items: [
    { id: 'dashboard', href: '/dashboard',  label: 'Dashboard',  icon: 'home' },
    { id: 'discovery', href: '/dashboard/auto-apply?tab=discovery', label: 'Discovery', icon: 'compass', count: '142' },
    { id: 'inbox',     href: '/dashboard/auto-apply?tab=inbox',     label: 'Inbox',     icon: 'inbox',   count: '7' },
    { id: 'pipeline',  href: '/dashboard/auto-apply?tab=pipeline',  label: 'Pipeline',  icon: 'columns' },
  ]},
  { label: 'CONTENT', items: [
    { id: 'templates', href: '/dashboard/auto-apply?tab=templates', label: 'Templates', icon: 'edit' },
    { id: 'analytics', href: '/dashboard/auto-apply?tab=analytics', label: 'Analytics', icon: 'bar' },
  ]},
  { label: 'ACCOUNT', items: [
    { id: 'settings', href: '/dashboard/settings', label: 'Settings', icon: 'cog' },
    { id: 'billing',  href: '/dashboard/auto-apply?tab=billing',    label: 'Billing',   icon: 'card' },
  ]},
];

export function AppShell({ children, userName, userPlan }: { children: React.ReactNode; userName?: string; userPlan?: string }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const initials = userName?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';

  const isActive = (item: { id: string; href: string }) => {
    if (item.href === '/dashboard' && pathname === '/dashboard') return true;
    if (item.href.includes('?tab=')) {
      const tab = item.href.split('tab=')[1];
      return pathname?.includes('/auto-apply') && new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('tab') === tab;
    }
    return pathname?.startsWith(item.href) && item.href !== '/dashboard';
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
            <div className="days">5 applies / day</div>
            <div className="bar"><div></div></div>
            <a href="/pricing" className="upgrade">Upgrade → $29/mo</a>
          </div>
        )}

        <div className="sb-user">
          <div className="sb-avatar">{initials}</div>
          <div>
            <div className="sb-user-name">{userName || 'User'}</div>
            <div className="sb-user-plan">{userPlan || 'Free'}</div>
          </div>
          <div style={{color: 'var(--ink-on-dark-2)'}}><SvgIcon name="chevron" size={14} /></div>
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
          <div className="topbar-search">
            <SvgIcon name="search" size={14} />
            <input placeholder="Search jobs, replies, contacts…" />
            <span className="shortcut">⌘K</span>
          </div>
          <div className="topbar-actions">
            <button className="icon-btn" title="Notifications">
              <SvgIcon name="bell" size={16} />
              <span className="dot"></span>
            </button>
            <a href="/dashboard/auto-apply?tab=discovery" className="btn btn-acid btn-sm">
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
