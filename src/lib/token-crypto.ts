import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// Encrypt OAuth refresh tokens at rest (AES-256-GCM). Google's OAuth 2.0 Policy requires tokens be
// stored encrypted, not plaintext — a verification/compliance blocker otherwise. The key is derived from
// AUTH_SECRET (already a strong app secret) so no new env var is required; if AUTH_SECRET rotates, old
// ciphertexts fail to decrypt and the affected users simply reconnect Gmail.
const KEY = createHash('sha256').update(process.env.AUTH_SECRET || 'dev-only-fallback-key').digest(); // 32 bytes
const PREFIX = 'enc:v1:';

/** Encrypt a token for storage. Output: `enc:v1:` + base64(iv | authTag | ciphertext). */
export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString('base64');
}

/** Decrypt a stored token. Legacy rows written before encryption (no prefix) are returned as-is so they
 *  keep working; they get encrypted on the user's next reconnect. */
export function decryptToken(stored: string): string {
  if (!stored || !stored.startsWith(PREFIX)) return stored;
  try {
    const raw = Buffer.from(stored.slice(PREFIX.length), 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ct = raw.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ct, undefined, 'utf8') + decipher.final('utf8');
  } catch {
    return ''; // undecryptable (e.g. AUTH_SECRET rotated) → treated as invalid → user reconnects
  }
}
