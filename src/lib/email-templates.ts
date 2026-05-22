/**
 * Branded email templates for Freelanly
 * Designed for 560px container, system fonts fallback, dark-mode safe.
 */

const BRAND = {
  bg: '#F7F6F1',
  card: '#FFFFFF',
  ink: '#0A0B0F',
  ink2: '#2F3138',
  ink3: '#5C6068',
  ink4: '#8A8E96',
  line: 'rgba(11,12,15,0.07)',
  line2: 'rgba(11,12,15,0.12)',
  bg2: '#F0EEE6',
  acid: '#C7F94A',
  acidDeep: '#4D8B0A',
  acidTint: 'rgba(199,249,74,0.18)',
  good: '#15803D',
  warn: '#B45309',
};

function emailShell(stamp: string, content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Freelanly</title></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:'Geist',-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;color:${BRAND.ink};-webkit-font-smoothing:antialiased;">
<div style="max-width:560px;margin:32px auto;background:${BRAND.card};border-radius:14px;overflow:hidden;box-shadow:0 1px 0 rgba(0,0,0,0.02),0 12px 32px -8px rgba(0,0,0,0.08);">
  <!-- Brand bar -->
  <div style="display:flex;align-items:center;gap:10px;padding:18px 28px;border-bottom:1px solid ${BRAND.line};">
    <div style="width:26px;height:26px;border-radius:7px;background:${BRAND.ink};color:${BRAND.acid};display:inline-block;text-align:center;line-height:26px;font-weight:700;font-size:13px;font-family:monospace;">F</div>
    <span style="font-size:14px;font-weight:500;">Freelanly</span>
    <span style="margin-left:auto;font-family:monospace;font-size:10.5px;color:${BRAND.ink4};letter-spacing:0.06em;text-transform:uppercase;">${stamp}</span>
  </div>
  <!-- Content -->
  <div style="padding:32px 32px 28px;">
    ${content}
  </div>
  <!-- Footer -->
  <div style="padding:22px 32px 28px;font-size:11.5px;font-family:monospace;color:${BRAND.ink4};letter-spacing:0.04em;line-height:1.65;background:${BRAND.bg2};border-top:1px solid ${BRAND.line};">
    <div>Freelanly · freelanly.com</div>
    <div style="margin-top:8px;font-size:10.5px;color:${BRAND.ink4};">© 2026 Freelanly · <a href="https://freelanly.com/unsubscribe" style="color:${BRAND.ink3};text-decoration:underline;">Unsubscribe</a></div>
  </div>
</div>
</body></html>`;
}

/**
 * OTP sign-in code email
 */
export function otpEmail(code: string, email: string): { subject: string; html: string; text: string } {
  const subject = `Your sign-in code: ${code.slice(0, 3)} ${code.slice(3)}`;
  const html = emailShell('Sign-in code', `
    <h1 style="font-size:24px;font-weight:500;letter-spacing:-0.022em;margin:0 0 14px;color:${BRAND.ink};">Your sign-in code</h1>
    <p style="margin:0 0 14px;color:${BRAND.ink2};line-height:1.6;">Use the code below to finish signing in to your Freelanly account. It expires in 10 minutes.</p>
    <div style="margin:24px 0 20px;padding:24px;background:${BRAND.bg2};border:1px solid ${BRAND.line};border-radius:12px;text-align:center;">
      <div style="font-family:monospace;font-size:44px;font-weight:500;letter-spacing:0.18em;color:${BRAND.ink};">${code.slice(0, 3)}&nbsp;${code.slice(3)}</div>
      <div style="margin-top:10px;font-family:monospace;font-size:11.5px;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.ink4};">Expires in <span style="color:${BRAND.warn};">10 minutes</span></div>
    </div>
    <div style="margin-top:22px;padding:14px 16px;background:${BRAND.bg};border:1px solid ${BRAND.line};border-radius:10px;display:flex;gap:12px;">
      <span style="font-size:12.5px;color:${BRAND.ink3};line-height:1.5;"><strong style="color:${BRAND.ink};">Didn't request this?</strong> Someone may have typed your email by mistake. Ignore this message — no one can sign in without the code.</span>
    </div>
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid ${BRAND.line};font-size:13px;color:${BRAND.ink3};">
      Requested for <strong style="font-family:monospace;font-size:12.5px;">${email}</strong>
    </div>
  `);
  const text = `Your Freelanly sign-in code: ${code}. Expires in 10 minutes. If you didn't request this, ignore this message.`;
  return { subject, html, text };
}

