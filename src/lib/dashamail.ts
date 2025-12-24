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
  msg?: {
    err_code: number;
    text: string;
    type: string;
  };
  err_code?: number;
  text?: string;
  data?: {
    transaction_id?: string;
    message_id?: string;
    [key: string]: unknown;
  };
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

  // Debug logging for API errors
  const errCode = data.response?.msg?.err_code ?? data.response?.err_code;
  if (errCode !== 0) {
    console.error('[DashaMail] API error response:', JSON.stringify(data, null, 2));
  }

  return data.response;
}

export async function sendApplicationEmail(params: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Using transactional email API
    // DashaMail requires 'message' for HTML and 'plain_text' for text (not 'html' and 'text')
    const result = await apiCall('transactional.send', {
      to: params.to,
      from_email: config.fromEmail,
      from_name: 'Freelanly',
      subject: params.subject,
      message: params.html,
      plain_text: params.text || params.html.replace(/<[^>]*>/g, ''),
      reply_to: params.replyTo,
    });

    // DashaMail returns { msg: { err_code: 0, text: 'OK' }, data: { transaction_id: '...' } } on success
    const errCode = result.msg?.err_code ?? result.err_code;
    if (errCode === 0) {
      return { success: true, messageId: result.data?.transaction_id || result.data?.message_id };
    } else {
      // Ensure error is a string for proper logging
      const errorMsg = result.msg?.text || result.text || (result.data ? JSON.stringify(result.data) : 'Unknown DashaMail error');
      return { success: false, error: errorMsg };
    }
  } catch (error) {
    console.error('DashaMail send error:', error);
    return { success: false, error: String(error) };
  }
}

// Add subscriber to list (for newsletter/job alerts)
export async function addSubscriber(
  email: string,
  mergeFields?: Record<string, string>
): Promise<boolean> {
  try {
    const result = await apiCall('lists.add_member', {
      list_id: config.listId,
      email,
      merge: mergeFields,
    });
    const errCode = result.msg?.err_code ?? result.err_code;
    return errCode === 0;
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

// ============================================
// STATISTICS API
// ============================================

export interface EmailCampaignStats {
  campaignId: string;
  name: string;
  sentAt: string;
  totalSent: number;
  delivered: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  bounced: number;
  openRate: number;
  clickRate: number;
}

export interface SubscriberStats {
  total: number;
  active: number;
  unsubscribed: number;
  bounced: number;
}

/**
 * Получает статистику по списку подписчиков
 */
export async function getSubscriberStats(): Promise<SubscriberStats | null> {
  try {
    const result = await apiCall('lists.get', {
      list_id: config.listId,
    });

    const errCode = result.msg?.err_code ?? result.err_code;
    if (errCode === 0 && result.data) {
      const data = result.data as Record<string, unknown>;
      return {
        total: Number(data.members_count) || 0,
        active: Number(data.members_active) || 0,
        unsubscribed: Number(data.members_unsubscribed) || 0,
        bounced: Number(data.members_bounced) || 0,
      };
    }
    return null;
  } catch (error) {
    console.error('DashaMail getSubscriberStats error:', error);
    return null;
  }
}

/**
 * Получает список кампаний
 */
export async function getCampaignsList(limit: number = 10): Promise<EmailCampaignStats[]> {
  try {
    const result = await apiCall('campaigns.get', {
      list_id: config.listId,
      limit,
    });

    const errCode = result.msg?.err_code ?? result.err_code;
    if (errCode === 0 && result.data?.data) {
      return result.data.data.map((campaign: Record<string, unknown>) => {
        const sent = Number(campaign.sent) || 0;
        const opened = Number(campaign.opened) || 0;
        const clicked = Number(campaign.clicked) || 0;

        return {
          campaignId: String(campaign.id),
          name: String(campaign.name || ''),
          sentAt: String(campaign.send_date || ''),
          totalSent: sent,
          delivered: Number(campaign.delivered) || sent,
          opened,
          clicked,
          unsubscribed: Number(campaign.unsubscribed) || 0,
          bounced: Number(campaign.bounced) || 0,
          openRate: sent > 0 ? (opened / sent) * 100 : 0,
          clickRate: sent > 0 ? (clicked / sent) * 100 : 0,
        };
      });
    }
    return [];
  } catch (error) {
    console.error('DashaMail getCampaignsList error:', error);
    return [];
  }
}

/**
 * Получает детальную статистику кампании
 */
export async function getCampaignStats(campaignId: string): Promise<EmailCampaignStats | null> {
  try {
    const result = await apiCall('reports.get', {
      campaign_id: campaignId,
    });

    const errCode = result.msg?.err_code ?? result.err_code;
    if (errCode === 0 && result.data) {
      const data = result.data as Record<string, unknown>;
      const sent = Number(data.sent) || 0;
      const opened = Number(data.unique_opened) || 0;
      const clicked = Number(data.unique_clicked) || 0;

      return {
        campaignId,
        name: String(data.name ?? ''),
        sentAt: String(data.send_date ?? ''),
        totalSent: sent,
        delivered: Number(data.delivered) || sent,
        opened,
        clicked,
        unsubscribed: Number(data.unsubscribed) || 0,
        bounced: Number(data.bounced) || 0,
        openRate: sent > 0 ? (opened / sent) * 100 : 0,
        clickRate: sent > 0 ? (clicked / sent) * 100 : 0,
      };
    }
    return null;
  } catch (error) {
    console.error('DashaMail getCampaignStats error:', error);
    return null;
  }
}

/**
 * Получает сводную статистику email маркетинга
 */
export async function getEmailMarketingStats(): Promise<{
  subscribers: SubscriberStats | null;
  lastCampaigns: EmailCampaignStats[];
  avgOpenRate: number;
  avgClickRate: number;
}> {
  const [subscribers, campaigns] = await Promise.all([
    getSubscriberStats(),
    getCampaignsList(5),
  ]);

  // Средние показатели
  let avgOpenRate = 0;
  let avgClickRate = 0;

  if (campaigns.length > 0) {
    avgOpenRate = campaigns.reduce((sum, c) => sum + c.openRate, 0) / campaigns.length;
    avgClickRate = campaigns.reduce((sum, c) => sum + c.clickRate, 0) / campaigns.length;
  }

  return {
    subscribers,
    lastCampaigns: campaigns,
    avgOpenRate,
    avgClickRate,
  };
}

/**
 * Проверяет подключение к API
 */
export async function testDashaMailConnection(): Promise<boolean> {
  try {
    if (!config.apiKey) return false;

    const result = await apiCall('lists.get', {});
    const errCode = result.msg?.err_code ?? result.err_code;
    return errCode === 0;
  } catch {
    return false;
  }
}

export { config as dashamailConfig };
