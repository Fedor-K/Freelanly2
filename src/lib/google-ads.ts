import {
  GoogleAdsApi,
  enums,
  resources,
  services,
  toMicros,
  fromMicros,
  MutateOperation,
} from "google-ads-api";
import type { Customer } from "google-ads-api";

// ---------------------------------------------------------------------------
// Конфигурация
// ---------------------------------------------------------------------------

const GOOGLE_ADS_CONFIG = {
  client_id: (process.env.GOOGLE_ADS_CLIENT_ID || "").trim(),
  client_secret: (process.env.GOOGLE_ADS_CLIENT_SECRET || "").trim(),
  developer_token: (process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "").trim(),
};

const CUSTOMER_ID = (process.env.GOOGLE_ADS_CUSTOMER_ID || "").trim();
const MANAGER_ID = (process.env.GOOGLE_ADS_MANAGER_ID || "").trim();
const REFRESH_TOKEN = (process.env.GOOGLE_ADS_REFRESH_TOKEN || "").trim();

// ---------------------------------------------------------------------------
// Типы
// ---------------------------------------------------------------------------

/** Статус кампании для обновления */
export type CampaignStatusUpdate = "ENABLED" | "PAUSED" | "REMOVED";

/** Тип рекламного канала */
export type CampaignChannelType = "SEARCH" | "DISPLAY" | "PERFORMANCE_MAX" | "VIDEO";

/** Тип соответствия ключевого слова */
export type KeywordMatchTypeInput = "BROAD" | "PHRASE" | "EXACT";

/** Ключевое слово для добавления */
export interface KeywordInput {
  text: string;
  matchType?: KeywordMatchTypeInput;
}

/** Настройки создания кампании */
export interface CreateCampaignSettings {
  /** Стратегия назначения ставок: manual_cpc или maximize_conversions */
  biddingStrategy?: "manual_cpc" | "maximize_conversions" | "maximize_clicks" | "target_cpa";
  /** Целевая CPA в микро (для target_cpa стратегии) */
  targetCpaMicros?: number;
  /** Сети для показа рекламы */
  networkSettings?: {
    targetGoogleSearch?: boolean;
    targetSearchNetwork?: boolean;
    targetContentNetwork?: boolean;
  };
  /** Дата начала в формате YYYY-MM-DD */
  startDate?: string;
  /** Дата окончания в формате YYYY-MM-DD */
  endDate?: string;
}

/** Данные кампании из API */
export interface CampaignData {
  id: string;
  name: string;
  status: string;
  channelType: string;
  budgetAmountMicros: number;
  budgetAmount: number;
  impressions: number;
  clicks: number;
  costMicros: number;
  cost: number;
  conversions: number;
  ctr: number;
  averageCpc: number;
}

/** Данные группы объявлений */
export interface AdGroupData {
  id: string;
  name: string;
  status: string;
  campaignId: string;
  cpcBidMicros: number;
  cpcBid: number;
}

/** Данные объявления */
export interface AdData {
  id: string;
  adGroupId: string;
  status: string;
  type: string;
  headlines: string[];
  descriptions: string[];
  finalUrls: string[];
}

/** Диапазон дат для отчётов */
export interface DateRange {
  /** Предустановленный диапазон (LAST_7_DAYS, LAST_30_DAYS и т.д.) */
  dateConstant?: string;
  /** Дата начала в формате YYYY-MM-DD */
  from?: string;
  /** Дата окончания в формате YYYY-MM-DD */
  to?: string;
}

/** Строка отчёта о производительности */
export interface PerformanceReportRow {
  date?: string;
  campaignId?: string;
  campaignName?: string;
  impressions: number;
  clicks: number;
  costMicros: number;
  cost: number;
  conversions: number;
  ctr: number;
  averageCpc: number;
  conversionsValue: number;
}

