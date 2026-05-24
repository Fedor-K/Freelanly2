import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ActivityAction } from '@prisma/client';
import { verifyHash, verifySignature, IPN_TYPES } from '@/lib/paypro';

/**
 * POST /api/paypro/webhook
 *
 * Receives IPN (Instant Payment Notification) from PayPro Global.
 * Content-Type: application/x-www-form-urlencoded
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
    console.log(`[PayPro Webhook] Incoming from IP: ${ip}`);

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
    const customerEmail = (params.CUSTOMER_EMAIL || '').toLowerCase();
    const subscriptionId = params.SUBSCRIPTION_ID || '';
    const testMode = params.TEST_MODE === '1';
    const totalAmount = params.ORDER_TOTAL_AMOUNT || '0';
    const hash = params.HASH || '';
    const signature = params.SIGNATURE || '';
    const userId = params['x-userId'] || '';
    const isResent = params.IS_RESENT === '1';

    console.log(`[PayPro Webhook] ${ipnTypeName} (${ipnTypeId}) | order: ${orderId} | email: ${customerEmail} | userId: ${userId} | test: ${testMode} | resent: ${isResent}`);

    // Always log webhook receipt
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

    // Verify authenticity. Every PayPro IPN is signed; an unverifiable request
    // must not mutate any account (previously TEST_MODE=1 or an omitted
    // HASH/SIGNATURE skipped verification entirely → free PRO).
    if (testMode) {
      // Real charges are never test-mode; ignore test events in production.
      if (process.env.NODE_ENV === 'production') {
        console.warn(`[PayPro Webhook] Ignoring TEST_MODE event in production (order: ${orderId})`);
        return new NextResponse('OK (test mode ignored)', { status: 200 });
      }
    } else {
      // Live event: a valid HASH (MD5(ORDER_ID + secretKey)) is required.
      if (!hash || !verifyHash(orderId, hash, false)) {
        console.error('[PayPro Webhook] HASH missing or invalid — rejecting');
        return new NextResponse('Invalid hash', { status: 401 });
      }
      // If a SIGNATURE is present it must also be valid.
      if (signature && !verifySignature({
        orderId,
        orderStatus,
        totalAmount,
        customerEmail,
        testMode: '0',
        ipnTypeName,
        signature,
      })) {
        console.error('[PayPro Webhook] SIGNATURE invalid — rejecting');
        return new NextResponse('Invalid signature', { status: 401 });
      }
    }

    // Duplicate order protection — look up THIS order, not an arbitrary paypro row
    if (ipnTypeId === IPN_TYPES.OrderCharged) {
      const existing = await prisma.activityLog.findFirst({
        where: {
          action: 'CHECKOUT_COMPLETE',
          details: { path: ['orderId'], equals: orderId },
        },
      });
      if (existing) {
        console.log(`[PayPro Webhook] Duplicate order ${orderId}, skipping`);
        return new NextResponse('OK (duplicate)', { status: 200 });
      }
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

    // FIX 1: Alert if user not found
    if (!dbUserId && customerEmail) {
      console.error(`[PayPro Webhook] USER NOT FOUND for email: ${customerEmail}, order: ${orderId}, type: ${ipnTypeName}`);
      // Log as alert for admin visibility
      await prisma.activityLog.create({
        data: {
          action: 'PAYMENT_FAILED' as ActivityAction,
          details: {
            provider: 'paypro',
            error: 'user_not_found',
            customerEmail,
            orderId,
            ipnType: ipnTypeName,
            totalAmount,
          },
        },
      }).catch(() => {});
    }

    // Handle events
    switch (ipnTypeId) {
      case IPN_TYPES.OrderCharged: {
        // Check if this is a single contact unlock (product 129688)
        if (productId === '129688' && dbUserId) {
          const itemId = params['x-itemId'] || '';
          const itemType = params['x-itemType'] || 'opportunity';

          const unlockData: Record<string, unknown> = {
            userId: dbUserId,
            payproOrderId: orderId,
            amount: Math.round(parseFloat(totalAmount) * 100),
            currency: params.ORDER_ITEM_CURRENCY_CODE || 'EUR',
          };
          if (itemType === 'job') unlockData.jobId = itemId;
          else unlockData.opportunityId = itemId;

          await prisma.unlockedContact.create({ data: unlockData as Parameters<typeof prisma.unlockedContact.create>[0]['data'] });

          await prisma.activityLog.create({
            data: {
              userId: dbUserId,
              action: ActivityAction.CHECKOUT_COMPLETE,
              details: { type: 'unlock_contact', provider: 'paypro', itemType, itemId, orderId, amount: parseFloat(totalAmount) },
            },
          }).catch(() => {});

          console.log(`[PayPro Webhook] Contact unlocked for user ${dbUserId}: ${itemType} ${itemId}`);
          break;
        }

        if (dbUserId) {
          await prisma.user.update({
            where: { id: dbUserId },
            data: {
              plan: 'PRO',
              paymentProvider: 'paypro',
              payproOrderId: orderId,
              payproSubscriptionId: subscriptionId || null,
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
        if (dbUserId) {
          // Ensure user is PRO (in case of edge cases)
          await prisma.user.update({
            where: { id: dbUserId },
            data: { plan: 'PRO' },
          });

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

          console.log(`[PayPro Webhook] Subscription renewed for user ${dbUserId}`);
        }
        break;
      }

      case IPN_TYPES.SubscriptionChargeFailed: {
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

          console.log(`[PayPro Webhook] Payment failed for user ${dbUserId}`);
        }
        break;
      }

      case IPN_TYPES.SubscriptionTerminated:
      case IPN_TYPES.SubscriptionFinished: {
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
                ipnType: ipnTypeName,
              },
            },
          }).catch(() => {});

          // Pause auto-apply loops (PRO-only feature)
          await prisma.autoApplyLoop.updateMany({
            where: { userId: dbUserId, isActive: true },
            data: { isActive: false },
          }).catch(() => {});

          await prisma.activityLog.create({
            data: { userId: dbUserId, action: 'LOOP_PAUSED', details: { source: 'paypro_downgrade' } },
          }).catch(() => {});

          console.log(`[PayPro Webhook] User ${dbUserId} downgraded to FREE (${ipnTypeName})`);
        }
        break;
      }

      case IPN_TYPES.OrderRefunded:
      case IPN_TYPES.OrderChargedBack: {
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

      // FIX 2: Partial refund
      case IPN_TYPES.OrderPartiallyRefunded: {
        if (dbUserId) {
          // Keep PRO on partial refund, just log it
          await prisma.activityLog.create({
            data: {
              userId: dbUserId,
              action: ActivityAction.PAYMENT_SUCCESS,
              details: {
                provider: 'paypro',
                type: 'partial_refund',
                orderId,
                amount: parseFloat(totalAmount),
                reason: params.ACTION_REASON,
              },
            },
          }).catch(() => {});

          console.log(`[PayPro Webhook] Partial refund for user ${dbUserId} (order: ${orderId})`);
        }
        break;
      }

      case IPN_TYPES.SubscriptionSuspended: {
        if (dbUserId) {
          await prisma.activityLog.create({
            data: {
              userId: dbUserId,
              action: ActivityAction.SUBSCRIPTION_CANCELLED,
              details: {
                provider: 'paypro',
                type: 'suspended',
                subscriptionId,
              },
            },
          }).catch(() => {});
          console.log(`[PayPro Webhook] Subscription suspended for user ${dbUserId}`);
        }
        break;
      }

      case IPN_TYPES.SubscriptionRenewed: {
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

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('[PayPro Webhook] Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
