'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const NAV = [
  { label: 'PRIMARY', items: [
    { id: 'dashboard', href: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { id: 'discovery', href: '/dashboard/auto-apply?tab=discovery', label: 'Discovery', icon: '🧭' },
    { id: 'inbox', href: '/dashboard/auto-apply?tab=inbox', label: 'Inbox', icon: '📥' },
    { id: 'pipeline', href: '/dashboard/auto-apply?tab=pipeline', label: 'Pipeline', icon: '📊' },
  ]},
  { label: 'CONTENT', items: [
    { id: 'templates', href: '/dashboard/auto-apply?tab=templates', label: 'Templates', icon: '✏️' },
    { id: 'analytics', href: '/dashboard/auto-apply?tab=analytics', label: 'Analytics', icon: '📈' },
  ]},
  { label: 'ACCOUNT', items: [
    { id: 'settings', href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
    { id: 'billing', href: '/dashboard/auto-apply?tab=billing', label: 'Billing', icon: '💳' },
  ]},
];

export function AppShell({ children, userName, userPlan }: { children: React.ReactNode; userName?: string; userPlan?: string }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const initials = userName?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';

  const isActive = (href: string) => {
    if (href === '/dashboard' && pathname === '/dashboard') return true;
    if (href.includes('?tab=')) return pathname?.includes('/auto-apply') && href.includes(pathname.split('tab=')[1] || '');
    return pathname?.startsWith(href);
  };

  return (
    <div className="grid min-h-screen" style={{ gridTemplateColumns: '232px 1fr', background: '#F7F6F1' }}>
      {/* Sidebar */}
      <aside className={`hidden lg:flex flex-col p-3 gap-4 sticky top-0 h-screen overflow-y-auto ${sidebarOpen ? 'flex' : ''}`} style={{ background: '#0B0C0F', color: '#E8E8E3' }}>
        <div className="flex items-center gap-2.5 px-2.5 pb-3 border-b border-white/[0.06] font-semibold text-[15px] tracking-tight">
          <span className="w-[26px] h-[26px] rounded-[7px] bg-[#C7F94A] text-black grid place-items-center font-mono font-bold text-sm">F</span>
          <span>Freelanly</span>
        </div>

        {NAV.map(group => (
          <div key={group.label}>
            <div className="font-mono text-[10px] tracking-[0.1em] uppercase text-[#9C9EA2]/60 px-3 pt-3 pb-1.5">{group.label}</div>
            <ul className="flex flex-col gap-0.5">
              {group.items.map(item => (
                <li key={item.id}>
                  <Link href={item.href} className={`flex items-center gap-3 px-3 py-2 rounded-[10px] text-[13.5px] transition-colors ${isActive(item.href) ? 'bg-[rgba(199,249,74,0.10)] text-[#C7F94A]' : 'text-[#E8E8E3] hover:bg-[#15171B]'}`}>
                    <span className="text-sm">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="flex-1" />

        {/* Trial / upgrade */}
        {userPlan === 'FREE' && (
          <div className="mt-2 p-3.5 rounded-[10px]" style={{ background: 'linear-gradient(180deg, rgba(199,249,74,0.10), rgba(199,249,74,0.04))', border: '1px solid rgba(199,249,74,0.20)' }}>
            <div className="font-mono text-[10px] text-[#C7F94A] tracking-widest uppercase">Free plan</div>
            <Link href="/pricing" className="block mt-2.5 text-[12px] text-[#C7F94A] font-medium">Upgrade → $29/mo</Link>
          </div>
        )}

        {/* User */}
        <div className="flex items-center gap-2.5 p-2.5 border-t border-white/[0.06] cursor-pointer hover:bg-[#15171B] rounded-[10px]">
          <div className="w-8 h-8 rounded-full grid place-items-center font-mono font-semibold text-xs text-black" style={{ background: 'linear-gradient(135deg, #FF6B6B, #C7F94A)' }}>{initials}</div>
          <div>
            <div className="text-[13px] font-medium leading-tight">{userName || 'User'}</div>
            <div className="text-[11px] text-[#9C9EA2] font-mono">{userPlan || 'Free'}</div>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <main className="min-w-0 flex flex-col">
        {/* Mobile topbar */}
        <div className="flex lg:hidden items-center h-[52px] px-4 gap-3 border-b sticky top-0 z-20" style={{ borderColor: 'rgba(11,12,15,0.07)', background: '#F7F6F1' }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="w-9 h-9 grid place-items-center rounded-[10px] hover:bg-[#F0EEE6]">☰</button>
          <div className="flex items-center gap-2 font-semibold text-sm">
            <span className="w-[22px] h-[22px] rounded-md bg-[#0A0B0F] text-[#C7F94A] grid place-items-center font-mono font-bold text-[12px]">F</span>
            Freelanly
          </div>
        </div>

        {/* Topbar */}
        <div className="hidden lg:flex items-center h-14 px-6 gap-4 border-b sticky top-0 z-20" style={{ borderColor: 'rgba(11,12,15,0.07)', background: 'rgba(247,246,241,0.85)', backdropFilter: 'blur(20px)' }}>
          <div className="flex-1" />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] text-[13px] text-[#5C6068]" style={{ background: 'white', border: '1px solid rgba(11,12,15,0.07)' }}>
            🔍 <input placeholder="Search jobs, replies..." className="bg-transparent outline-none text-[13px] w-48" />
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#F0EEE6] border border-[rgba(11,12,15,0.07)] text-[#8A8E96]">⌘K</span>
          </div>
          <Link href="/dashboard/auto-apply?tab=discovery" className="flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] bg-[#C7F94A] text-black text-[13px] font-medium">+ Apply</Link>
        </div>

        {/* Page content */}
        <div className="p-5 md:p-7 max-w-[1400px] w-full mx-auto">
          {children}
        </div>
      </main>

      <style jsx global>{`
        @media (max-width: 1023px) {
          .grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
