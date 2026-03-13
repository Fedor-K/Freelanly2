'use client';

import { useEffect } from 'react';

export function TidioChat() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://code.tidio.co/uquevng3hordznvrmb5mk3zix6pxbpxa.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);
  return null;
}
