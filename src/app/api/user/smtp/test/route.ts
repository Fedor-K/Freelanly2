import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { testSmtpConnection } from '@/lib/smtp-sender';

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
      // Mark SMTP as verified
      await prisma.userSmtp.update({
        where: { userId: session.user.id },
        data: { verified: true },
      });

      console.log(`[SMTP Test] Success for user ${session.user.id}`);

      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully. Check your inbox.',
        messageId: result.messageId,
      });
    } else {
      console.error(`[SMTP Test] Failed for user ${session.user.id}: ${result.error}`);

      return NextResponse.json(
        {
          success: false,
          error: result.error || 'SMTP connection failed',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[API] Error testing SMTP:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
