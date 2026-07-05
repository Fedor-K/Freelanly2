import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { testSmtpConnection } from '@/lib/smtp-sender';

// Coarse bucket for the raw SMTP error, so the failure funnel is queryable (bad_credentials is the
// Gmail app-password wall; bad_username is providers like Resend that need a fixed login, not email).
function smtpFailReason(err: string): string {
  const s = err || '';
  if (/AUTH password failed|BadCredentials|535|5\.7\.8|Username and Password/i.test(s)) return 'bad_credentials';
  if (/AUTH username failed/i.test(s)) return 'bad_username';
  if (/AUTH LOGIN failed/i.test(s)) return 'auth_unsupported';
  if (/STARTTLS|TLS|EHLO|greeting/i.test(s)) return 'tls_or_handshake';
  if (/timeout|Connection error|ECONN|ENOTFOUND|EHOSTUNREACH|ETIMEDOUT/i.test(s)) return 'connection';
  return 'other';
}

// POST /api/user/smtp/test — Test SMTP connection by sending a test email
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const smtp = await prisma.userSmtp.findUnique({
      where: { userId: session.user.id },
    });

    if (!smtp) {
      return NextResponse.json(
        { error: 'SMTP not configured. Please save your SMTP settings first.' },
        { status: 400 }
      );
    }

    console.log(`[SMTP Test] Testing connection for user ${session.user.id} via ${smtp.host}:${smtp.port}`);

    const result = await testSmtpConnection({
      host: smtp.host,
      port: smtp.port,
      email: smtp.email,
      password: smtp.password,
    });

    if (result.success) {
      // Mark SMTP as verified; clear any prior failure reason.
      await prisma.userSmtp.update({
        where: { userId: session.user.id },
        data: { verified: true, lastError: null, lastTriedAt: new Date() },
      });

      console.log(`[SMTP Test] Success for user ${session.user.id}`);

      await prisma.activityLog.create({
        data: { userId: session.user.id, action: 'SMTP_CONNECTED', details: { host: smtp.host, email: smtp.email } },
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully. Check your inbox.',
        messageId: result.messageId,
      });
    } else {
      const rawError = result.error || 'SMTP connection failed';
      const reason = smtpFailReason(rawError);
      console.error(`[SMTP Test] Failed for user ${session.user.id} (${reason}): ${rawError}`);

      // Persist the failure so we can see WHY connects fail instead of guessing from Vercel logs.
      await prisma.userSmtp.update({
        where: { userId: session.user.id },
        data: { verified: false, lastError: rawError.slice(0, 500), lastTriedAt: new Date() },
      }).catch(() => {});
      await prisma.activityLog.create({
        data: { userId: session.user.id, action: 'FUNNEL_STEP', details: { step: 'smtp_test_failed', reason, host: smtp.host, error: rawError.slice(0, 300) } },
      }).catch(() => {});

      return NextResponse.json(
        { success: false, error: rawError, reason },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[API] Error testing SMTP:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
