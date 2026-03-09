'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

const STORAGE_KEYS = ['gclid', 'gbraid', 'wbraid'] as const;
const UTM_KEYS = ['utm_source', 'utm_medium'] as const;
const EXPIRY_DAYS = 90;

export function GclidCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const expiry = Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    for (const key of STORAGE_KEYS) {
      const value = searchParams.get(key);
      if (value) {
        localStorage.setItem(`_${key}`, JSON.stringify({ value, expires: expiry }));
      }
    }

    for (const key of UTM_KEYS) {
      const value = searchParams.get(key);
      if (value) {
        localStorage.setItem(`_${key}`, JSON.stringify({ value, expires: expiry }));
      }
    }
  }, [searchParams]);

  return null;
}

/** Read stored gclid/gbraid/wbraid, returning null if expired */
export function getStoredClickId(): { key: string; value: string } | null {
  if (typeof window === 'undefined') return null;
  for (const key of STORAGE_KEYS) {
    const raw = localStorage.getItem(`_${key}`);
    if (!raw) continue;
    try {
      const item = JSON.parse(raw) as { value: string; expires: number };
      if (Date.now() < item.expires) {
        return { key, value: item.value };
      }
      localStorage.removeItem(`_${key}`);
    } catch {
      localStorage.removeItem(`_${key}`);
    }
  }
  return null;
}

/** Read stored utm_source, returning null if expired */
export function getStoredUtmSource(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('_utm_source');
  if (!raw) return null;
  try {
    const item = JSON.parse(raw) as { value: string; expires: number };
    if (Date.now() < item.expires) {
      return item.value;
    }
    localStorage.removeItem('_utm_source');
  } catch {
    localStorage.removeItem('_utm_source');
  }
  return null;
}
