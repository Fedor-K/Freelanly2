/**
 * Google Ads API — основной маршрут
 *
 * GET  /api/admin/google-ads — список кампаний + отчёт аккаунта
 * POST /api/admin/google-ads — создание кампании / группы / объявления / ключевых слов
 * PUT  /api/admin/google-ads — обновление статуса / бюджета
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminSession } from '@/lib/admin-auth';
import {
  listCampaigns,
  createCampaign,
  updateCampaignStatus,
  updateCampaignBudget,
  listAdGroups,
  listAssetGroups,
  createAdGroup,
  listAds,
  createResponsiveSearchAd,
  addKeywords,
  listConversions,
  createConversionAction,
  getAccountReport,
  getCampaignReport,
  GoogleAdsError,
  type CampaignChannelType,
  type CreateCampaignSettings,
  type DateRange,
} from '@/lib/google-ads';

function errorResponse(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

// GET — получение данных
export async function GET(req: NextRequest) {
  const authError = await checkAdminSession(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'campaigns';

  try {
    switch (action) {
      case 'campaigns': {
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const dateRange = from && to ? { from, to } : undefined;
        const campaigns = await listCampaigns(dateRange);
        return NextResponse.json({ campaigns });
      }

      case 'ad-groups': {
        const campaignId = searchParams.get('campaignId');
        if (!campaignId) return errorResponse('campaignId required', 400);
        const adGroups = await listAdGroups(campaignId);
        return NextResponse.json({ adGroups });
      }

      case 'asset-groups': {
        const campaignId = searchParams.get('campaignId');
        if (!campaignId) return errorResponse('campaignId required', 400);
        const assetGroups = await listAssetGroups(campaignId);
        return NextResponse.json({ assetGroups });
      }

      case 'ads': {
        const adGroupId = searchParams.get('adGroupId');
        if (!adGroupId) return errorResponse('adGroupId required', 400);
        const ads = await listAds(adGroupId);
        return NextResponse.json({ ads });
      }

      case 'conversions': {
        const conversions = await listConversions();
        return NextResponse.json({ conversions });
      }

      case 'account-report': {
        const dateRange: DateRange = {};
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        if (from && to) {
          dateRange.from = from;
          dateRange.to = to;
        } else {
          dateRange.dateConstant = searchParams.get('period') || 'LAST_30_DAYS';
        }
        const report = await getAccountReport(dateRange);
        return NextResponse.json({ report });
      }

      case 'campaign-report': {
        const campaignId = searchParams.get('campaignId');
        if (!campaignId) return errorResponse('campaignId required', 400);
        const dateRange: DateRange = {};
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        if (from && to) {
          dateRange.from = from;
          dateRange.to = to;
        } else {
          dateRange.dateConstant = searchParams.get('period') || 'LAST_30_DAYS';
        }
        const report = await getCampaignReport(campaignId, dateRange);
        return NextResponse.json({ report });
      }

      default:
        return errorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (error) {
    console.error('[Google Ads API]', error);
    const message = error instanceof GoogleAdsError ? error.message : 'Internal server error';
    return errorResponse(message);
  }
}

// POST — создание
export async function POST(req: NextRequest) {
  const authError = await checkAdminSession(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'create-campaign': {
        const { name, dailyBudget, channelType, settings } = body;
        if (!name || !dailyBudget) return errorResponse('name and dailyBudget required', 400);
        const result = await createCampaign(
          name,
          dailyBudget,
          (channelType || 'SEARCH') as CampaignChannelType,
          settings as CreateCampaignSettings
        );
        return NextResponse.json({ success: true, ...result });
      }

      case 'create-translation-campaign': {
        // Спец. экшн: создание кампании Translation Jobs целиком
        const existingBudget = 'customers/9737618327/campaignBudgets/15446510528';

        // 1. Кампания
        const campaignResult = await createCampaign(
          'Freelanly Translation Jobs', 3, 'SEARCH',
          {
            biddingStrategy: 'manual_cpc',
            existingBudgetResourceName: existingBudget,
            networkSettings: { targetGoogleSearch: true, targetSearchNetwork: true, targetContentNetwork: false },
          }
        );
        const campaignId = campaignResult.campaignResourceName.split('/').pop()!;

        // 2. Ad Group (CPC €0.30)
        const adGroupResource = await createAdGroup(campaignId, 'Translation Keywords', 300000);
        const adGroupId = adGroupResource.split('/').pop()!;

        // 3. Keywords
        const keywords = [
          { text: 'remote translation jobs', matchType: 'PHRASE' as const },
          { text: 'freelance translation work', matchType: 'PHRASE' as const },
          { text: 'online translation jobs', matchType: 'PHRASE' as const },
          { text: 'translation jobs from home', matchType: 'PHRASE' as const },
          { text: 'remote translator jobs', matchType: 'PHRASE' as const },
          { text: 'freelance translator work', matchType: 'PHRASE' as const },
          { text: 'remote localization jobs', matchType: 'PHRASE' as const },
          { text: 'translation work online', matchType: 'PHRASE' as const },
          { text: 'remote interpreter jobs', matchType: 'PHRASE' as const },
          { text: 'work from home translation', matchType: 'PHRASE' as const },
          { text: 'remote subtitling jobs', matchType: 'PHRASE' as const },
        ];
        const kwResults = await addKeywords(adGroupId, keywords);

        // 4. Responsive Search Ad
        const headlines = [
          'Remote Translation Jobs', 'Freelance Translator Work', '13,000+ Remote Jobs',
          'Apply Direct to Companies', 'Translation Jobs Online', 'Work From Home Today',
          'No Middlemen, Direct', 'New Jobs Every Day', 'Start Translating Now',
          'Remote Localization Jobs', 'Freelanly.com', 'Get Hired as Translator',
          'Join 5000+ Translators', 'Translation & Subtitling', 'Instant Job Alerts',
        ];
        const descriptions = [
          'Find remote translation & localization jobs. Apply directly to companies, no agencies.',
          'Browse 13,000+ remote jobs. Get instant alerts for new translation opportunities.',
          'Direct contact with hiring managers. Apply before others see the job. From €0.39/day.',
          'Remote translation jobs updated daily. Set up alerts and never miss an opportunity.',
        ];
        const adResource = await createResponsiveSearchAd(
          adGroupId, headlines, descriptions,
          'https://freelanly.com/freelance?category=translation&utm_source=google&utm_medium=cpc&utm_campaign=translation_jobs'
        );

        return NextResponse.json({
          success: true,
          campaign: campaignResult.campaignResourceName,
          adGroup: adGroupResource,
          keywords: kwResults.length,
          ad: adResource,
        });
      }

      case 'create-ad-group': {
        const { campaignId, name, cpcBidMicros } = body;
        if (!campaignId || !name) return errorResponse('campaignId and name required', 400);
        const resourceName = await createAdGroup(campaignId, name, cpcBidMicros);
        return NextResponse.json({ success: true, resourceName });
      }

      case 'create-ad': {
        const { adGroupId, headlines, descriptions, finalUrl } = body;
        if (!adGroupId || !headlines || !descriptions || !finalUrl) {
          return errorResponse('adGroupId, headlines, descriptions, finalUrl required', 400);
        }
        const resourceName = await createResponsiveSearchAd(adGroupId, headlines, descriptions, finalUrl);
        return NextResponse.json({ success: true, resourceName });
      }

      case 'create-conversion': {
        const { name, category, type } = body;
        if (!name) return errorResponse('name required', 400);
        const resourceName = await createConversionAction(name, category, type);
        return NextResponse.json({ success: true, resourceName });
      }

      case 'add-keywords': {
        const { adGroupId, keywords } = body;
        if (!adGroupId || !keywords?.length) {
          return errorResponse('adGroupId and keywords required', 400);
        }
        const resourceNames = await addKeywords(adGroupId, keywords);
        return NextResponse.json({ success: true, resourceNames });
      }

      default:
        return errorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (error) {
    console.error('[Google Ads API]', error);
    const message = error instanceof GoogleAdsError ? error.message : 'Internal server error';
    return errorResponse(message);
  }
}

// PUT — обновление
export async function PUT(req: NextRequest) {
  const authError = await checkAdminSession(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'update-campaign-status': {
        const { campaignId, status } = body;
        if (!campaignId || !status) return errorResponse('campaignId and status required', 400);
        await updateCampaignStatus(campaignId, status);
        return NextResponse.json({ success: true });
      }

      case 'update-budget': {
        const { campaignId, amountMicros } = body;
        if (!campaignId || amountMicros === undefined) {
          return errorResponse('campaignId and amountMicros required', 400);
        }
        await updateCampaignBudget(campaignId, amountMicros);
        return NextResponse.json({ success: true });
      }

      default:
        return errorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (error) {
    console.error('[Google Ads API]', error);
    const message = error instanceof GoogleAdsError ? error.message : 'Internal server error';
    return errorResponse(message);
  }
}
