'use client';

import { useEffect } from 'react';

interface SenjaWidgetProps {
  widgetId?: string;
  className?: string;
}

const DEFAULT_WIDGET_ID = '8226e45c-6e3e-4947-b0ae-afe208a107aa';

export function SenjaWidget({ widgetId = DEFAULT_WIDGET_ID, className }: SenjaWidgetProps) {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = `https://widget.senja.io/widget/${widgetId}/platform.js`;
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [widgetId]);

  return (
    <div
      className={`senja-embed ${className || ''}`}
      data-id={widgetId}
      data-mode="shadow"
      data-lazyload="false"
      style={{ display: 'block', width: '100%' }}
    />
  );
}