/**
 * "You got a reply!" notification email
 */
export function replyNotificationEmail(params: {
  userName: string;
  recruiterName: string;
  company: string;
  jobTitle: string;
  replyPreview: string;
  replySignal: string;
  category: string;
  sentAgo: string;
}): { subject: string; html: string; text: string } {
  const { userName, recruiterName, company, jobTitle, replyPreview, replySignal, category, sentAgo } = params;
  const firstName = userName?.split(' ')[0] || 'there';
  const initials = recruiterName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const categoryLabel = category === 'INTERVIEW' ? 'Wants to schedule a call'
    : category === 'REPLIED' ? 'Interested'
    : category === 'REJECTED' ? 'Not a fit'
    : 'Replied';
  const categoryColor = category === 'REJECTED' ? BRAND.warn : BRAND.acidDeep;

  const subject = `${recruiterName} at ${company} replied — ${categoryLabel.toLowerCase()}`;
  const html = emailShell('New reply', `
    <h1 style="font-size:24px;font-weight:500;letter-spacing:-0.022em;margin:0 0 14px;color:${BRAND.ink};">You got a reply, ${firstName}.</h1>
    <p style="margin:0 0 14px;color:${BRAND.ink3};font-size:13px;line-height:1.55;">${recruiterName} replied to your application ${sentAgo}.</p>
    <div style="margin:18px 0 22px;background:linear-gradient(180deg,${BRAND.acidTint},rgba(199,249,74,0.02));border:1px solid rgba(199,249,74,0.40);border-radius:12px;padding:20px 22px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
        <div style="width:38px;height:38px;border-radius:999px;background:linear-gradient(135deg,#FF6B6B,#FFB951);color:#FFF;text-align:center;line-height:38px;font-weight:600;font-size:13px;font-family:monospace;">${initials}</div>
        <div>
          <div style="font-size:14px;font-weight:500;">${recruiterName}</div>
          <div style="font-family:monospace;font-size:11.5px;color:${BRAND.ink3};">${company} · ${jobTitle}</div>
        </div>
        <div style="margin-left:auto;font-family:monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:${categoryColor};background:${BRAND.acidTint};border:1px solid rgba(199,249,74,0.4);padding:3px 7px;border-radius:999px;">${categoryLabel}</div>
      </div>
      ${replySignal ? `<div style="font-size:13px;color:${BRAND.ink2};padding-left:12px;border-left:3px solid ${BRAND.acid};margin:0;line-height:1.55;">${replySignal}</div>` : ''}
      ${replyPreview ? `<div style="margin-top:10px;font-size:13px;color:${BRAND.ink3};font-style:italic;">"${replyPreview.slice(0, 100)}${replyPreview.length > 100 ? '...' : ''}"</div>` : ''}
    </div>
    <div style="display:flex;gap:10px;">
      <a href="https://freelanly.com/dashboard/auto-apply?tab=inbox" style="display:inline-block;padding:12px 22px;background:${BRAND.acid};color:#000;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600;">Open in Freelanly →</a>
    </div>
    <p style="margin-top:22px;font-size:12.5px;color:${BRAND.ink3};">Reply quickly — early responses get 38% more bookings.</p>
  `);
  const text = `${recruiterName} at ${company} replied to your ${jobTitle} application: ${replySignal || replyPreview?.slice(0, 100)}. Open: https://freelanly.com/dashboard/auto-apply?tab=inbox`;
  return { subject, html, text };
}

/**
 * Reply teaser for FREE users (paywall)
 */
