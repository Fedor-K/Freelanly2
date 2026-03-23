/**
 * PayPro Global integration config and helpers
 */

import { createHash } from 'crypto';

// PayPro credentials
export const PAYPRO_CONFIG = {
  vendorAccountId: 171610,
  secretKey: process.env.PAYPRO_SECRET_KEY || 'sMuqVcckLz',
  validationKey: process.env.PAYPRO_VALIDATION_KEY || 'v79nsiatA45DvjRzx415-0KYg190nb',
  storeUrl: 'https://store.payproglobal.com/checkout',
};

// Product IDs from PayPro panel
export const PAYPRO_PRODUCTS = {
  monthly: process.env.PAYPRO_PRODUCT_MONTHLY || '129483',
  quarterly: process.env.PAYPRO_PRODUCT_QUARTERLY || '129484',
  annual: process.env.PAYPRO_PRODUCT_ANNUAL || '129485',
  singleContact: '129688',
} as const;

export type PayProPriceKey = keyof typeof PAYPRO_PRODUCTS;

// IPN Event Types
export const IPN_TYPES = {
  OrderCharged: 1,
  OrderRefunded: 2,
  OrderChargedBack: 3,
  OrderDeclined: 4,
  OrderPartiallyRefunded: 5,
  SubscriptionChargeSucceed: 6,
  SubscriptionChargeFailed: 7,
  SubscriptionSuspended: 8,
  SubscriptionRenewed: 9,
  SubscriptionTerminated: 10,
  SubscriptionFinished: 11,
  TrialCharge: 13,
  SubscriptionPaymentInfoChanged: 21,
} as const;

// PayPro IP whitelist for webhook verification
export const PAYPRO_IPS = [
  '198.199.123.239',
  '157.230.8.40',
];

/**
 * Verify webhook HASH: MD5(OrderID + SecretKey)
 * For test orders: MD5("1")
 */
export function verifyHash(orderId: string, hash: string, testMode: boolean): boolean {
  if (testMode) {
    const expected = createHash('md5').update('1').digest('hex');
    return hash.toLowerCase() === expected.toLowerCase();
  }
  const expected = createHash('md5')
    .update(orderId + PAYPRO_CONFIG.secretKey)
    .digest('hex');
  return hash.toLowerCase() === expected.toLowerCase();
}

/**
 * Verify webhook SIGNATURE: SHA256(ORDER_ID + ORDER_STATUS + ORDER_TOTAL_AMOUNT + CUSTOMER_EMAIL + VALIDATION_KEY + TEST_MODE + IPN_TYPE_NAME)
 */
export function verifySignature(params: {
  orderId: string;
  orderStatus: string;
  totalAmount: string;
  customerEmail: string;
  testMode: string;
  ipnTypeName: string;
  signature: string;
}): boolean {
  const data = params.orderId + params.orderStatus + params.totalAmount +
    params.customerEmail + PAYPRO_CONFIG.validationKey + params.testMode + params.ipnTypeName;
  const expected = createHash('sha256').update(data).digest('hex');
  return params.signature.toLowerCase() === expected.toLowerCase();
}

/**
 * Build PayPro checkout URL
 */
export function buildCheckoutUrl(params: {
  productId: string;
  userId: string;
  email: string;
  currency?: string;
  testMode?: boolean;
  itemId?: string;
  itemType?: string;
}): string {
  const url = new URL(PAYPRO_CONFIG.storeUrl);
  url.searchParams.set('products[1][id]', params.productId);
  url.searchParams.set('billing-email', params.email);
  url.searchParams.set('currency', params.currency || 'EUR');
  url.searchParams.set('x-userId', params.userId);
  if (params.itemId) url.searchParams.set('x-itemId', params.itemId);
  if (params.itemType) url.searchParams.set('x-itemType', params.itemType);
  url.searchParams.set('thank-you-url', 'https://freelanly.com/dashboard?payment=success&provider=paypro');

  if (params.testMode) {
    url.searchParams.set('use-test-mode', 'true');
    url.searchParams.set('secret-key', PAYPRO_CONFIG.secretKey);
  }

  return url.toString();
}
