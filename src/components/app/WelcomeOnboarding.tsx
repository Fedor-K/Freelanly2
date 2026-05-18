'use client';

import { useEffect, useRef } from 'react';

export function WelcomeOnboarding() {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Auto-height iframe
    const iframe = ref.current;
    if (!iframe) return;
    const onLoad = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          // Remove demo bar and shell from iframe
          const demoBar = doc.querySelector('.demo-bar');
          if (demoBar) demoBar.remove();
          const sidebar = doc.getElementById('shellSidebar');
          if (sidebar) sidebar.remove();
          const topbar = doc.getElementById('shellTopbar');
          if (topbar) topbar.remove();
          // Remove app wrapper, keep page content
          const app = doc.getElementById('app');
          if (app) app.style.display = 'block';
          const main = doc.querySelector('.main');
          if (main) (main as HTMLElement).style.padding = '0';

          // Resize
          const resize = () => {
            const h = doc.documentElement?.scrollHeight || 800;
            iframe.style.height = h + 'px';
          };
          resize();
          const observer = new MutationObserver(resize);
          observer.observe(doc.body, { childList: true, subtree: true, attributes: true });
        }
      } catch { /* cross-origin */ }
    };
    iframe.addEventListener('load', onLoad);
    return () => iframe.removeEventListener('load', onLoad);
  }, []);

  return (
    <iframe
      ref={ref}
      src="/welcome-v2.html"
      style={{ width: '100%', border: 'none', minHeight: '700px', borderRadius: '16px', overflow: 'hidden' }}
      title="Welcome onboarding"
    />
  );
}
