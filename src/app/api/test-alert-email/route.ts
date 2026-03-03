import { NextResponse } from 'next/server';
import { sendApplicationEmail } from '@/lib/email';

// Temporary test endpoint - DELETE AFTER TESTING
export async function GET() {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://freelanly.com';

  function truncateDescription(description: string, maxLength = 150): string {
    const text = description.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + '...';
  }

  const testOpportunities = [
    {
      title: 'Full Stack Java Developer',
      slug: 'full-stack-java-developer-test',
      description: 'We are looking for an experienced Full Stack Java Developer to build and maintain scalable web applications using Spring Boot, React, and AWS cloud services. The ideal candidate will have 5+ years of experience with microservices architecture and CI/CD pipelines.',
      country: 'US',
      salary: 'USD102,000 - 138,000/yr',
    },
    {
      title: 'Senior React Native Engineer',
      slug: 'senior-react-native-engineer-test',
      description: 'Join our mobile team to develop cross-platform applications for iOS and Android. You will work closely with designers and backend engineers to deliver pixel-perfect UI and smooth user experiences for our fintech product.',
      country: 'Remote',
      salary: '$85,000 - 120,000/yr',
    },
  ];

  const opportunityCards = testOpportunities
    .map((opp) => {
      const oppUrl = `${APP_URL}/freelance/${opp.slug}`;
      return `
        <tr>
          <td style="padding: 20px; border-bottom: 1px solid #eee;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td width="60" valign="top">
                  <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #fff;">💼</div>
                </td>
                <td style="padding-left: 15px;">
                  <a href="${oppUrl}" style="color: #000; text-decoration: none; font-weight: 600; font-size: 16px;">
                    ${opp.title}
                  </a>
                  <div style="color: #666; font-size: 14px; margin-top: 4px;">
                    ${opp.country} • Freelance Project
                  </div>
                  <div style="color: #555; font-size: 13px; margin-top: 6px; line-height: 1.4;">${truncateDescription(opp.description)}</div>
                  <div style="color: #22c55e; font-size: 14px; margin-top: 4px;">${opp.salary}</div>
                  <div style="margin-top: 10px;">
                    <a href="${oppUrl}" style="display: inline-block; background: #000; color: #fff; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-size: 14px;">
                      View Project
                    </a>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;
    })
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #f9fafb;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 30px; text-align: center; border-bottom: 1px solid #eee;">
              <h1 style="margin: 0; font-size: 24px; color: #000;">
                🎯 New Freelance Projects for You
              </h1>
              <p style="margin: 10px 0 0; color: #666; font-size: 14px;">
                2 new Engineering projects matching your alert
              </p>
            </td>
          </tr>
          ${opportunityCards}
          <tr>
            <td style="padding: 30px; text-align: center;">
              <a href="${APP_URL}/freelance" style="display: inline-block; background: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 500;">
                View All Projects
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 30px; background: #f9fafb; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0; color: #666; font-size: 12px;">
                [TEST EMAIL] You're receiving this because you set up a job alert on Freelanly.
              </p>
              <p style="margin: 10px 0 0;">
                <a href="${APP_URL}/dashboard/alerts" style="color: #666; font-size: 12px;">
                  Manage alerts
                </a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  const result = await sendApplicationEmail({
    to: 'fedor.hatla@gmail.com',
    subject: '🎯 [TEST] 2 new freelance projects for you',
    html,
    text: 'Test alert email with descriptions',
  });

  return NextResponse.json(result);
}
