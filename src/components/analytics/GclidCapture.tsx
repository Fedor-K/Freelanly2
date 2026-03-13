'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

const STORAGE_KEYS = ['gclid', 'gbraid', 'wbraid'] as const;
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;
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

    // Support short ?ref=telegram param (Telegram strips underscores from URLs)
    const ref = searchParams.get('ref');
    if (ref) {
      localStorage.setItem('_utm_source', JSON.stringify({ value: ref, expires: expiry }));
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

/** Read all stored UTM params */
export function getStoredUtmParams(): {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
} {
  if (typeof window === 'undefined') return {};
  const result: Record<string, string> = {};
  for (const [key, field] of [
    ['_utm_source', 'utmSource'],
    ['_utm_medium', 'utmMedium'],
    ['_utm_campaign', 'utmCampaign'],
    ['_utm_content', 'utmContent'],
  ] as const) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const item = JSON.parse(raw) as { value: string; expires: number };
      if (Date.now() < item.expires) result[field] = item.value;
      else localStorage.removeItem(key);
    } catch {
      localStorage.removeItem(key);
    }
  }
  return result;
}