export function replyTeaserEmail(params: {
  userName: string;
  recruiterName: string;
  company: string;
  jobTitle: string;
  replySignal: string;
  category: string;
}): { subject: string; html: string; text: string } {
  const { userName, recruiterName, company, jobTitle, replySignal, category } = params;
  const firstName = userName?.split(' ')[0] || 'there';
  const categoryLabel = category === 'INTERVIEW' ? 'wants to schedule a call 🟢' : category === 'REPLIED' ? 'is interested 🟢' : 'replied';

  const subject = `🔔 ${recruiterName} at ${company} ${categoryLabel}!`;
  const html = emailShell('New reply', `
    <h1 style="font-size:24px;font-weight:500;margin:0 0 14px;">Great news, ${firstName}!</h1>
    <p style="color:${BRAND.ink2};line-height:1.6;">A recruiter from <strong>${company}</strong> responded to your <strong>${jobTitle}</strong> application.</p>
    ${replySignal ? `<p style="color:${BRAND.ink3};font-size:13px;margin-top:8px;">AI Signal: ${replySignal}</p>` : ''}
    <div style="background:${BRAND.bg2};border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
      <p style="color:${BRAND.ink4};font-size:14px;margin:0 0 8px;">Full reply is available for Pro members</p>
      <a href="https://freelanly.com/pricing" style="display:inline-block;padding:12px 24px;background:${BRAND.acid};color:#000;border-radius:8px;text-decoration:none;font-weight:600;">Read reply — Upgrade to Pro →</a>
    </div>
    <p style="color:${BRAND.ink4};font-size:13px;">Freelanly Pro: read all replies, auto follow-ups, unlimited applies — €15/mo</p>
  `);
  const text = `${recruiterName} at ${company} replied to your ${jobTitle} application! Upgrade to Pro to read: https://freelanly.com/pricing`;
  return { subject, html, text };
}

/**
 * Daily digest email
 */
export function dailyRecapEmail(params: {
  userName: string;
  sent: number;
  opened: number;
  replies: number;
  weekSent: number;
  weekReplies: number;
  replyRate: string;
  pendingReplies: Array<{ company: string; preview: string; replyUrl: string }>;
}): { subject: string; html: string; text: string } {
  const { userName, sent, opened, replies, weekSent, weekReplies, replyRate, pendingReplies } = params;
  const firstName = userName?.split(' ')[0] || 'there';
  const subject = replies > 0
    ? `${replies} recruiter${replies === 1 ? '' : 's'} replied today — Freelanly`
    : `${sent} applications sent today — Freelanly`;

  const pendingHtml = pendingReplies.length > 0 ? `
    <div style="margin:20px 0 0;">
      <div style="font-family:monospace;font-size:10.5px;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND.ink4};margin-bottom:10px;">⚡ Waiting for your reply</div>
      ${pendingReplies.map(r => `
        <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:10px;padding:12px 16px;margin-bottom:8px;">
          <div style="font-weight:500;font-size:13px;color:#065F46;margin-bottom:4px;">${r.company}</div>
          <div style="font-size:12.5px;color:#065F46;line-height:1.4;">${r.preview}</div>
          <a href="${r.replyUrl}" style="display:inline-block;margin-top:8px;padding:6px 14px;background:${BRAND.acid};color:#000;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;">Reply now →</a>
        </div>
      `).join('')}
    </div>` : '';

  const html = emailShell('Daily recap', `
    <h1 style="font-size:22px;font-weight:500;margin:0 0 6px;">Your daily recap 🚀</h1>
    <p style="color:${BRAND.ink3};font-size:13px;margin:0 0 20px;">Hey ${firstName}, here's what Freelanly did for you today.</p>
    <div style="background:${BRAND.bg2};border-radius:12px;padding:20px;margin:0 0 16px;">
      <table style="width:100%;text-align:center;"><tr>
        <td><div style="font-size:28px;font-weight:600;">${sent}</div><div style="font-size:12px;color:${BRAND.ink3};">Sent</div></td>
        <td><div style="font-size:28px;font-weight:600;">${opened}</div><div style="font-size:12px;color:${BRAND.ink3};">Opened</div></td>
        <td><div style="font-size:28px;font-weight:600;color:${BRAND.acidDeep};">${replies}</div><div style="font-size:12px;color:${BRAND.ink3};">Replies</div></td>
      </tr></table>
    </div>
    ${pendingHtml}
    <div style="margin-top:20px;padding:14px 16px;background:${BRAND.bg2};border-radius:10px;font-size:12.5px;color:${BRAND.ink3};line-height:1.5;">
      📊 This week: ${weekSent} sent · ${weekReplies} replies · ${replyRate}% reply rate<br/>
      Tomorrow we'll send more applications matching your profile.
    </div>
    <a href="https://freelanly.com/dashboard/inbox" style="display:inline-block;padding:12px 24px;background:${BRAND.acid};color:#000;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px;">Open Dashboard →</a>
    <div style="margin-top:24px;padding:14px 16px;background:#E0F2FE;border:1px solid #BAE6FD;border-radius:10px;text-align:center;">
      <div style="font-size:13px;color:#0369A1;line-height:1.5;">📱 Get instant notifications when recruiters reply</div>
      <a href="https://t.me/FLalarmbot" style="display:inline-block;margin-top:8px;padding:8px 18px;background:#0088cc;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">Connect Telegram →</a>
    </div>
  `);
  const text = `Hey ${firstName}, today: ${sent} sent, ${opened} opened, ${replies} replies. ${pendingReplies.length > 0 ? pendingReplies.length + ' recruiter(s) waiting for your reply!' : ''} This week: ${weekSent} sent, ${weekReplies} replies (${replyRate}%). Dashboard: https://freelanly.com/dashboard/inbox`;
  return { subject, html, text };
}

