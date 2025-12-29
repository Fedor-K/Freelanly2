import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createPortalSession } from '@/lib/stripe';
import { sendApplicationEmail } from '@/lib/dashamail';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Get user with Stripe ID
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        email: true,
        name: true,
        stripeId: true,
        plan: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.stripeId) {
      return NextResponse.json(
        { error: 'User has no Stripe account' },
        { status: 400 }
      );
    }

    // Build return URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://freelanly.com';
    const returnUrl = `${baseUrl}/dashboard/settings`;

    // Create portal session (link is valid for limited time)
    const portalSession = await createPortalSession({
      customerId: user.stripeId,
      returnUrl,
    });

    // Send email with portal link
    const emailResult = await sendApplicationEmail({
      to: user.email,
      subject: 'Manage Your Freelanly Subscription',
      html: generatePortalEmailHtml({
        userName: user.name || 'there',
        portalUrl: portalSession.url,
      }),
    });

    if (!emailResult.success) {
      return NextResponse.json(
        { error: `Failed to send email: ${emailResult.error}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Portal link sent to ${user.email}`,
    });
  } catch (error) {
    console.error('Error sending portal link:', error);
    return NextResponse.json(
      { error: 'Failed to send portal link', details: String(error) },
      { status: 500 }
    );
  }
}

function generatePortalEmailHtml(params: {
  userName: string;
  portalUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { font-size: 28px; font-weight: bold; color: #000; }
    .content { background: #f9f9f9; border-radius: 12px; padding: 30px; margin-bottom: 30px; }
    h1 { font-size: 24px; margin: 0 0 20px 0; }
    p { margin: 0 0 15px 0; }
    .button { display: inline-block; background: #000; color: #fff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #333; }
    .footer { text-align: center; font-size: 12px; color: #666; }
    .note { font-size: 14px; color: #666; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Freelanly</div>
    </div>

    <div class="content">
      <h1>Manage Your Subscription</h1>
      <p>Hi ${params.userName},</p>
      <p>Click the button below to access your subscription management portal where you can:</p>
      <ul>
        <li>Update your payment method</li>
        <li>View billing history</li>
        <li>Change or cancel your plan</li>
        <li>Download invoices</li>
      </ul>

      <p style="text-align: center;">
        <a href="${params.portalUrl}" class="button">Manage Subscription</a>
      </p>

      <p class="note">
        ⏰ This link expires in 24 hours. If you didn't request this, you can safely ignore this email.
      </p>
    </div>

    <div class="footer">
      <p>© ${new Date().getFullYear()} Freelanly. All rights reserved.</p>
      <p>Questions? Reply to this email or contact support@freelanly.com</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
