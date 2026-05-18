'use client';

import { useEffect, useRef } from 'react';

export function WelcomeOnboarding() {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    const onLoad = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) return;

        // Remove demo bar and shell
        doc.querySelector('.demo-bar')?.remove();
        doc.getElementById('shellSidebar')?.remove();
        doc.getElementById('shellTopbar')?.remove();
        const app = doc.getElementById('app');
        if (app) app.style.display = 'block';
        const main = doc.querySelector('.main') as HTMLElement;
        if (main) main.style.padding = '0';
        const pageHeader = doc.querySelector('.page-header') as HTMLElement;
        if (pageHeader) pageHeader.style.display = 'none';

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
  }, []);

  return (
    <iframe
      ref={ref}
      src="/welcome"
      style={{ width: '100%', border: 'none', minHeight: '700px', borderRadius: '16px', overflow: 'hidden' }}
      title="Welcome onboarding"
    />
  );
}
