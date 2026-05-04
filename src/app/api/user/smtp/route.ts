import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/user/smtp — Get user's SMTP config (password masked)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const smtp = await prisma.userSmtp.findUnique({
      where: { userId: session.user.id },
    });

    if (!smtp) {
      return NextResponse.json(null);
    }

    // Mask password — show only last 4 chars
    const maskedPassword =
      smtp.password.length > 4
        ? '*'.repeat(smtp.password.length - 4) + smtp.password.slice(-4)
        : '****';

    return NextResponse.json({
      id: smtp.id,
      host: smtp.host,
      port: smtp.port,
      email: smtp.email,
      password: maskedPassword,
      verified: smtp.verified,
      createdAt: smtp.createdAt,
      updatedAt: smtp.updatedAt,
    });
  } catch (error) {
    console.error('[API] Error getting SMTP config:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// POST /api/user/smtp — Create or update SMTP config
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { host, port, email, password } = body as {
      host?: string;
      port?: number;
      email?: string;
      password?: string;
    };

    if (!host || !email || !password) {
      return NextResponse.json(
        { error: 'host, email, and password are required' },
        { status: 400 }
      );
    }

    const smtpPort = port || 587;

    // Validate port
    if (![25, 465, 587, 2525].includes(smtpPort)) {
      return NextResponse.json(
        { error: 'Invalid port. Supported: 25, 465, 587, 2525' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!email.includes('@') || !/\.[a-z]{2,}$/i.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const smtp = await prisma.userSmtp.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        host: host.trim(),
        port: smtpPort,
        email: email.trim().toLowerCase(),
        password,
        verified: false,
      },
      update: {
        host: host.trim(),
        port: smtpPort,
        email: email.trim().toLowerCase(),
        password,
        verified: false, // Reset verification when config changes
      },
    });

    return NextResponse.json({
      id: smtp.id,
      host: smtp.host,
      port: smtp.port,
      email: smtp.email,
      verified: smtp.verified,
    });
  } catch (error) {
    console.error('[API] Error saving SMTP config:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// DELETE /api/user/smtp — Remove SMTP config
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.userSmtp.deleteMany({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting SMTP config:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
