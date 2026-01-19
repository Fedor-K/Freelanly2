/**
 * Send critical alerts to Telegram
 * Used for monitoring payment failures, API errors, etc.
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_ALERT_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_ALERT_CHAT_ID;

interface AlertOptions {
  title: string;
  message: string;
  error?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export async function sendTelegramAlert(options: AlertOptions): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('[TelegramAlert] Bot token or chat ID not configured');
    return false;
  }

  const { title, message, error, metadata } = options;

  // Format message
  let text = `🚨 *${escapeMarkdown(title)}*\n\n${escapeMarkdown(message)}`;

  if (error) {
    text += `\n\n❌ Error:\n\`${escapeMarkdown(error.slice(0, 500))}\``;
  }

  if (metadata && Object.keys(metadata).length > 0) {
    text += '\n\n📋 Details:';
    for (const [key, value] of Object.entries(metadata)) {
      if (value !== undefined && value !== null) {
        text += `\n• ${escapeMarkdown(key)}: \`${escapeMarkdown(String(value))}\``;
      }
    }
  }

  text += `\n\n🕐 ${new Date().toISOString()}`;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text,
          parse_mode: 'MarkdownV2',
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[TelegramAlert] Failed to send:', errorData);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[TelegramAlert] Error sending alert:', err);
    return false;
  }
}

// Escape special characters for Telegram MarkdownV2
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

// Convenience functions for common alerts
export async function alertCheckoutError(error: string, userEmail?: string) {
  return sendTelegramAlert({
    title: 'Stripe Checkout Failed',
    message: 'User could not complete checkout',
    error,
    metadata: {
      userEmail: userEmail || 'unknown',
      endpoint: '/api/stripe/checkout',
    },
  });
}

export async function alertWebhookError(event: string, error: string) {
  return sendTelegramAlert({
    title: 'Stripe Webhook Error',
    message: `Failed to process webhook event: ${event}`,
    error,
    metadata: {
      event,
      endpoint: '/api/stripe/webhook',
    },
  });
}

export async function alertCriticalError(endpoint: string, error: string, metadata?: Record<string, string>) {
  return sendTelegramAlert({
    title: 'Critical API Error',
    message: `Server error on ${endpoint}`,
    error,
    metadata: {
      endpoint,
      ...metadata,
    },
  });
}