/**
 * Weekly report email
 */
export function weeklyReportEmail(params: {
  userName: string;
  sent: number;
  replies: number;
  replyRate: string;
}): { subject: string; html: string; text: string } {
  const { userName, sent, replies, replyRate } = params;
  const firstName = userName?.split(' ')[0] || 'there';
  const subject = `📈 Weekly: ${sent} sent, ${replies} replies (${replyRate}%) — Freelanly`;
  const html = emailShell('Weekly report', `
    <h1 style="font-size:24px;font-weight:500;margin:0 0 16px;">Good week, ${firstName}.</h1>
    <p style="color:${BRAND.ink3};font-size:13px;">Sequences ran for 7 days. Here's what landed.</p>
    <div style="background:${BRAND.ink};color:#FAFAF7;border-radius:12px;padding:22px 24px;margin:18px 0;">
      <table style="width:100%;text-align:center;"><tr>
        <td><div style="font-size:28px;font-weight:500;">${sent}</div><div style="font-family:monospace;font-size:10px;color:rgba(250,250,247,0.6);text-transform:uppercase;">Sent</div></td>
        <td><div style="font-size:28px;font-weight:500;color:${BRAND.acid};">${replies}</div><div style="font-family:monospace;font-size:10px;color:rgba(250,250,247,0.6);text-transform:uppercase;">Replies</div></td>
        <td><div style="font-size:28px;font-weight:500;">${replyRate}%</div><div style="font-family:monospace;font-size:10px;color:rgba(250,250,247,0.6);text-transform:uppercase;">Reply rate</div></td>
      </tr></table>
    </div>
    <a href="https://freelanly.com/dashboard/auto-apply?tab=analytics" style="display:inline-block;padding:12px 24px;background:${BRAND.ink};color:#FFF;border-radius:10px;text-decoration:none;font-weight:500;margin-top:12px;">View Analytics →</a>
  `);
  const text = `Weekly: ${sent} sent, ${replies} replies, ${replyRate}% reply rate.`;
  return { subject, html, text };
}

/**
 * Welcome email (sent on signup)
 */
