// Test email sending via current provider
import { sendApplicationEmail, getProviderInfo } from '../src/lib/email';

async function main() {
  const email = process.argv[2] || 'fedor.hatla@gmail.com';

  console.log('=== Email Provider Test ===\n');
  console.log('Provider info:', getProviderInfo());
  console.log(`\nSending test email to: ${email}\n`);

  const result = await sendApplicationEmail({
    to: email,
    subject: '🧪 Freelanly Email Test',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #000; margin-bottom: 20px;">Email Test Successful!</h1>
        <p style="color: #666; line-height: 1.6;">
          This is a test email from Freelanly to verify email delivery.
        </p>
        <p style="color: #666; line-height: 1.6;">
          <strong>Provider:</strong> Resend<br>
          <strong>Sent at:</strong> ${new Date().toISOString()}
        </p>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">
          Freelanly - Remote Jobs Platform
        </div>
      </div>
    `,
    text: `Email Test Successful!\n\nThis is a test email from Freelanly.\nProvider: ${process.env.EMAIL_PROVIDER || 'dashamail'}\nSent at: ${new Date().toISOString()}`,
  });

  if (result.success) {
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', result.messageId);
  } else {
    console.error('❌ Failed to send email:', result.error);
    process.exit(1);
  }
}

main().catch(console.error);
