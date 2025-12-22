// Magic Link email sender using DashaMail

const DASHAMAIL_API_URL = 'https://api.dashamail.com';

interface DashaMailResponse {
  msg?: {
    err_code: number;
    text: string;
    type: string;
  };
  err_code?: number;
  text?: string;
  data?: {
    transaction_id?: string;
    [key: string]: unknown;
  };
}

async function apiCall(
  method: string,
  params: Record<string, unknown> = {}
): Promise<DashaMailResponse> {
  const formData = new FormData();
  formData.append('method', method);
  formData.append('api_key', process.env.DASHAMAIL_API_KEY || '');
  formData.append('format', 'json');

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      formData.append(
        key,
        typeof value === 'object' ? JSON.stringify(value) : String(value)
      );
    }
  }

  const response = await fetch(DASHAMAIL_API_URL, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  return data.response;
}

export async function sendMagicLinkEmail(
  email: string,
  url: string
): Promise<void> {
  const html = generateMagicLinkHtml(url);
  const text = generateMagicLinkText(url);

  try {
    const result = await apiCall('transactional.send', {
      to: email,
      from_email: process.env.DASHAMAIL_FROM_EMAIL || 'noreply@freelanly.com',
      from_name: 'Freelanly',
      subject: 'Sign in to Freelanly',
      message: html,
      plain_text: text,
    });

    // DashaMail returns { msg: { err_code: 0, text: 'OK' }, data: { transaction_id: '...' } }
    const errCode = result.msg?.err_code ?? result.err_code;
    if (errCode !== 0) {
      console.error('[Auth Email] Failed to send magic link:', result);
      throw new Error(`Failed to send email: ${JSON.stringify(result)}`);
    }

    console.log(`[Auth Email] Magic link sent to ${email}, transaction_id: ${result.data?.transaction_id}`);
  } catch (error) {
    console.error('[Auth Email] Error sending magic link:', error);
    throw error;
  }
}

function generateMagicLinkHtml(url: string): string {
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

    <p>Click the button below to sign in to your account. This link is valid for 24 hours.</p>

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

function generateMagicLinkText(url: string): string {
  return `
Sign in to Freelanly

Click the link below to sign in to your account:

${url}

This link is valid for 24 hours.

If you didn't request this, you can safely ignore this email.

---
Freelanly - Remote Jobs
https://freelanly.com
  `.trim();
}
