/**
 * Country-based pricing for single contact unlock.
 * A/B test: lower prices for lower GDP countries.
 */

// Low GDP — €1 (100 cents)
const LOW_GDP_COUNTRIES = new Set([
  'IN', 'PK', 'BD', 'LK', 'NP', 'MM', 'KH', 'LA', 'VN',
  'PH', 'ID', 'NG', 'KE', 'GH', 'TZ', 'UG', 'ET', 'EG',
  'MA', 'TN', 'DZ', 'UA', 'UZ', 'KG', 'TJ',
]);

// Mid GDP — €2 (200 cents)
const MID_GDP_COUNTRIES = new Set([
  'BR', 'MX', 'AR', 'CO', 'CL', 'PE', 'EC', 'CR',
  'TR', 'ZA', 'TH', 'MY', 'CN', 'RU', 'BY', 'KZ',
  'RO', 'BG', 'RS', 'HR', 'HU', 'PL', 'CZ', 'SK',
  'GR', 'PT',
]);

export function getPriceCents(countryCode: string | null): number {
  if (!countryCode) return 300;
  const cc = countryCode.toUpperCase();
  if (LOW_GDP_COUNTRIES.has(cc)) return 100;
  if (MID_GDP_COUNTRIES.has(cc)) return 200;
  return 300;
}

export function formatPrice(cents: number): string {
  return `€${(cents / 100).toFixed(0)}`;
}

export function getUnlockPriceLabel(countryCode: string | null): string {
  return formatPrice(getPriceCents(countryCode));
}
