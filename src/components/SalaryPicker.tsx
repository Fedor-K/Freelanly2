'use client';

import { useState, useEffect } from 'react';

// Currency options (code + symbol) covering the candidate base (India, LATAM, MENA, SEA, West).
const CURRENCIES: { code: string; sym: string }[] = [
  { code: 'USD', sym: '$' }, { code: 'EUR', sym: '€' }, { code: 'GBP', sym: '£' },
  { code: 'INR', sym: '₹' }, { code: 'BRL', sym: 'R$' }, { code: 'AED', sym: 'AED' },
  { code: 'CAD', sym: 'C$' }, { code: 'AUD', sym: 'A$' }, { code: 'NGN', sym: '₦' },
  { code: 'PKR', sym: '₨' }, { code: 'PHP', sym: '₱' }, { code: 'IDR', sym: 'Rp' },
  { code: 'SGD', sym: 'S$' }, { code: 'ZAR', sym: 'R' }, { code: 'EGP', sym: 'E£' },
];

// Pay ranges by period. lo/hi in the period's own units; hi=null => "lo+". Native <select> ranges
// beat free-text on mobile: one tap, no keyboard, no width/truncation issues, standardized buckets.
type Bucket = { lo: number; hi: number | null };
const MONTHLY: Bucket[] = [
  { lo: 0, hi: 1000 }, { lo: 1000, hi: 2000 }, { lo: 2000, hi: 3000 }, { lo: 3000, hi: 4000 },
  { lo: 4000, hi: 5000 }, { lo: 5000, hi: 7000 }, { lo: 7000, hi: 10000 }, { lo: 10000, hi: null },
];
const YEARLY: Bucket[] = [
  { lo: 0, hi: 20000 }, { lo: 20000, hi: 40000 }, { lo: 40000, hi: 60000 }, { lo: 60000, hi: 80000 },
  { lo: 80000, hi: 100000 }, { lo: 100000, hi: 130000 }, { lo: 130000, hi: 160000 }, { lo: 160000, hi: null },
];

const f = (n: number) => n.toLocaleString('en-US');
function bucketLabel(b: Bucket, sym: string): string {
  if (b.lo === 0) return `Under ${sym}${f(b.hi as number)}`;
  if (b.hi === null) return `${sym}${f(b.lo)}+`;
  return `${sym}${f(b.lo)}–${f(b.hi)}`;
}

const selectStyle: React.CSSProperties = {
  padding: '10px 10px', border: '1px solid #D5D1C8', borderRadius: '8px', fontSize: '13px',
  background: '#fff', color: '#0A0B0F', minWidth: 0, cursor: 'pointer',
};

/**
 * Desired-pay picker as native selects: currency + range bucket + period. Emits a single
 * human-readable string (e.g. "$2,000–3,000/mo") through onChange, stored in the free-text
 * User.salaryExpectation. `single` only tweaks the placeholder ("rate" vs "range").
 */
export function SalaryPicker({ onChange, single = false }: { onChange: (composed: string) => void; single?: boolean }) {
  const [currency, setCurrency] = useState('USD');
  const [period, setPeriod] = useState<'mo' | 'yr'>('mo');
  const [bucketIdx, setBucketIdx] = useState(''); // index into the current period's buckets, '' = none

  const buckets = period === 'yr' ? YEARLY : MONTHLY;
  const sym = CURRENCIES.find(c => c.code === currency)?.sym || currency;

  useEffect(() => {
    if (bucketIdx === '') { onChange(''); return; }
    const b = buckets[Number(bucketIdx)];
    onChange(b ? `${bucketLabel(b, sym)}/${period}` : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, period, bucketIdx]);

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
      <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ ...selectStyle, width: 'auto', flex: '0 0 auto' }}>
        {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.sym} {c.code}</option>)}
      </select>
      <select value={bucketIdx} onChange={e => setBucketIdx(e.target.value)} style={{ ...selectStyle, flex: '1 1 130px', minWidth: '120px' }}>
        <option value="">{single ? 'Select rate…' : 'Select range…'}</option>
        {buckets.map((b, i) => <option key={i} value={String(i)}>{bucketLabel(b, sym)}</option>)}
      </select>
      <select value={period} onChange={e => { setPeriod(e.target.value as 'mo' | 'yr'); setBucketIdx(''); }} style={{ ...selectStyle, width: 'auto', flex: '0 0 auto' }}>
        <option value="mo">/mo</option>
        <option value="yr">/yr</option>
      </select>
    </div>
  );
}
