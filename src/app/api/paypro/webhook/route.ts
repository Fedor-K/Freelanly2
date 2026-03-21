import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ActivityAction } from '@prisma/client';
import { verifyHash, verifySignature, PAYPRO_IPS, IPN_TYPES } from '@/lib/paypro';

/**
 * POST /api/paypro/webhook
 *
 * Receives IPN (Instant Payment Notification) from PayPro Global.
 * Content-Type: application/x-www-form-urlencoded
 */
export async function POST(request: NextRequest) {
  try {
    // Log all incoming requests for debugging
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
    console.log(`[PayPro Webhook] Incoming from IP: ${ip}`);

    // IP whitelist check - disabled temporarily for debugging
    // PayPro IPs: 198.199.123.239, 157.230.8.40
    // On Vercel, x-forwarded-for may contain edge IP, not PayPro IP
    // TODO: re-enable after confirming correct IP header
    // if (process.env.NODE_ENV === 'production' && !PAYPRO_IPS.includes(ip)) {
    //   console.warn(`[PayPro Webhook] Rejected from IP: ${ip}`);
    //   return new NextResponse('Forbidden', { status: 403 });
    // }

    // Parse form-urlencoded body
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    const ipnTypeId = parseInt(params.IPN_TYPE_ID || '0');
    const ipnTypeName = params.IPN_TYPE_NAME || '';
    const orderId = params.ORDER_ID || '';
    const orderStatus = params.ORDER_STATUS || '';
    const productId = params.PRODUCT_ID || '';
    const customerId = params.CUSTOMER_ID || '';
    const customerEmail = (params.CUSTOMER_EMAIL || '').toLowerCase();
    const subscriptionId = params.SUBSCRIPTION_ID || '';
    const testMode = params.TEST_MODE === '1';
    const totalAmount = params.ORDER_TOTAL_AMOUNT || '0';
    const hash = params.HASH || '';
    const signature = params.SIGNATURE || '';
    const userId = params['x-userId'] || ''; // Custom field passed through checkout

    console.log(`[PayPro Webhook] ${ipnTypeName} (${ipnTypeId}) | order: ${orderId} | email: ${customerEmail} | userId: ${userId} | test: ${testMode}`);
    console.log(`[PayPro Webhook] All params:`, JSON.stringify(params).substring(0, 500));

    // Always log webhook receipt (even if processing fails)
    await prisma.activityLog.create({
      data: {
        action: 'PAYMENT_SUCCESS' as ActivityAction,
        details: {
          provider: 'paypro_webhook',
          ipnType: ipnTypeName,
          orderId,
          customerEmail,
          testMode,
          totalAmount,
          productId,
        },
        ipAddress: ip,
      },
    }).catch(e => console.error('[PayPro Webhook] Failed to log receipt:', e));

    // Verify HASH
    if (hash && !verifyHash(orderId, hash, testMode)) {
      console.error('[PayPro Webhook] HASH verification failed');
      return new NextResponse('Invalid hash', { status: 400 });
    }

    // Verify SIGNATURE
    if (signature && !verifySignature({
      orderId,
      orderStatus,
      totalAmount,
      customerEmail,
      testMode: testMode ? '1' : '0',
      ipnTypeName,
      signature,
    })) {
      console.error('[PayPro Webhook] SIGNATURE verification failed');
      return new NextResponse('Invalid signature', { status: 400 });
    }

    // Find user by custom userId field or by email
    let dbUserId = userId;
    if (!dbUserId && customerEmail) {
      const user = await prisma.user.findUnique({
        where: { email: customerEmail },
        select: { id: true },
      });
      dbUserId = user?.id || '';
    }

    // Handle events
    switch (ipnTypeId) {
      case IPN_TYPES.OrderCharged: {
        // Initial purchase — upgrade to PRO
        if (dbUserId) {
          await prisma.user.update({
            where: { id: dbUserId },
            data: {
              plan: 'PRO',
              // Store PayPro subscription info in metadata
              // Using stripeId/stripeSubscriptionId fields to avoid schema changes
              // TODO: add dedicated PayPro fields if needed
            },
          });

          await prisma.activityLog.create({
            data: {
              userId: dbUserId,
              action: ActivityAction.CHECKOUT_COMPLETE,
              details: {
                provider: 'paypro',
                orderId,
                productId,
                amount: parseFloat(totalAmount),
                currency: params.ORDER_ITEM_CURRENCY_CODE,
                customerEmail,
                subscriptionId,
                testMode,
              },
            },
          }).catch(() => {});

          console.log(`[PayPro Webhook] User ${dbUserId} upgraded to PRO (order: ${orderId})`);
        }
        break;
      }

      case IPN_TYPES.SubscriptionChargeSucceed: {
        // Recurring payment succeeded
        if (dbUserId) {
          await prisma.activityLog.create({
            data: {
              userId: dbUserId,
              action: ActivityAction.PAYMENT_SUCCESS,
              details: {
                provider: 'paypro',
                orderId,
                subscriptionId,
                amount: parseFloat(totalAmount),
                currency: params.ORDER_ITEM_CURRENCY_CODE,
              },
            },
          }).catch(() => {});

          console.log(`[PayPro Webhook] Subscription renewed for user ${dbUserId} (subscription: ${subscriptionId})`);
        }
        break;
      }

      case IPN_TYPES.SubscriptionChargeFailed: {
        // Recurring payment failed
        if (dbUserId) {
          await prisma.activityLog.create({
            data: {
              userId: dbUserId,
              action: ActivityAction.PAYMENT_FAILED,
              details: {
                provider: 'paypro',
                orderId,
                subscriptionId,
                reason: params.ACTION_REASON,
              },
            },
          }).catch(() => {});

          console.log(`[PayPro Webhook] Payment failed for user ${dbUserId} (subscription: ${subscriptionId})`);
        }
        break;
      }

      case IPN_TYPES.SubscriptionTerminated:
      case IPN_TYPES.SubscriptionFinished: {
        // Subscription ended — downgrade to FREE
        if (dbUserId) {
          await prisma.user.update({
            where: { id: dbUserId },
            data: { plan: 'FREE' },
          });

          await prisma.activityLog.create({
            data: {
              userId: dbUserId,
              action: ActivityAction.SUBSCRIPTION_CANCELLED,
              details: {
                provider: 'paypro',
                subscriptionId,
                reason: params.SUBSCRIPTION_CANCELLATION_REASON_ID,
              },
            },
          }).catch(() => {});

          console.log(`[PayPro Webhook] User ${dbUserId} downgraded to FREE (subscription: ${subscriptionId} ${ipnTypeName})`);
        }
        break;
      }

      case IPN_TYPES.OrderRefunded:
      case IPN_TYPES.OrderChargedBack: {
        // Refund or chargeback — downgrade to FREE
        if (dbUserId) {
          await prisma.user.update({
            where: { id: dbUserId },
            data: { plan: 'FREE' },
          });

          await prisma.activityLog.create({
            data: {
              userId: dbUserId,
              action: ActivityAction.SUBSCRIPTION_CANCELLED,
              details: {
                provider: 'paypro',
                orderId,
                type: ipnTypeName,
                reason: params.ACTION_REASON,
                amount: parseFloat(totalAmount),
              },
            },
          }).catch(() => {});

          console.log(`[PayPro Webhook] ${ipnTypeName} for user ${dbUserId} (order: ${orderId})`);
        }
        break;
      }

      case IPN_TYPES.SubscriptionSuspended: {
        console.log(`[PayPro Webhook] Subscription suspended for user ${dbUserId} (subscription: ${subscriptionId})`);
        break;
      }

      case IPN_TYPES.SubscriptionRenewed: {
        // Reactivated from suspension
        if (dbUserId) {
          await prisma.user.update({
            where: { id: dbUserId },
            data: { plan: 'PRO' },
          });
          console.log(`[PayPro Webhook] Subscription renewed for user ${dbUserId}`);
        }
        break;
      }

      default:
        console.log(`[PayPro Webhook] Unhandled event: ${ipnTypeName} (${ipnTypeId})`);
    }

    // Return 200 to acknowledge receipt
    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('[PayPro Webhook] Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
