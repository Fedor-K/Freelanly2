/**
 * @deprecated Use '@/lib/email' instead
 * This file re-exports from the new email abstraction for backward compatibility
 */

export {
  sendApplicationEmail,
  addSubscriber,
  getEmailMarketingStats,
  getTransactionalStats,
  testConnection as testDashaMailConnection,
  generateApplicationEmailHtml,
  type EmailCampaignStats,
  type SubscriberStats,
  type TransactionalStats,
} from './email';

// Re-export dashamail config for scripts that need direct access
export { dashamailConfig } from './email/dashamail';
