import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/postal';
import { checkPartnerSecret, sanitizeBrand } from '../_lib/partner';

type AlertRole = {
  title: string;
  url: string;          // role page (free recipients) or direct reply path (paid)
  company?: string;
  location?: string;
  cta?: string;         // button label, e.g. "Open & apply →" / "Reply to the poster →"
};

/**
 * POST /api/partner/alert — watcher-branded catch-alert email: the core product
 * mechanic (every fresh catch lands in the subscriber's inbox minutes after we
 * catch it). The watcher app decides per-recipient what each button points to
 * (role page for free users, direct mailto/post link for paying ones).
 * Body: { email, brand: {name, domain}, roles: AlertRole[], footer?: string, unsubscribeUrl?: string }
 */
export async function POST(request: NextRequest) {
  if (!checkPartnerSecret(request)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const body = await request.json();
    const email = String(body.email || '').toLowerCase().trim();
    const brand = sanitizeBrand(body.brand);
    const roles: AlertRole[] = Array.isArray(body.roles) ? body.roles.slice(0, 8) : [];
    const footer = typeof body.footer === 'string' ? body.footer.slice(0, 200) : '';
    const unsubscribeUrl = typeof body.unsubscribeUrl === 'string' ? body.unsubscribeUrl.slice(0, 300) : '';
    if (!email.includes('@') || !brand || roles.length === 0) {
      return NextResponse.json({ error: 'email, brand, roles required' }, { status: 400 });
    }

    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const subject = roles.length === 1
      ? `⚡ Caught: ${roles[0].title.slice(0, 70)}`
      : `⚡ ${roles.length} fresh catches on ${brand.name}`;

    const rows = roles.map((r) => `
      <div style="background:#fff;border:1px solid #D5DFEE;border-radius:11px;padding:14px 16px;margin-bottom:10px">
        <div style="font-size:15px;font-weight:600;color:#14202F">${esc(r.title)}</div>
        ${(r.company || r.location) ? `<div style="font-family:ui-monospace,monospace;font-size:12px;color:#8494AE;margin-top:3px">${esc([r.company, r.location].filter(Boolean).join(' · '))}</div>` : ''}
        <a href="${esc(r.url)}" style="display:inline-block;margin-top:10px;background:#14202F;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:9px 16px;border-radius:8px">${esc(r.cta || 'Open & apply →')}</a>
      </div>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#F4F7FC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#14202F">
  <div style="max-width:520px;margin:0 auto;padding:34px 20px">
    <div style="font-size:16px;font-weight:600;margin-bottom:4px">${brand.name}</div>
    <div style="font-family:ui-monospace,monospace;font-size:12px;color:#5D7191;margin-bottom:18px">fresh ${roles.length === 1 ? 'catch' : 'catches'} from LinkedIn hiring posts — not on the job boards yet</div>
    ${rows}
    <div style="font-family:ui-monospace,monospace;font-size:11.5px;color:#8494AE;margin-top:18px">
      ${footer ? esc(footer) + ' · ' : ''}<a href="https://${brand.domain}/roles" style="color:#8494AE">all catches</a>${unsubscribeUrl ? ` · <a href="${esc(unsubscribeUrl)}" style="color:#8494AE">pause alerts</a>` : ''}
    </div>
  </div>
</body></html>`;
    const text = roles.map((r) => `${r.title}${r.company ? ' — ' + r.company : ''}\n${r.url}`).join('\n\n') + (unsubscribeUrl ? `\n\nPause alerts: ${unsubscribeUrl}` : '');

    const sent = await sendEmail({ to: email, subject, html, text, fromName: brand.name, from: `alerts@${brand.domain}` });
    if (!sent.success) return NextResponse.json({ error: 'send_failed', message: sent.error }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'internal', message: e instanceof Error ? e.message : 'unknown' }, { status: 500 });
  }
}
