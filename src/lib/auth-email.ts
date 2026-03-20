// Magic Link + OTP code email sender

import { sendApplicationEmail } from '@/lib/email';
import { prisma } from '@/lib/db';
import { randomInt } from 'crypto';

/**
 * Generate a 6-digit OTP code
 */
function generateOTPCode(): string {
  return randomInt(100000, 999999).toString();
}

export async function sendMagicLinkEmail(
  email: string,
  url: string
): Promise<void> {
  // Generate OTP code
  const code = generateOTPCode();

  // Store code in the VerificationToken that NextAuth just created
  // NextAuth creates the token before calling sendVerificationRequest,
  // so we update the most recent token for this email with the code
  try {
    const token = await prisma.verificationToken.findFirst({
      where: {
        identifier: email.toLowerCase(),
        expires: { gt: new Date() },
      },
      orderBy: { expires: 'desc' },
    });

    if (token) {
      await prisma.verificationToken.update({
        where: {
          identifier_token: {
            identifier: token.identifier,
            token: token.token,
          },
        },
        data: { code },
      });
      console.log(`[Auth Email] OTP code stored for ${email}`);
    } else {
      console.warn(`[Auth Email] No verification token found for ${email}`);
    }
  } catch (e) {
    console.error('[Auth Email] Failed to store OTP code:', e);
    // Continue — magic link still works even without code
  }

  const html = generateMagicLinkHtml(url, code);
  const text = generateMagicLinkText(url, code);

  try {
    const result = await sendApplicationEmail({
      to: email,
      subject: `${code} — your Freelanly sign-in code`,
      html,
      text,
    });

    if (!result.success) {
      console.error('[Auth Email] Failed to send magic link:', result.error);
      throw new Error(`Failed to send email: ${result.error}`);
    }

    console.log(`[Auth Email] Magic link + code sent to ${email}, messageId: ${result.messageId}`);
  } catch (error) {
    console.error('[Auth Email] Error sending magic link:', error);
    throw error;
  }
}

function generateMagicLinkHtml(url: string, code: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      background-color: #f5f5f5;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 480px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
    .logo {
      font-size: 24px;
      font-weight: 700;
      color: #000;
      margin-bottom: 32px;
    }
    h1 {
      font-size: 20px;
      font-weight: 600;
      margin: 0 0 16px 0;
    }
    p {
      color: #4a4a4a;
      margin: 0 0 24px 0;
    }
    .code-box {
      text-align: center;
      margin: 24px 0;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
      border: 1px solid #e9ecef;
    }
    .code {
      font-size: 32px;
      font-weight: 700;
      letter-spacing: 6px;
      color: #000;
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
    }
    .code-label {
      font-size: 13px;
      color: #888;
      margin-top: 8px;
    }
    .divider {
      text-align: center;
      margin: 24px 0;
      color: #888;
      font-size: 13px;
    }
    .button {
      display: inline-block;
      background: #000;
      color: #fff !important;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
    }
    .button:hover {
      background: #333;
    }
    .footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #eee;
      font-size: 13px;
      color: #888;
    }
    .link {
      color: #888;
      word-break: break-all;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Freelanly</div>

    <h1>Sign in to your account</h1>

    <p>Enter this code on the sign-in page:</p>

    <div class="code-box">
      <div class="code">${code}</div>
      <div class="code-label">This code expires in 24 hours</div>
    </div>

    <div class="divider">— or click the button below —</div>

    <a href="${url}" class="button">Sign in to Freelanly</a>

    <div class="footer">
      <p>If the button doesn't work, copy this link to your browser:</p>
      <p class="link">${url}</p>
      <p style="margin-top: 16px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function generateMagicLinkText(url: string, code: string): string {
  return `
Sign in to Freelanly

Your sign-in code: ${code}

Enter this code on the sign-in page, or click the link below:

${url}

This code is valid for 24 hours.

If you didn't request this, you can safely ignore this email.

---
Freelanly - Remote Jobs
https://freelanly.com
  `.trim();
}
