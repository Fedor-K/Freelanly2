import { NextRequest, NextResponse } from 'next/server';
import { checkAdminSession } from '@/lib/admin-auth';
import { sendApplicationEmail } from '@/lib/email';
import { getUnlockPriceLabel } from '@/lib/geo-pricing';

/**
 * POST /api/admin/test-email
 * Send a test job alert email with geo-priced Apply button.
 * Body: { to: string, country?: string }
 */
export async function POST(req: NextRequest) {
  const authError = await checkAdminSession(req);
  if (authError) return authError;

  const { to, country } = await req.json();
  if (!to) return NextResponse.json({ error: 'to required' }, { status: 400 });

  const price = getUnlockPriceLabel(country || 'RU');
  const APP_URL = 'https://freelanly.com';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f9fafb;">
<tr><td align="center" style="padding:40px 20px;">
<table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
<tr><td style="padding:30px;text-align:center;border-bottom:1px solid #eee;">
  <h1 style="margin:0;font-size:24px;color:#000;">🎯 New Freelance Projects for You</h1>
  <p style="margin:10px 0 0;color:#666;font-size:14px;">3 new Translation projects matching your alert</p>
</td></tr>

<tr><td style="padding:20px;border-bottom:1px solid #eee;">
  <a href="${APP_URL}/freelance" style="color:#000;text-decoration:none;font-weight:600;font-size:16px;">English to Spanish Medical Translator</a>
  <div style="color:#666;font-size:14px;margin-top:4px;">Remote · United States</div>
  <div style="color:#555;font-size:13px;margin-top:6px;line-height:1.4;">We are looking for an experienced medical translator for ongoing pharmaceutical documentation. Must have certification in medical translation...</div>
  <div style="margin-top:10px;">
    <a href="${APP_URL}/freelance" style="display:inline-block;background:#000;color:#fff;padding:8px 16px;text-decoration:none;border-radius:6px;font-size:14px;">View Project</a>
    <a href="${APP_URL}/freelance" style="display:inline-block;background:#16a34a;color:#fff;padding:8px 16px;text-decoration:none;border-radius:6px;font-size:14px;margin-left:8px;">🔓 Apply for ${price}</a>
  </div>
</td></tr>

<tr><td style="padding:20px;border-bottom:1px solid #eee;">
  <a href="${APP_URL}/freelance" style="color:#000;text-decoration:none;font-weight:600;font-size:16px;">Website Localization — German/French</a>
  <div style="color:#666;font-size:14px;margin-top:4px;">Remote · Germany</div>
  <div style="color:#555;font-size:13px;margin-top:6px;line-height:1.4;">Seeking native German and French translators for e-commerce website localization. 50,000 words, deadline 3 weeks...</div>
  <div style="margin-top:10px;">
    <a href="${APP_URL}/freelance" style="display:inline-block;background:#000;color:#fff;padding:8px 16px;text-decoration:none;border-radius:6px;font-size:14px;">View Project</a>
    <a href="${APP_URL}/freelance" style="display:inline-block;background:#16a34a;color:#fff;padding:8px 16px;text-decoration:none;border-radius:6px;font-size:14px;margin-left:8px;">🔓 Apply for ${price}</a>
  </div>
</td></tr>

<tr><td style="padding:20px;border-bottom:1px solid #eee;">
  <a href="${APP_URL}/freelance" style="color:#000;text-decoration:none;font-weight:600;font-size:16px;">Subtitling — Korean Drama Series</a>
  <div style="color:#666;font-size:14px;margin-top:4px;">Remote</div>
  <div style="color:#555;font-size:13px;margin-top:6px;line-height:1.4;">Professional subtitler needed for Korean to English subtitling of a 16-episode drama series. Experience with entertainment content required...</div>
  <div style="margin-top:10px;">
    <a href="${APP_URL}/freelance" style="display:inline-block;background:#000;color:#fff;padding:8px 16px;text-decoration:none;border-radius:6px;font-size:14px;">View Project</a>
    <a href="${APP_URL}/freelance" style="display:inline-block;background:#16a34a;color:#fff;padding:8px 16px;text-decoration:none;border-radius:6px;font-size:14px;margin-left:8px;">🔓 Apply for ${price}</a>
  </div>
</td></tr>

<tr><td style="padding:20px;text-align:center;background:linear-gradient(180deg,#fff 0%,#f0f9ff 100%);">
  <p style="font-size:16px;font-weight:600;color:#1e40af;margin:0 0 8px;">+5 more — unlock contacts from ${price} each</p>
  <p style="color:#666;font-size:14px;margin:0 0 16px;">You found the projects. Get direct contacts to apply first.</p>
  <a href="${APP_URL}/pricing?source=email_alert_upsell" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Unlock Contact Details from ${price} →</a>
</td></tr>

<tr><td style="padding:20px 30px;background:#f9fafb;border-radius:0 0 12px 12px;text-align:center;">
  <p style="margin:0;color:#666;font-size:12px;">You're receiving this because you set up a job alert on Freelanly.</p>
  <p style="margin:10px 0 0;">
    <a href="#" style="color:#666;font-size:12px;">Unsubscribe</a> · <a href="${APP_URL}/dashboard/alerts" style="color:#666;font-size:12px;">Manage alerts</a>
  </p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  const result = await sendApplicationEmail({
    to,
    subject: '🎯 3 new freelance projects for you — TEST',
    html,
    text: 'Test email with geo-priced Apply button',
  });

  return NextResponse.json({ success: result.success, price, country: country || 'RU' });
}