export function welcomeEmail(userName: string): { subject: string; html: string; text: string } {
  const firstName = userName?.split(' ')[0] || 'there';
  const subject = `Welcome to Freelanly — your first drafts are ready`;
  const html = emailShell('Welcome', `
    <div style="margin:-32px -32px 24px;padding:36px 32px 28px;background:linear-gradient(180deg,${BRAND.bg2},${BRAND.card});border-bottom:1px solid ${BRAND.line};">
      <div style="font-family:monospace;font-size:10.5px;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND.acidDeep};margin-bottom:16px;">● Day 1</div>
      <h1 style="font-size:30px;letter-spacing:-0.028em;line-height:1.05;margin:0 0 8px;">Welcome aboard, ${firstName}.</h1>
      <p style="font-size:14px;color:${BRAND.ink3};margin:0;">Your first applications are queued. Approve them and we'll start sending.</p>
    </div>
    <p style="color:${BRAND.ink2};line-height:1.6;">Three things to do in the next 5 minutes:</p>
    <div style="margin:18px 0 22px;">
      <div style="display:flex;gap:14px;padding:14px 16px;border:1px solid ${BRAND.line};border-radius:10px;margin-bottom:10px;">
        <div style="width:26px;height:26px;border-radius:999px;background:${BRAND.ink};color:${BRAND.acid};text-align:center;line-height:26px;font-family:monospace;font-size:12px;font-weight:600;flex-shrink:0;">1</div>
        <div><div style="font-size:13.5px;font-weight:500;">Upload your CV or LinkedIn URL</div><div style="font-size:12.5px;color:${BRAND.ink3};">We rewrite drafts in your voice — your projects, your numbers, your tone.</div></div>
      </div>
      <div style="display:flex;gap:14px;padding:14px 16px;border:1px solid ${BRAND.line};border-radius:10px;margin-bottom:10px;">
        <div style="width:26px;height:26px;border-radius:999px;background:${BRAND.ink};color:${BRAND.acid};text-align:center;line-height:26px;font-family:monospace;font-size:12px;font-weight:600;flex-shrink:0;">2</div>
        <div><div style="font-size:13.5px;font-weight:500;">Pick your categories</div><div style="font-size:12.5px;color:${BRAND.ink3};">Tell us what work you want. We won't apply outside those rails.</div></div>
      </div>
      <div style="display:flex;gap:14px;padding:14px 16px;border:1px solid ${BRAND.line};border-radius:10px;">
        <div style="width:26px;height:26px;border-radius:999px;background:${BRAND.ink};color:${BRAND.acid};text-align:center;line-height:26px;font-family:monospace;font-size:12px;font-weight:600;flex-shrink:0;">3</div>
        <div><div style="font-size:13.5px;font-weight:500;">Review your drafts & launch</div><div style="font-size:12.5px;color:${BRAND.ink3};">You read each one before it leaves. After 25 approvals, autopilot unlocks.</div></div>
      </div>
    </div>
    <a href="https://freelanly.com/dashboard/auto-apply" style="display:inline-block;padding:12px 22px;background:${BRAND.acid};color:#000;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600;">Open my drafts →</a>
    <div style="display:flex;gap:0;margin:18px 0 0;background:${BRAND.ink};border-radius:10px;overflow:hidden;color:#FAFAF7;">
      <div style="padding:16px 18px;flex:1;"><div style="font-size:22px;font-weight:500;"><span style="color:${BRAND.acid};">4.8%</span> reply rate</div><div style="font-family:monospace;font-size:10.5px;color:rgba(250,250,247,0.6);text-transform:uppercase;margin-top:2px;">Median user</div></div>
      <div style="padding:16px 18px;flex:1;border-left:1px solid rgba(255,255,255,0.08);"><div style="font-size:22px;font-weight:500;"><span style="color:${BRAND.acid};">~18h</span> to first reply</div><div style="font-family:monospace;font-size:10.5px;color:rgba(250,250,247,0.6);text-transform:uppercase;margin-top:2px;">From signup</div></div>
    </div>
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid ${BRAND.line};font-size:13px;color:${BRAND.ink3};">
      Reply to this email if anything's off — it goes to a real inbox.<br>— <strong style="color:${BRAND.ink};">Freelanly Team</strong>
    </div>
  `);
  const text = `Welcome to Freelanly, ${firstName}! Upload your CV, pick categories, review drafts. Open: https://freelanly.com/dashboard/auto-apply`;
  return { subject, html, text };
}
