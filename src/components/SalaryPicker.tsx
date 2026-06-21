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

const inputStyle: React.CSSProperties = {
  padding: '10px 10px', border: '1px solid #D5D1C8', borderRadius: '8px', fontSize: '13px',
  width: '100%', background: '#fff', color: '#0A0B0F', minWidth: 0,
};

/**
 * Structured desired-pay picker: currency + min–max range + period. Emits a single human-readable
 * string (e.g. "$2,000–3,000/mo") through onChange so it stores in the existing free-text
 * User.salaryExpectation. Manages its own sub-state; the parent just holds the composed string.
 */
export function SalaryPicker({ onChange, single = false }: { onChange: (composed: string) => void; single?: boolean }) {
  const [currency, setCurrency] = useState('USD');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [period, setPeriod] = useState<'mo' | 'yr'>('mo');

  useEffect(() => {
    const sym = CURRENCIES.find(c => c.code === currency)?.sym || currency;
    const fmt = (s: string) => { const n = s.replace(/[^\d]/g, ''); return n ? Number(n).toLocaleString('en-US') : ''; };
    const lo = fmt(min), hi = fmt(max);
    let composed = '';
    if (single) composed = lo ? `${sym}${lo}/${period}` : ''; // one amount → "$2,000/mo"
    else if (lo && hi) composed = `${sym}${lo}–${hi}/${period}`;
    else if (lo) composed = `${sym}${lo}+/${period}`;
    else if (hi) composed = `up to ${sym}${hi}/${period}`;
    onChange(composed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, min, max, period]);

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ ...inputStyle, width: 'auto', flex: '0 0 auto', cursor: 'pointer' }}>
        {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.sym} {c.code}</option>)}
      </select>
      <input type="text" inputMode="numeric" value={min} onChange={e => setMin(e.target.value)} placeholder={single ? 'amount' : 'from'} style={inputStyle} />
      {!single && <>
        <span style={{ color: '#8A8780', flex: '0 0 auto' }}>–</span>
        <input type="text" inputMode="numeric" value={max} onChange={e => setMax(e.target.value)} placeholder="to" style={inputStyle} />
      </>}
      <select value={period} onChange={e => setPeriod(e.target.value as 'mo' | 'yr')} style={{ ...inputStyle, width: 'auto', flex: '0 0 auto', cursor: 'pointer' }}>
        <option value="mo">/mo</option>
        <option value="yr">/yr</option>
      </select>
    </div>
  );
}
