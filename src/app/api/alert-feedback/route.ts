import { NextRequest, NextResponse } from 'next/server';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prisma: any = null;
try {
  // Dynamic import to avoid build errors before prisma generate
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  prisma = require('@/lib/db').prisma;
} catch {}

/**
 * Alert Email Feedback
 * GET /api/alert-feedback?r=helpful&u=USER_ID&a=ALERT_ID&c=CATEGORY
 *
 * Called when user clicks 👍/👎 in alert emails.
 * No auth required — link is from email.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rating = searchParams.get('r');
    const userId = searchParams.get('u');
    const alertId = searchParams.get('a');
    const category = searchParams.get('c');

    if (!rating || !['helpful', 'not_helpful'].includes(rating)) {
      return new NextResponse(thankYouPage('Спасибо!'), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    if (prisma?.alertEmailFeedback) {
      await prisma.alertEmailFeedback.create({
        data: {
          userId: userId || null,
          alertId: alertId || null,
          rating,
          category: category || null,
        },
      });
    } else {
      console.log('[AlertFeedback]', { rating, userId, alertId, category });
    }

    const isHelpful = rating === 'helpful';
    return new NextResponse(
      thankYouPage(
        isHelpful ? '👍 Отлично!' : '👎 Понял, постараемся улучшить',
        isHelpful
          ? 'Рады, что подборка подходит. Удачи в поиске!'
          : 'Спасибо за честность — это поможет нам подбирать более релевантные вакансии.'
      ),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (error) {
    console.error('[AlertFeedback]', error);
    return new NextResponse(thankYouPage('Спасибо!'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

function thankYouPage(title: string, subtitle = '') {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f9fafb; }
    .box { text-align: center; padding: 40px; background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 400px; }
    h1 { font-size: 28px; margin: 0 0 10px; }
    p { color: #666; margin: 0 0 20px; }
    a { color: #000; font-weight: 600; }
  </style>
</head>
<body>
  <div class="box">
    <h1>${title}</h1>
    ${subtitle ? `<p>${subtitle}</p>` : ''}
    <a href="https://freelanly.com">← Вернуться на Freelanly</a>
  </div>
</body>
</html>`;
}
