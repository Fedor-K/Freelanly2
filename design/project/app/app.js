// =========================================================
// FREELANLY APP — shared sidebar, mobile nav, tab/seg logic
// =========================================================

const NAV = [
  { label: 'PRIMARY', items: [
    { id: 'dashboard',   href: 'index.html',      label: 'Dashboard',     icon: 'home' },
    { id: 'discovery',   href: 'discovery.html',  label: 'Discovery',     icon: 'compass', count: '142' },
    { id: 'inbox',       href: 'inbox.html',      label: 'Inbox',         icon: 'inbox',   count: '7' },
    { id: 'pipeline',    href: 'pipeline.html',   label: 'Pipeline',      icon: 'columns' },
  ] },
  { label: 'CONTENT', items: [
    { id: 'templates',   href: 'templates.html',  label: 'Templates',     icon: 'edit' },
    { id: 'analytics',   href: 'analytics.html',  label: 'Analytics',     icon: 'bar' },
  ] },
  { label: 'ACCOUNT', items: [
    { id: 'settings',    href: 'settings.html',   label: 'Settings',      icon: 'cog' },
    { id: 'billing',     href: 'billing.html',    label: 'Billing',       icon: 'card' },
  ] }
];

const ICONS = {
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
  arrow:   '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevron: '<path d="M9 18l6-6-6-6"/>',
  filter:  '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  check:   '<path d="M20 6L9 17l-5-5"/>',
  x:       '<path d="M18 6L6 18M6 6l12 12"/>',
  star:    '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  trend:   '<path d="M22 7l-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  send:    '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>',
  refresh: '<path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>',
  pause:   '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  play:    '<polygon points="5 3 19 12 5 21 5 3"/>'
};

function svg(name, size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}

function renderSidebar(activeId) {
  const isOnboarding = activeId === 'onboarding';
  const navHTML = NAV.map(group => {
    return `
      <div class="sb-section-label">${group.label}</div>
      <ul class="sb-nav">
        ${group.items.map(item => `
          <li>
            <a href="${item.href}" class="${item.id === activeId ? 'active' : ''}">
              <span class="sb-icon">${svg(item.icon, 16)}</span>
              <span>${item.label}</span>
              ${item.count ? `<span class="sb-count">${item.count}</span>` : ''}
            </a>
          </li>`).join('')}
      </ul>`;
  }).join('');

  return `
    <aside class="sidebar" id="sidebar">
      <div class="sb-logo">
        <span class="sb-logo-mark">F</span>
        <span>Freelanly</span>
      </div>
      ${navHTML}
      <div class="sb-spacer"></div>
      <div class="sb-trial">
        <div class="label">Pro trial</div>
        <div class="days">3 days left</div>
        <div class="bar"><div></div></div>
        <a href="billing.html" class="upgrade">Upgrade → $29/mo</a>
      </div>
      <div class="sb-user">
        <div class="sb-avatar">AK</div>
        <div>
          <div class="sb-user-name">Alex Kowalski</div>
          <div class="sb-user-plan">Pro · Trial</div>
        </div>
        <div style="color: var(--ink-on-dark-2);">${svg('chevron', 14)}</div>
      </div>
    </aside>
    <div class="sidebar-backdrop" id="sbBackdrop"></div>`;
}

function renderTopbar(crumbs) {
  const trail = crumbs.map((c, i) => {
    const last = i === crumbs.length - 1;
    return `${last ? `<strong>${c}</strong>` : `<span>${c}</span>`}${last ? '' : `${svg('chevron', 12)}`}`;
  }).join('');
  return `
    <div class="mobile-topbar">
      <button class="menu-btn" id="menuBtn">${svg('menu', 18)}</button>
      <div class="mlogo">
        <span class="mlogo-mark">F</span>
        <span>Freelanly</span>
      </div>
    </div>
    <div class="topbar">
      <div class="crumb">${trail}</div>
      <div class="topbar-search">
        ${svg('search', 14)}
        <input placeholder="Search jobs, replies, contacts…" />
        <span class="shortcut">⌘K</span>
      </div>
      <div class="topbar-actions">
        <button class="icon-btn" title="Notifications">
          ${svg('bell', 16)}
          <span class="dot"></span>
        </button>
        <a href="discovery.html" class="btn btn-acid btn-sm">${svg('plus', 14)} Apply</a>
      </div>
    </div>`;
}

function initShell(opts) {
  const { active, crumbs } = opts;
  const app = document.getElementById('app');
  if (!app) return;

  // Render sidebar
  const sbWrap = document.getElementById('shellSidebar');
  if (sbWrap) sbWrap.innerHTML = renderSidebar(active);

  // Render topbar
  const tbWrap = document.getElementById('shellTopbar');
  if (tbWrap) tbWrap.innerHTML = renderTopbar(crumbs || ['Freelanly']);

  // Mobile menu
  const menuBtn = document.getElementById('menuBtn');
  const sb = document.getElementById('sidebar');
  const bd = document.getElementById('sbBackdrop');
  if (menuBtn && sb && bd) {
    menuBtn.addEventListener('click', () => {
      sb.classList.add('open');
      bd.classList.add('show');
    });
    bd.addEventListener('click', () => {
      sb.classList.remove('open');
      bd.classList.remove('show');
    });
  }

  // Generic tab logic — [data-tabs] container with [data-tab] children
  document.querySelectorAll('[data-tabs]').forEach(group => {
    group.addEventListener('click', e => {
      const tab = e.target.closest('[data-tab]');
      if (!tab) return;
      group.querySelectorAll('[data-tab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.target;
      if (target) {
        const panels = document.querySelectorAll(`[data-panel-group="${group.dataset.tabs}"]`);
        panels.forEach(p => p.hidden = p.dataset.panel !== target);
      }
    });
  });

  // Segmented controls
  document.querySelectorAll('[data-seg]').forEach(seg => {
    seg.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      seg.querySelectorAll('button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    });
  });

  // Toggles
  document.querySelectorAll('.toggle').forEach(t => {
    t.addEventListener('click', () => t.classList.toggle('on'));
  });
}

// Expose globally
window.Freelanly = { initShell, svg };
