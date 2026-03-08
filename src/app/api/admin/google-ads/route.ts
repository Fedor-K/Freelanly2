/**
 * Google Ads API — основной маршрут
 *
 * GET  /api/admin/google-ads — список кампаний + отчёт аккаунта
 * POST /api/admin/google-ads — создание кампании / группы / объявления / ключевых слов
 * PUT  /api/admin/google-ads — обновление статуса / бюджета
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
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

const ADMIN_EMAILS = ['fedor.hatla@gmail.com'];

async function checkAdmin() {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return false;
  }
  return true;
}

function errorResponse(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

// GET — получение данных
export async function GET(req: NextRequest) {
  if (!(await checkAdmin())) {
    return errorResponse('Unauthorized', 401);
  }

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
  if (!(await checkAdmin())) {
    return errorResponse('Unauthorized', 401);
  }

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
  if (!(await checkAdmin())) {
    return errorResponse('Unauthorized', 401);
  }

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
