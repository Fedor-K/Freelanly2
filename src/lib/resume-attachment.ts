/**
 * Fetch a user's own Blob-stored résumé as a base64 PDF, ready to attach to an email.
 *
 * SSRF-safe: only ever fetches our own Vercel Blob store (some legacy resumeUrl values
 * are arbitrary external URLs), and only returns it if the bytes are a real PDF.
 * Returns null when there's no attachable résumé (caller sends without an attachment).
 */
const BLOB_HOST_SUFFIX = '.public.blob.vercel-storage.com';

export async function fetchResumeAttachment(
  resumeUrl: string | null | undefined,
  fileName: string | null | undefined
): Promise<{ base64: string; filename: string } | null> {
  if (!resumeUrl) return null;
  let host: string;
  try {
    host = new URL(resumeUrl).hostname;
  } catch {
    return null;
  }
  if (!host.endsWith(BLOB_HOST_SUFFIX)) return null;
  try {
    const resp = await fetch(resumeUrl);
    if (!resp.ok) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.subarray(0, 5).toString() !== '%PDF-') return null;
    return { base64: buf.toString('base64'), filename: fileName || 'resume.pdf' };
  } catch {
    return null;
  }
}
