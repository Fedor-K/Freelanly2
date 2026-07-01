// Shared cookie-consent state + helpers. Single source of truth used by the
// CookieConsentBanner (writer) and any consent-gated component (readers, e.g.
// AnalyticsScripts). Client-only — every function guards on `typeof document`.

export const CONSENT_COOKIE_NAME = 'cookie_consent';
export const CONSENT_VERSION = 1;

// Fired on window whenever consent is saved, so gated components can react
// immediately (load/withhold trackers) WITHOUT a full page reload.
export const CONSENT_CHANGE_EVENT = 'consentchange';

export interface ConsentState {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
  version: number;
}

export function getConsentFromCookie(): ConsentState | null {
  if (typeof document === 'undefined') return null;

  const match = document.cookie.match(new RegExp(`${CONSENT_COOKIE_NAME}=([^;]+)`));
  if (match) {
    try {
      const parsed = JSON.parse(decodeURIComponent(match[1])) as ConsentState;
      // Treat an outdated (or missing) consent version as NO consent, so bumping
      // CONSENT_VERSION re-gates every tracker until the visitor re-consents. This
      // keeps this reader in lockstep with CookieConsentBanner, which re-shows the
      // banner on `version < CONSENT_VERSION` — otherwise trackers would load from
      // a stale cookie while the banner is still asking for consent.
      if (typeof parsed?.version !== 'number' || parsed.version < CONSENT_VERSION) return null;
      return parsed;
    } catch {
      return null;
    }
  }
  return null;
}

export function setConsentCookie(consent: ConsentState) {
  if (typeof document === 'undefined') return;

  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1); // 1 year
  document.cookie = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(consent))}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

/** Announce that consent changed so gated components re-read the cookie. */
export function emitConsentChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
}

/** Subscribe to consent changes. Returns an unsubscribe fn. */
export function onConsentChange(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CONSENT_CHANGE_EVENT, cb);
  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, cb);
}
