'use client';

import { useState, useEffect, useRef } from 'react';

type FeedItem = {
  id: string;
  icon: string;
  text: string;
  time: string;
  type: 'scan' | 'match' | 'send' | 'sent' | 'open' | 'reply' | 'skip';
};

const TYPE_COLORS: Record<string, string> = {
  scan: 'var(--ink-4)',
  match: 'var(--acid-deep)',
  send: 'var(--info)',
  sent: 'var(--good)',
  open: '#6EE7FF',
  reply: '#C7F94A',
  skip: 'var(--ink-5)',
};

export function ActivityFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  async function fetchActivity() {
    try {
      const res = await fetch('/api/user/activity-feed');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => {
    fetchActivity();
    const interval = setInterval(fetchActivity, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--ink-4)', fontSize: '13px' }}>
        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--acid)', animation: 'pulse 1.5s infinite', marginRight: '8px' }}></span>
        Loading activity...
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div ref={containerRef} style={{ maxHeight: '240px', overflow: 'hidden', position: 'relative' }}>
      <div style={{
        maskImage: 'linear-gradient(to bottom, #000 70%, transparent)',
        WebkitMaskImage: 'linear-gradient(to bottom, #000 70%, transparent)',
      }}>
        {items.map((item, i) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 16px',
              fontSize: '12.5px',
              color: 'var(--ink-2)',
              borderBottom: '1px solid var(--line)',
              animation: `feedSlideIn 0.4s ease ${i * 0.08}s both`,
              opacity: 0,
            }}
          >
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: TYPE_COLORS[item.type] || 'var(--ink-4)',
              flexShrink: 0,
              boxShadow: item.type === 'reply' ? `0 0 8px ${TYPE_COLORS[item.type]}` : 'none',
            }}></span>
            <span style={{ flex: 1, fontFamily: "'Geist Mono', monospace", fontSize: '11.5px' }}>
              <span style={{ marginRight: '6px' }}>{item.icon}</span>
              {item.text}
            </span>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10px', color: 'var(--ink-4)', flexShrink: 0 }}>
              {item.time}
            </span>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes feedSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
