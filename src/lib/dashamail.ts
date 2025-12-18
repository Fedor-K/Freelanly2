// DashaMail API client for sending email applications
// Docs: https://dashamail.ru/api/

const DASHAMAIL_API_URL = 'https://api.dashamail.com';

interface DashaMailConfig {
  apiKey: string;
  fromEmail: string;
  listId: string;
}

const config: DashaMailConfig = {
  apiKey: process.env.DASHAMAIL_API_KEY || '',
  fromEmail: process.env.DASHAMAIL_FROM_EMAIL || 'info@freelanly.com',
  listId: process.env.DASHAMAIL_LIST_ID || '',
};

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64 encoded
    contentType: string;
  }>;
}

interface DashaMailResponse {
  status: 'success' | 'error';
  msg?: string;
  data?: any;
}

async function apiCall(method: string, params: Record<string, any> = {}): Promise<DashaMailResponse> {
  const formData = new FormData();
  formData.append('method', method);
  formData.append('api_key', config.apiKey);
  formData.append('format', 'json');

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
  }

  const response = await fetch(DASHAMAIL_API_URL, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  return data.response;
}

export async function sendApplicationEmail(params: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Using transactional email API
    const result = await apiCall('transactional.send', {
      to: params.to,
      from_email: config.fromEmail,
      from_name: 'Freelanly',
      subject: params.subject,
      html: params.html,
      text: params.text || params.html.replace(/<[^>]*>/g, ''),
      reply_to: params.replyTo,
      // attachments if needed
    });

    if (result.status === 'success') {
      return { success: true, messageId: result.data?.message_id };
    } else {
      return { success: false, error: result.msg };
    }
  } catch (error) {
    console.error('DashaMail send error:', error);
    return { success: false, error: String(error) };
  }
}

// Add subscriber to list (for newsletter)
export async function addSubscriber(email: string, name?: string): Promise<boolean> {
  try {
    const result = await apiCall('lists.add_member', {
      list_id: config.listId,
      email,
      merge: name ? { NAME: name } : undefined,
    });
    return result.status === 'success';
  } catch (error) {
    console.error('DashaMail subscribe error:', error);
    return false;
  }
}

// Generate application email HTML
export function generateApplicationEmailHtml(params: {
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  companyName: string;
  coverLetter: string;
  resumeUrl?: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
    .footer { border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px; font-size: 12px; color: #666; }
    h1 { font-size: 24px; margin: 0; }
    .meta { color: #666; font-size: 14px; }
    .cover-letter { white-space: pre-wrap; }
    .button { display: inline-block; background: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Application: ${params.jobTitle}</h1>
      <p class="meta">From: ${params.candidateName} (${params.candidateEmail})</p>
    </div>

    <div class="cover-letter">
${params.coverLetter}
    </div>

    ${params.resumeUrl ? `
    <p>
      <a href="${params.resumeUrl}" class="button">View Resume</a>
    </p>
    ` : ''}

    <div class="footer">
      <p>This application was sent via <a href="https://freelanly.com">Freelanly</a></p>
      <p>Reply directly to this email to contact the candidate.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export { config as dashamailConfig };
