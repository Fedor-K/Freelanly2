'use client';

import { useEffect, useRef } from 'react';

interface WelcomeProps {
  userName?: string;
  matches?: Array<{ company: string; role: string; meta: string; score: number; pass: boolean; logo: { ch: string; bg: string } }>;
  totalToday?: number;
  aiSummary?: string;
}

export function WelcomeOnboarding({ userName, matches, totalToday, aiSummary }: WelcomeProps) {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    const onLoad = () => {
      try {
        const win = iframe.contentWindow;
        const doc = iframe.contentDocument || win?.document;
        if (!doc || !win) return;

        // Remove demo bar and shell
        doc.querySelector('.demo-bar')?.remove();
        doc.getElementById('shellSidebar')?.remove();
        doc.getElementById('shellTopbar')?.remove();
        const app = doc.getElementById('app');
        if (app) app.style.display = 'block';
        const main = doc.querySelector('.main') as HTMLElement;
        if (main) main.style.padding = '0';
        // Hide page header (we have our own)
        const pageHeader = doc.querySelector('.page-header') as HTMLElement;
        if (pageHeader) pageHeader.style.display = 'none';

        // Inject real data
        if (userName) {
          const h1 = doc.querySelector('.page-header h1');
          if (h1) h1.textContent = `Welcome, ${userName}.`;
        }

        // Override matches
        if (matches && matches.length > 0) {
          (win as any)._realMatches = matches.map(m => ({
            co: m.company, logo: m.logo, role: m.role, meta: m.meta,
            score: m.score, pass: m.pass
          }));
          (win as any)._totalToday = totalToday || 50;

          const top = matches.find(m => m.pass) || matches[0];

          // Replace hardcoded HTML references
          const toastTitle = doc.getElementById('toastTitle');
          if (toastTitle) toastTitle.innerHTML = `First application sent — to ${top.company}, "${top.role}"`;

          const summaryRight = doc.querySelector('.match-summary .right');
          if (summaryRight) summaryRight.innerHTML = `<b>Top pick:</b> ${top.company} · ${top.role} · ${top.score}%`;

          const targetNm = doc.querySelector('.target .nm');
          if (targetNm) targetNm.innerHTML = `${top.role}<span class="co">${top.company} · ${top.meta}</span>`;

          const sendAddr = doc.querySelector('.send-addr');
          if (sendAddr) sendAddr.textContent = `contact@${top.company.toLowerCase().replace(/\s+/g, '')}.com`;

          const doneH2 = doc.querySelector('[data-phase="done"] h2');
          if (doneH2) doneH2.textContent = `Sent — to ${top.company}.`;
          const doneP = doc.querySelector('[data-phase="done"] p');
          if (doneP) doneP.innerHTML = `Your first application is on its way to <b>${top.company}</b>. 14 more are queued and will go out across today and tomorrow.`;

          // Override cover letter
          (win as any)._coverOverride = [
            'Hi there,',
            `Saw your <em>${top.role}</em> post — my background aligns well with what you're looking for at <em>${top.company}</em>.`,
            `I'd love to discuss how my experience can contribute to your team.`,
            'Quick call this week?',
            `— ${userName || 'Applicant'}`,
          ];
        }

        // Resize
        const resize = () => {
          const h = doc.documentElement?.scrollHeight || 800;
          iframe.style.height = h + 'px';
        };
        resize();
        const observer = new MutationObserver(resize);
        observer.observe(doc.body, { childList: true, subtree: true, attributes: true });
      } catch { /* cross-origin */ }
    };
    iframe.addEventListener('load', onLoad);
    return () => iframe.removeEventListener('load', onLoad);
  }, [userName, matches, totalToday, aiSummary]);

  return (
    <iframe
      ref={ref}
      src="/welcome-v2.html"
      style={{ width: '100%', border: 'none', minHeight: '700px', borderRadius: '16px', overflow: 'hidden' }}
      title="Welcome onboarding"
    />
  );
}