/** Данные конверсии */
export interface ConversionActionData {
  id: string;
  name: string;
  category: string;
  type: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Клиент
// ---------------------------------------------------------------------------

let clientInstance: GoogleAdsApi | null = null;

/**
 * Возвращает аутентифицированный экземпляр GoogleAdsApi.
 * Использует ленивую инициализацию и синглтон.
 */
export function getClient(): GoogleAdsApi {
  if (!clientInstance) {
    if (!GOOGLE_ADS_CONFIG.client_id) {
      throw new Error("GOOGLE_ADS_CLIENT_ID не установлен");
    }
    if (!GOOGLE_ADS_CONFIG.client_secret) {
      throw new Error("GOOGLE_ADS_CLIENT_SECRET не установлен");
    }
    if (!GOOGLE_ADS_CONFIG.developer_token) {
      throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN не установлен");
    }

    clientInstance = new GoogleAdsApi({
      client_id: GOOGLE_ADS_CONFIG.client_id,
      client_secret: GOOGLE_ADS_CONFIG.client_secret,
      developer_token: GOOGLE_ADS_CONFIG.developer_token,
    });
  }
  return clientInstance;
}

/**
 * Возвращает Customer для выполнения запросов к Google Ads API.
 * @param customerId - ID клиентского аккаунта (по умолчанию из env)
 */
export function getCustomer(customerId?: string): Customer {
  const client = getClient();

  if (!REFRESH_TOKEN) {
    throw new Error("GOOGLE_ADS_REFRESH_TOKEN не установлен");
  }

  return client.Customer({
    customer_id: customerId || CUSTOMER_ID,
    refresh_token: REFRESH_TOKEN,
    login_customer_id: MANAGER_ID || undefined,
  });
}

// ---------------------------------------------------------------------------
// Кампании
// ---------------------------------------------------------------------------

/**
 * Получает список всех кампаний со статистикой.
 * @returns Массив кампаний с метриками
 */
export async function listCampaigns(): Promise<CampaignData[]> {
  try {
    const customer = getCustomer();

    const rows = await customer.query(`
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign_budget.amount_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc
      FROM campaign
      WHERE campaign.status != 'REMOVED'
      ORDER BY campaign.name
    `);

    return rows.map((row: any) => ({
      id: String(row.campaign?.id ?? ""),
      name: row.campaign?.name ?? "",
      status: row.campaign?.status ?? "UNKNOWN",
      channelType: row.campaign?.advertising_channel_type ?? "UNKNOWN",
      budgetAmountMicros: Number(row.campaign_budget?.amount_micros ?? 0),
      budgetAmount: fromMicros(Number(row.campaign_budget?.amount_micros ?? 0)),
      impressions: Number(row.metrics?.impressions ?? 0),
      clicks: Number(row.metrics?.clicks ?? 0),
      costMicros: Number(row.metrics?.cost_micros ?? 0),
      cost: fromMicros(Number(row.metrics?.cost_micros ?? 0)),
      conversions: Number(row.metrics?.conversions ?? 0),
      ctr: Number(row.metrics?.ctr ?? 0),
      averageCpc: fromMicros(Number(row.metrics?.average_cpc ?? 0)),
    }));
  } catch (error) {
    console.error("[Google Ads] Ошибка получения кампаний:", error);
    throw new GoogleAdsError("Не удалось получить список кампаний", error);
  }
}

/**
 * Создаёт новую рекламную кампанию с бюджетом.
 * @param name - Название кампании
 * @param dailyBudgetAmount - Дневной бюджет в основной валюте (например, 50 = 50 EUR)
 * @param channelType - Тип канала: SEARCH, DISPLAY, PERFORMANCE_MAX, VIDEO
 * @param settings - Дополнительные настройки кампании
 * @returns Resource name созданной кампании
 */
export async function createCampaign(
  name: string,
  dailyBudgetAmount: number,
  channelType: CampaignChannelType = "SEARCH",
  settings: CreateCampaignSettings = {}
): Promise<{ campaignResourceName: string; budgetResourceName: string }> {
  try {
    const customer = getCustomer();

    // Генерируем временный ID для бюджета (отрицательное число для batch-операций)
    const tempBudgetId = -1;

    // Определяем стратегию назначения ставок
    const biddingStrategyConfig: Record<string, any> = {};
    switch (settings.biddingStrategy) {
      case "maximize_conversions":
        biddingStrategyConfig.maximize_conversions = {};
        break;
      case "maximize_clicks":
        biddingStrategyConfig.maximize_clicks = {};
        break;
      case "target_cpa":
        biddingStrategyConfig.target_cpa = {
          target_cpa_micros: settings.targetCpaMicros ?? toMicros(10),
        };
        break;
      case "manual_cpc":
      default:
        biddingStrategyConfig.manual_cpc = { enhanced_cpc_enabled: false };
        break;
    }

    // Маппинг типа канала в enum
    const channelTypeMap: Record<CampaignChannelType, number> = {
      SEARCH: enums.AdvertisingChannelType.SEARCH,
      DISPLAY: enums.AdvertisingChannelType.DISPLAY,
      PERFORMANCE_MAX: enums.AdvertisingChannelType.PERFORMANCE_MAX,
      VIDEO: enums.AdvertisingChannelType.VIDEO,
    };

    const mutations: MutateOperation<any>[] = [
      // Создание бюджета
      {
        entity: "campaign_budget",
        operation: "create",
        resource: {
          resource_name: `customers/${CUSTOMER_ID}/campaignBudgets/${tempBudgetId}`,
          name: `${name} — бюджет`,
          amount_micros: toMicros(dailyBudgetAmount),
          delivery_method: enums.BudgetDeliveryMethod.STANDARD,
          explicitly_shared: false,
        },
      },
      // Создание кампании
      {
        entity: "campaign",
        operation: "create",
        resource: {
          resource_name: `customers/${CUSTOMER_ID}/campaigns/${-2}`,
          name,
          status: enums.CampaignStatus.PAUSED,
          advertising_channel_type: channelTypeMap[channelType],
          campaign_budget: `customers/${CUSTOMER_ID}/campaignBudgets/${tempBudgetId}`,
          network_settings: {
            target_google_search: settings.networkSettings?.targetGoogleSearch ?? true,
            target_search_network: settings.networkSettings?.targetSearchNetwork ?? true,
            target_content_network: settings.networkSettings?.targetContentNetwork ?? false,
          },
          start_date: settings.startDate,
          end_date: settings.endDate,
          ...biddingStrategyConfig,
        },
      },
    ];

    const response = await customer.mutateResources(mutations);

    const results = response.mutate_operation_responses ?? [];
    return {
      budgetResourceName:
        results[0]?.campaign_budget_result?.resource_name ?? "",
      campaignResourceName:
        results[1]?.campaign_result?.resource_name ?? "",
    };
  } catch (error) {
    console.error("[Google Ads] Ошибка создания кампании:", error);
    throw new GoogleAdsError("Не удалось создать кампанию", error);
  }
}

/**
 * Обновляет статус кампании (пауза, включение, удаление).
 * @param campaignId - ID кампании
 * @param status - Новый статус: ENABLED, PAUSED, REMOVED
 */
export async function updateCampaignStatus(
  campaignId: string,
  status: CampaignStatusUpdate
): Promise<void> {
  try {
    const customer = getCustomer();

    const statusMap: Record<CampaignStatusUpdate, number> = {
      ENABLED: enums.CampaignStatus.ENABLED,
      PAUSED: enums.CampaignStatus.PAUSED,
      REMOVED: enums.CampaignStatus.REMOVED,
    };

    await customer.mutateResources([
      {
        entity: "campaign",
        operation: "update",
        resource: {
          resource_name: `customers/${CUSTOMER_ID}/campaigns/${campaignId}`,
          status: statusMap[status],
        },
      },
    ]);
  } catch (error) {
    console.error("[Google Ads] Ошибка обновления статуса кампании:", error);
    throw new GoogleAdsError("Не удалось обновить статус кампании", error);
  }
}

/**
 * Обновляет дневной бюджет кампании.
 * @param campaignId - ID кампании
 * @param amountMicros - Новый бюджет в микро (1 EUR = 1,000,000 микро)
 */
export async function updateCampaignBudget(
  campaignId: string,
  amountMicros: number
): Promise<void> {
  try {
    const customer = getCustomer();

    // Сначала получаем resource name бюджета кампании
    const rows = await customer.query(`
      SELECT campaign.campaign_budget
      FROM campaign
      WHERE campaign.id = ${campaignId}
    `);

    if (!rows.length) {
      throw new Error(`Кампания ${campaignId} не найдена`);
    }

    const budgetResourceName = (rows[0] as any).campaign?.campaign_budget;
    if (!budgetResourceName) {
      throw new Error(`Бюджет кампании ${campaignId} не найден`);
    }

    await customer.mutateResources([
      {
        entity: "campaign_budget",
        operation: "update",
        resource: {
          resource_name: budgetResourceName,
          amount_micros: amountMicros,
        },
      },
    ]);
  } catch (error) {
    console.error("[Google Ads] Ошибка обновления бюджета:", error);
    throw new GoogleAdsError("Не удалось обновить бюджет кампании", error);
  }
}

// ---------------------------------------------------------------------------
// Группы объявлений
// ---------------------------------------------------------------------------

/**
 * Получает список групп объявлений для кампании.
 * @param campaignId - ID кампании
 * @returns Массив групп объявлений
 */
export async function listAdGroups(campaignId: string): Promise<AdGroupData[]> {
  try {
    const customer = getCustomer();

    const rows = await customer.query(`
      SELECT
        ad_group.id,
        ad_group.name,
        ad_group.status,
        ad_group.campaign,
        ad_group.cpc_bid_micros
      FROM ad_group
      WHERE campaign.id = ${campaignId}
        AND ad_group.status != 'REMOVED'
      ORDER BY ad_group.name
    `);

    return rows.map((row: any) => ({
      id: String(row.ad_group?.id ?? ""),
      name: row.ad_group?.name ?? "",
      status: row.ad_group?.status ?? "UNKNOWN",
      campaignId,
      cpcBidMicros: Number(row.ad_group?.cpc_bid_micros ?? 0),
      cpcBid: fromMicros(Number(row.ad_group?.cpc_bid_micros ?? 0)),
    }));
  } catch (error) {
    console.error("[Google Ads] Ошибка получения групп объявлений:", error);
    throw new GoogleAdsError("Не удалось получить группы объявлений", error);
  }
}

/**
 * Создаёт новую группу объявлений в кампании.
 * @param campaignId - ID кампании
 * @param name - Название группы
 * @param cpcBidMicros - Ставка CPC в микро (по умолчанию 1 EUR = 1,000,000)
 * @returns Resource name созданной группы
 */
export async function createAdGroup(
  campaignId: string,
  name: string,
  cpcBidMicros: number = toMicros(1)
): Promise<string> {
  try {
    const customer = getCustomer();

    const response = await customer.mutateResources([
      {
        entity: "ad_group",
        operation: "create",
        resource: {
          resource_name: `customers/${CUSTOMER_ID}/adGroups/${-1}`,
          name,
          campaign: `customers/${CUSTOMER_ID}/campaigns/${campaignId}`,
          status: enums.AdGroupStatus.ENABLED,
          type: enums.AdGroupType.SEARCH_STANDARD,
          cpc_bid_micros: cpcBidMicros,
        },
      },
    ]);

    const results = response.mutate_operation_responses ?? [];
    return results[0]?.ad_group_result?.resource_name ?? "";
  } catch (error) {
    console.error("[Google Ads] Ошибка создания группы объявлений:", error);
    throw new GoogleAdsError("Не удалось создать группу объявлений", error);
  }
}

// ---------------------------------------------------------------------------
// Объявления
// ---------------------------------------------------------------------------

/**
 * Получает список объявлений в группе.
 * @param adGroupId - ID группы объявлений
 * @returns Массив объявлений
 */
export async function listAds(adGroupId: string): Promise<AdData[]> {
  try {
    const customer = getCustomer();

    const rows = await customer.query(`
      SELECT
        ad_group_ad.ad.id,
        ad_group_ad.ad.type,
        ad_group_ad.status,
        ad_group_ad.ad.responsive_search_ad.headlines,
        ad_group_ad.ad.responsive_search_ad.descriptions,
        ad_group_ad.ad.final_urls
      FROM ad_group_ad
      WHERE ad_group.id = ${adGroupId}
        AND ad_group_ad.status != 'REMOVED'
    `);

    return rows.map((row: any) => {
      const ad = row.ad_group_ad?.ad;
      const rsa = ad?.responsive_search_ad;

      return {
        id: String(ad?.id ?? ""),
        adGroupId,
        status: row.ad_group_ad?.status ?? "UNKNOWN",
        type: ad?.type ?? "UNKNOWN",
        headlines: (rsa?.headlines ?? []).map((h: any) => h.text ?? ""),
        descriptions: (rsa?.descriptions ?? []).map((d: any) => d.text ?? ""),
        finalUrls: ad?.final_urls ?? [],
      };
    });
  } catch (error) {
    console.error("[Google Ads] Ошибка получения объявлений:", error);
    throw new GoogleAdsError("Не удалось получить объявления", error);
  }
}

/**
 * Создаёт адаптивное поисковое объявление (RSA).
 * @param adGroupId - ID группы объявлений
 * @param headlines - Заголовки (минимум 3, максимум 15, каждый до 30 символов)
 * @param descriptions - Описания (минимум 2, максимум 4, каждые до 90 символов)
 * @param finalUrl - URL целевой страницы
 * @returns Resource name созданного объявления
 */
export async function createResponsiveSearchAd(
  adGroupId: string,
  headlines: string[],
  descriptions: string[],
  finalUrl: string
): Promise<string> {
  if (headlines.length < 3) {
    throw new GoogleAdsError("Минимум 3 заголовка необходимо для RSA");
  }
  if (headlines.length > 15) {
    throw new GoogleAdsError("Максимум 15 заголовков для RSA");
  }
  if (descriptions.length < 2) {
    throw new GoogleAdsError("Минимум 2 описания необходимо для RSA");
  }
  if (descriptions.length > 4) {
    throw new GoogleAdsError("Максимум 4 описания для RSA");
  }

  try {
    const customer = getCustomer();

    const response = await customer.mutateResources([
      {
        entity: "ad_group_ad",
        operation: "create",
        resource: {
          ad_group: `customers/${CUSTOMER_ID}/adGroups/${adGroupId}`,
          status: enums.AdGroupAdStatus.PAUSED,
          ad: {
            responsive_search_ad: {
              headlines: headlines.map((text, index) => ({
                text,
                // Закрепляем первый заголовок на позиции 1
                pinned_field:
                  index === 0
                    ? enums.ServedAssetFieldType.HEADLINE_1
                    : enums.ServedAssetFieldType.UNSPECIFIED,
              })),
              descriptions: descriptions.map((text) => ({
                text,
              })),
            },
            final_urls: [finalUrl],
          },
        },
      },
    ]);

    const results = response.mutate_operation_responses ?? [];
    return results[0]?.ad_group_ad_result?.resource_name ?? "";
  } catch (error) {
    console.error("[Google Ads] Ошибка создания RSA:", error);
    throw new GoogleAdsError("Не удалось создать адаптивное поисковое объявление", error);
  }
}

// ---------------------------------------------------------------------------
// Ключевые слова
// ---------------------------------------------------------------------------

/**
 * Добавляет ключевые слова в группу объявлений.
 * @param adGroupId - ID группы объявлений
 * @param keywords - Массив ключевых слов с типом соответствия
 * @returns Массив resource names добавленных ключевых слов
 */
export async function addKeywords(
  adGroupId: string,
  keywords: KeywordInput[]
): Promise<string[]> {
  if (!keywords.length) {
    return [];
  }

  try {
    const customer = getCustomer();

    const matchTypeMap: Record<KeywordMatchTypeInput, number> = {
      BROAD: enums.KeywordMatchType.BROAD,
      PHRASE: enums.KeywordMatchType.PHRASE,
      EXACT: enums.KeywordMatchType.EXACT,
    };

    const mutations: MutateOperation<any>[] = keywords.map(
      (kw, index) => ({
        entity: "ad_group_criterion" as const,
        operation: "create" as const,
        resource: {
          ad_group: `customers/${CUSTOMER_ID}/adGroups/${adGroupId}`,
          status: enums.AdGroupCriterionStatus.ENABLED,
          keyword: {
            text: kw.text,
            match_type: matchTypeMap[kw.matchType ?? "BROAD"],
          },
        },
      })
    );

    const response = await customer.mutateResources(mutations);

    return (response.mutate_operation_responses ?? []).map(
      (r: any) => r.ad_group_criterion_result?.resource_name ?? ""
    );
  } catch (error) {
    console.error("[Google Ads] Ошибка добавления ключевых слов:", error);
    throw new GoogleAdsError("Не удалось добавить ключевые слова", error);
  }
}

// ---------------------------------------------------------------------------
// Отчёты
// ---------------------------------------------------------------------------

/**
 * Строит WHERE-условие для диапазона дат в GAQL.
 */
function buildDateClause(dateRange?: DateRange): string {
  if (!dateRange) {
    return "segments.date DURING LAST_30_DAYS";
  }
  if (dateRange.dateConstant) {
    return `segments.date DURING ${dateRange.dateConstant}`;
  }
  if (dateRange.from && dateRange.to) {
    return `segments.date BETWEEN '${dateRange.from}' AND '${dateRange.to}'`;
  }
  return "segments.date DURING LAST_30_DAYS";
}

/**
 * Преобразует строку GAQL-отчёта в PerformanceReportRow.
 */
function parseReportRow(row: any): PerformanceReportRow {
  return {
    date: row.segments?.date ?? undefined,
    campaignId: row.campaign?.id ? String(row.campaign.id) : undefined,
    campaignName: row.campaign?.name ?? undefined,
    impressions: Number(row.metrics?.impressions ?? 0),
    clicks: Number(row.metrics?.clicks ?? 0),
    costMicros: Number(row.metrics?.cost_micros ?? 0),
    cost: fromMicros(Number(row.metrics?.cost_micros ?? 0)),
    conversions: Number(row.metrics?.conversions ?? 0),
    ctr: Number(row.metrics?.ctr ?? 0),
    averageCpc: fromMicros(Number(row.metrics?.average_cpc ?? 0)),
    conversionsValue: Number(row.metrics?.conversions_value ?? 0),
  };
}

/**
 * Получает отчёт о производительности кампании по дням.
 * @param campaignId - ID кампании
 * @param dateRange - Диапазон дат (по умолчанию LAST_30_DAYS)
 * @returns Массив строк отчёта по дням
 */
export async function getCampaignReport(
  campaignId: string,
  dateRange?: DateRange
): Promise<PerformanceReportRow[]> {
  try {
    const customer = getCustomer();
    const dateClause = buildDateClause(dateRange);

    const rows = await customer.query(`
      SELECT
        segments.date,
        campaign.id,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.ctr,
        metrics.average_cpc
      FROM campaign
      WHERE campaign.id = ${campaignId}
        AND ${dateClause}
      ORDER BY segments.date DESC
    `);

    return rows.map(parseReportRow);
  } catch (error) {
    console.error("[Google Ads] Ошибка получения отчёта кампании:", error);
    throw new GoogleAdsError("Не удалось получить отчёт кампании", error);
  }
}

/**
 * Получает отчёт о производительности всего аккаунта по дням.
 * @param dateRange - Диапазон дат (по умолчанию LAST_30_DAYS)
 * @returns Массив строк отчёта по дням
 */
export async function getAccountReport(
  dateRange?: DateRange
): Promise<PerformanceReportRow[]> {
  try {
    const customer = getCustomer();
    const dateClause = buildDateClause(dateRange);

    const rows = await customer.query(`
      SELECT
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.ctr,
        metrics.average_cpc
      FROM customer
      WHERE ${dateClause}
      ORDER BY segments.date DESC
    `);

    return rows.map(parseReportRow);
  } catch (error) {
    console.error("[Google Ads] Ошибка получения отчёта аккаунта:", error);
    throw new GoogleAdsError("Не удалось получить отчёт аккаунта", error);
  }
}

// ---------------------------------------------------------------------------
// Конверсии
// ---------------------------------------------------------------------------

/**
 * Получает список всех действий конверсии в аккаунте.
 * @returns Массив конверсионных действий
 */
export async function listConversions(): Promise<ConversionActionData[]> {
  try {
    const customer = getCustomer();

    const rows = await customer.query(`
      SELECT
        conversion_action.id,
        conversion_action.name,
        conversion_action.category,
        conversion_action.type,
        conversion_action.status
      FROM conversion_action
      WHERE conversion_action.status != 'REMOVED'
      ORDER BY conversion_action.name
    `);

    return rows.map((row: any) => ({
      id: String(row.conversion_action?.id ?? ""),
      name: row.conversion_action?.name ?? "",
      category: row.conversion_action?.category ?? "UNKNOWN",
      type: row.conversion_action?.type ?? "UNKNOWN",
      status: row.conversion_action?.status ?? "UNKNOWN",
    }));
  } catch (error) {
    console.error("[Google Ads] Ошибка получения конверсий:", error);
    throw new GoogleAdsError("Не удалось получить список конверсий", error);
  }
}

/**
 * Создаёт новое действие конверсии.
 * @param name - Название действия конверсии
 * @param category - Категория: DEFAULT, PAGE_VIEW, PURCHASE, SIGNUP, DOWNLOAD и др.
 * @param type - Тип: WEBPAGE, UPLOAD_CLICKS, AD_CALL и др.
 * @returns Resource name созданного действия конверсии
 */
export async function createConversionAction(
  name: string,
  category: keyof typeof enums.ConversionActionCategory = "DEFAULT",
  type: keyof typeof enums.ConversionActionType = "WEBPAGE"
): Promise<string> {
  try {
    const customer = getCustomer();

    const response = await customer.mutateResources([
      {
        entity: "conversion_action",
        operation: "create",
        resource: {
          name,
          category: enums.ConversionActionCategory[category],
          type: enums.ConversionActionType[type],
          status: enums.ConversionActionStatus.ENABLED,
          value_settings: {
            default_value: 1,
            always_use_default_value: false,
          },
        },
      },
    ]);

    const results = response.mutate_operation_responses ?? [];
    return results[0]?.conversion_action_result?.resource_name ?? "";
  } catch (error) {
    console.error("[Google Ads] Ошибка создания конверсии:", error);
    throw new GoogleAdsError("Не удалось создать действие конверсии", error);
  }
}

// ---------------------------------------------------------------------------
// Обработка ошибок
// ---------------------------------------------------------------------------

/**
 * Кастомный класс ошибок для Google Ads API.
 * Оборачивает оригинальную ошибку и добавляет понятное сообщение.
 */
export class GoogleAdsError extends Error {
  public readonly originalError: unknown;

  constructor(message: string, originalError?: unknown) {
    super(message);
    this.name = "GoogleAdsError";
    this.originalError = originalError;

    // Извлекаем детали ошибки из Google Ads API, если они есть
    if (originalError && typeof originalError === "object") {
      const err = originalError as any;
      if (err.errors?.length) {
        const details = err.errors
          .map((e: any) => e.message || e.error_code || JSON.stringify(e))
          .join("; ");
        this.message = `${message}: ${details}`;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Утилиты (реэкспорт)
// ---------------------------------------------------------------------------

export { toMicros, fromMicros, enums };
