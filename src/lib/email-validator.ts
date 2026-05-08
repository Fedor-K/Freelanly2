import { promises as dns } from 'dns';

/**
 * Validate email format and check MX records for the domain.
 * Returns { valid, reason } — reason only set when invalid.
 */
export async function validateEmail(email: string): Promise<{ valid: boolean; reason?: string }> {
  // Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, reason: 'Invalid email format' };
  }

  const domain = email.split('@')[1];
  if (!domain) {
    return { valid: false, reason: 'Invalid email domain' };
  }

  // Check MX records
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return { valid: false, reason: 'Email domain does not accept emails' };
    }
    return { valid: true };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOTFOUND' || code === 'ENODATA') {
      return { valid: false, reason: 'Email domain does not exist' };
    }
    // DNS timeout or other transient error — allow through
    return { valid: true };
  }
}
