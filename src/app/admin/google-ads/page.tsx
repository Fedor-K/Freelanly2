'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Megaphone,
  Plus,
  Play,
  Pause,
  Trash2,
  ChevronRight,
  ArrowLeft,
  DollarSign,
  MousePointerClick,
  Eye,
  Target,
  RefreshCw,
  Loader2,
} from 'lucide-react';

// ============================================
// ТИПЫ
// ============================================

interface Campaign {
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

interface AdGroup {
  id: string;
  name: string;
  status: string;
  campaignId: string;
  cpcBidMicros: number;
  cpcBid: number;
}

interface Ad {
  id: string;
  adGroupId: string;
  status: string;
  type: string;
  headlines: string[];
  descriptions: string[];
  finalUrls: string[];
}

interface AssetGroup {
  id: string;
  name: string;
  status: string;
  path1: string;
  path2: string;
  headlines: string[];
  descriptions: string[];
  longHeadlines: string[];
}

interface ReportRow {
  date?: string;
  impressions: number;
  clicks: number;
  costMicros: number;
  cost: number;
  conversions: number;
  ctr: number;
  averageCpc: number;
}

type View = 'campaigns' | 'ad-groups' | 'asset-groups' | 'ads' | 'create-campaign' | 'create-ad-group' | 'create-ad';

// ============================================
// API HELPERS
// ============================================

async function api(method: string, params?: Record<string, string> | object) {
  const isGet = method === 'GET';
  const url = isGet
    ? `/api/admin/google-ads?${new URLSearchParams(params as Record<string, string>)}`
    : '/api/admin/google-ads';

  const res = await fetch(url, {
    method: isGet ? 'GET' : method,
    ...(isGet ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// ============================================
// УТИЛИТЫ
// ============================================

function formatCurrency(amount: number) {
  return `€${amount.toFixed(2)}`;
}

function formatNumber(n: number) {
  return n.toLocaleString('en-US');
}

function formatPercent(n: number) {
  return `${(n * 100).toFixed(2)}%`;
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    ENABLED: 'bg-green-100 text-green-700',
    PAUSED: 'bg-yellow-100 text-yellow-700',
    REMOVED: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}

// ============================================
// STAT CARD
// ============================================

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

// ============================================
// ГЛАВНАЯ СТРАНИЦА
// ============================================

export default function GoogleAdsPage() {
  const [view, setView] = useState<View>('campaigns');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [adGroups, setAdGroups] = useState<AdGroup[]>([]);
  const [assetGroups, setAssetGroups] = useState<AssetGroup[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [selectedAdGroup, setSelectedAdGroup] = useState<AdGroup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  // Загрузка кампаний
  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api('GET', { action: 'campaigns' });
      setCampaigns(data.campaigns);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  // Загрузка групп объявлений / ассетов (зависит от типа кампании)
  const loadAdGroups = async (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setLoading(true);
    setError('');

    if (campaign.channelType === 'PERFORMANCE_MAX') {
      setView('asset-groups');
      try {
        const data = await api('GET', { action: 'asset-groups', campaignId: campaign.id });
        setAssetGroups(data.assetGroups);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load asset groups');
      } finally {
        setLoading(false);
      }
    } else {
      setView('ad-groups');
      try {
        const data = await api('GET', { action: 'ad-groups', campaignId: campaign.id });
        setAdGroups(data.adGroups);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load ad groups');
      } finally {
        setLoading(false);
      }
    }
  };

  // Загрузка объявлений
  const loadAds = async (adGroup: AdGroup) => {
    setSelectedAdGroup(adGroup);
    setView('ads');
    setLoading(true);
    setError('');
    try {
      const data = await api('GET', { action: 'ads', adGroupId: adGroup.id });
      setAds(data.ads);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load ads');
    } finally {
      setLoading(false);
    }
  };

  // Обновить статус кампании
  const toggleCampaignStatus = async (campaign: Campaign) => {
    const newStatus = campaign.status === 'ENABLED' ? 'PAUSED' : 'ENABLED';
    setActionLoading(campaign.id);
    try {
      await api('PUT', { action: 'update-campaign-status', campaignId: campaign.id, status: newStatus });
      await loadCampaigns();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setActionLoading('');
    }
  };

  // Суммарная статистика
  const totals = campaigns.reduce(
    (acc, c) => ({
      impressions: acc.impressions + c.impressions,
      clicks: acc.clicks + c.clicks,
      cost: acc.cost + c.cost,
      conversions: acc.conversions + c.conversions,
    }),
    { impressions: 0, clicks: 0, cost: 0, conversions: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {view !== 'campaigns' && (
            <button
              onClick={() => {
                if (view === 'ads') setView('ad-groups');
                else if (view === 'asset-groups') setView('campaigns');
                else setView('campaigns');
              }}
              className="p-2 hover:bg-muted rounded-lg"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Megaphone className="h-6 w-6 text-primary" />
              Google Ads
            </h1>
            <p className="text-sm text-muted-foreground">
              {view === 'campaigns' && 'Управление рекламными кампаниями'}
              {view === 'ad-groups' && `Группы объявлений — ${selectedCampaign?.name}`}
              {view === 'asset-groups' && `Группы ассетов — ${selectedCampaign?.name}`}
              {view === 'ads' && `Объявления — ${selectedAdGroup?.name}`}
              {view === 'create-campaign' && 'Новая кампания'}
              {view === 'create-ad-group' && 'Новая группа объявлений'}
              {view === 'create-ad' && 'Новое объявление'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={loadCampaigns} className="p-2 hover:bg-muted rounded-lg" title="Обновить">
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {view === 'campaigns' && (
            <button
              onClick={() => setView('create-campaign')}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Новая кампания
            </button>
          )}
          {view === 'ad-groups' && (
            <button
              onClick={() => setView('create-ad-group')}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Новая группа
            </button>
          )}
          {view === 'ads' && (
            <button
              onClick={() => setView('create-ad')}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Новое объявление
            </button>
          )}
        </div>
      </div>

      {/* Ошибка */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">Закрыть</button>
        </div>
      )}

      {/* Суммарная статистика */}
      {view === 'campaigns' && campaigns.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard icon={Eye} label="Показы" value={formatNumber(totals.impressions)} />
          <StatCard icon={MousePointerClick} label="Клики" value={formatNumber(totals.clicks)} sub={totals.impressions > 0 ? `CTR: ${formatPercent(totals.clicks / totals.impressions)}` : ''} />
          <StatCard icon={DollarSign} label="Расходы" value={formatCurrency(totals.cost)} sub={totals.clicks > 0 ? `CPC: ${formatCurrency(totals.cost / totals.clicks)}` : ''} />
          <StatCard icon={Target} label="Конверсии" value={formatNumber(totals.conversions)} sub={totals.clicks > 0 ? `CR: ${formatPercent(totals.conversions / totals.clicks)}` : ''} />
        </div>
      )}

      {/* Контент */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Список кампаний */}
          {view === 'campaigns' && (
            <div className="bg-card border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Кампания</th>
                    <th className="text-left p-3 font-medium">Статус</th>
                    <th className="text-left p-3 font-medium">Тип</th>
                    <th className="text-right p-3 font-medium">Бюджет/день</th>
                    <th className="text-right p-3 font-medium">Показы</th>
                    <th className="text-right p-3 font-medium">Клики</th>
                    <th className="text-right p-3 font-medium">Расходы</th>
                    <th className="text-right p-3 font-medium">Conv</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => loadAdGroups(c)}>
                      <td className="p-3 font-medium">{c.name}</td>
                      <td className="p-3">{statusBadge(c.status)}</td>
                      <td className="p-3 text-muted-foreground">{c.channelType}</td>
                      <td className="p-3 text-right">{formatCurrency(c.budgetAmount)}</td>
                      <td className="p-3 text-right">{formatNumber(c.impressions)}</td>
                      <td className="p-3 text-right">{formatNumber(c.clicks)}</td>
                      <td className="p-3 text-right">{formatCurrency(c.cost)}</td>
                      <td className="p-3 text-right">{c.conversions}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => toggleCampaignStatus(c)}
                            disabled={actionLoading === c.id}
                            className="p-1.5 hover:bg-muted rounded"
                            title={c.status === 'ENABLED' ? 'Приостановить' : 'Включить'}
                          >
                            {actionLoading === c.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : c.status === 'ENABLED' ? (
                              <Pause className="h-4 w-4 text-yellow-600" />
                            ) : (
                              <Play className="h-4 w-4 text-green-600" />
                            )}
                          </button>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {campaigns.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground">
                        Нет кампаний. Создайте первую кампанию.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Список групп объявлений */}
          {view === 'ad-groups' && (
            <div className="bg-card border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Группа объявлений</th>
                    <th className="text-left p-3 font-medium">Статус</th>
                    <th className="text-right p-3 font-medium">CPC ставка</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {adGroups.map((ag) => (
                    <tr key={ag.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => loadAds(ag)}>
                      <td className="p-3 font-medium">{ag.name}</td>
                      <td className="p-3">{statusBadge(ag.status)}</td>
                      <td className="p-3 text-right">{formatCurrency(ag.cpcBid)}</td>
                      <td className="p-3">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </td>
                    </tr>
                  ))}
                  {adGroups.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted-foreground">
                        Нет групп объявлений. Создайте первую группу.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Список групп ассетов (PMax) */}
          {view === 'asset-groups' && (
            <div className="space-y-4">
              {assetGroups.map((ag) => (
                <div key={ag.id} className="bg-card border rounded-lg p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{ag.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Display URL: freelanly.com/{ag.path1}{ag.path2 ? `/${ag.path2}` : ''}
                      </p>
                    </div>
                    {statusBadge(ag.status)}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Headlines */}
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">
                        Заголовки ({ag.headlines.length})
                      </h4>
                      <div className="space-y-1">
                        {ag.headlines.map((h, i) => (
                          <div key={i} className="text-sm bg-muted/30 rounded px-2 py-1">{h}</div>
                        ))}
                      </div>
                    </div>

                    {/* Long Headlines */}
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">
                        Длинные заголовки ({ag.longHeadlines.length})
                      </h4>
                      <div className="space-y-1">
                        {ag.longHeadlines.map((lh, i) => (
                          <div key={i} className="text-sm bg-muted/30 rounded px-2 py-1">{lh}</div>
                        ))}
                      </div>
                    </div>

                    {/* Descriptions */}
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">
                        Описания ({ag.descriptions.length})
                      </h4>
                      <div className="space-y-1">
                        {ag.descriptions.map((d, i) => (
                          <div key={i} className="text-sm bg-muted/30 rounded px-2 py-1">{d}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {assetGroups.length === 0 && (
                <div className="bg-card border rounded-lg p-8 text-center text-muted-foreground">
                  Нет групп ассетов.
                </div>
              )}
            </div>
          )}

          {/* Список объявлений */}
          {view === 'ads' && (
            <div className="space-y-4">
              {ads.map((ad) => (
                <div key={ad.id} className="bg-card border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">ID: {ad.id} • {ad.type}</span>
                    {statusBadge(ad.status)}
                  </div>
                  <div className="space-y-1">
                    {ad.headlines.map((h, i) => (
                      <div key={i} className="text-blue-600 font-medium text-lg">{h}</div>
                    ))}
                    <div className="text-green-700 text-sm">{ad.finalUrls[0]}</div>
                    {ad.descriptions.map((d, i) => (
                      <div key={i} className="text-sm text-muted-foreground">{d}</div>
                    ))}
                  </div>
                </div>
              ))}
              {ads.length === 0 && (
                <div className="bg-card border rounded-lg p-8 text-center text-muted-foreground">
                  Нет объявлений. Создайте первое объявление.
                </div>
              )}
            </div>
          )}

          {/* Форма создания кампании */}
          {view === 'create-campaign' && (
            <CreateCampaignForm
              onSuccess={() => { setView('campaigns'); loadCampaigns(); }}
              onCancel={() => setView('campaigns')}
            />
          )}

          {/* Форма создания группы объявлений */}
          {view === 'create-ad-group' && selectedCampaign && (
            <CreateAdGroupForm
              campaignId={selectedCampaign.id}
              campaignName={selectedCampaign.name}
              onSuccess={() => { setView('ad-groups'); loadAdGroups(selectedCampaign); }}
              onCancel={() => setView('ad-groups')}
            />
          )}

          {/* Форма создания объявления */}
          {view === 'create-ad' && selectedAdGroup && (
            <CreateAdForm
              adGroupId={selectedAdGroup.id}
              adGroupName={selectedAdGroup.name}
              onSuccess={() => { setView('ads'); loadAds(selectedAdGroup); }}
              onCancel={() => setView('ads')}
            />
          )}
        </>
      )}
    </div>
  );
}

// ============================================
// ФОРМА: СОЗДАНИЕ КАМПАНИИ
// ============================================

function CreateCampaignForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [dailyBudget, setDailyBudget] = useState('10');
  const [channelType, setChannelType] = useState('SEARCH');
  const [biddingStrategy, setBiddingStrategy] = useState('manual_cpc');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api('POST', {
        action: 'create-campaign',
        name,
        dailyBudget: parseFloat(dailyBudget),
        channelType,
        settings: { biddingStrategy },
      });
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-card border rounded-lg p-6 max-w-lg">
      <h2 className="text-lg font-bold mb-4">Новая кампания</h2>
      {error && <div className="bg-red-50 text-red-700 rounded p-3 mb-4 text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Название</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Remote Jobs — Search"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Дневной бюджет (EUR)</label>
          <input
            type="number"
            value={dailyBudget}
            onChange={(e) => setDailyBudget(e.target.value)}
            required
            min="1"
            step="0.01"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Тип кампании</label>
          <select value={channelType} onChange={(e) => setChannelType(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="SEARCH">Search</option>
            <option value="DISPLAY">Display</option>
            <option value="PERFORMANCE_MAX">Performance Max</option>
            <option value="VIDEO">Video</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Стратегия ставок</label>
          <select value={biddingStrategy} onChange={(e) => setBiddingStrategy(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="manual_cpc">Manual CPC</option>
            <option value="maximize_clicks">Maximize Clicks</option>
            <option value="maximize_conversions">Maximize Conversions</option>
            <option value="target_cpa">Target CPA</option>
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || !name}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Создать (на паузе)
          </button>
          <button type="button" onClick={onCancel} className="px-4 py-2 border rounded-lg hover:bg-muted">
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================
// ФОРМА: СОЗДАНИЕ ГРУППЫ ОБЪЯВЛЕНИЙ
// ============================================

function CreateAdGroupForm({
  campaignId,
  campaignName,
  onSuccess,
  onCancel,
}: {
  campaignId: string;
  campaignName: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [cpcBid, setCpcBid] = useState('1.00');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api('POST', {
        action: 'create-ad-group',
        campaignId,
        name,
        cpcBidMicros: Math.round(parseFloat(cpcBid) * 1_000_000),
      });
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create ad group');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-card border rounded-lg p-6 max-w-lg">
      <h2 className="text-lg font-bold mb-1">Новая группа объявлений</h2>
      <p className="text-sm text-muted-foreground mb-4">Кампания: {campaignName}</p>
      {error && <div className="bg-red-50 text-red-700 rounded p-3 mb-4 text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Название</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Remote Jobs — Keywords"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Max CPC ставка (EUR)</label>
          <input
            type="number"
            value={cpcBid}
            onChange={(e) => setCpcBid(e.target.value)}
            required
            min="0.01"
            step="0.01"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || !name}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Создать
          </button>
          <button type="button" onClick={onCancel} className="px-4 py-2 border rounded-lg hover:bg-muted">
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================
// ФОРМА: СОЗДАНИЕ ОБЪЯВЛЕНИЯ (RSA)
// ============================================

function CreateAdForm({
  adGroupId,
  adGroupName,
  onSuccess,
  onCancel,
}: {
  adGroupId: string;
  adGroupName: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [headlines, setHeadlines] = useState(['', '', '']);
  const [descriptions, setDescriptions] = useState(['', '']);
  const [finalUrl, setFinalUrl] = useState('https://freelanly.com');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const addHeadline = () => {
    if (headlines.length < 15) setHeadlines([...headlines, '']);
  };

  const addDescription = () => {
    if (descriptions.length < 4) setDescriptions([...descriptions, '']);
  };

  const updateHeadline = (index: number, value: string) => {
    const updated = [...headlines];
    updated[index] = value;
    setHeadlines(updated);
  };

  const updateDescription = (index: number, value: string) => {
    const updated = [...descriptions];
    updated[index] = value;
    setDescriptions(updated);
  };

  const removeHeadline = (index: number) => {
    if (headlines.length > 3) setHeadlines(headlines.filter((_, i) => i !== index));
  };

  const removeDescription = (index: number) => {
    if (descriptions.length > 2) setDescriptions(descriptions.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validHeadlines = headlines.filter(Boolean);
    const validDescriptions = descriptions.filter(Boolean);

    if (validHeadlines.length < 3) { setError('Минимум 3 заголовка'); return; }
    if (validDescriptions.length < 2) { setError('Минимум 2 описания'); return; }

    setSubmitting(true);
    setError('');
    try {
      await api('POST', {
        action: 'create-ad',
        adGroupId,
        headlines: validHeadlines,
        descriptions: validDescriptions,
        finalUrl,
      });
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create ad');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-card border rounded-lg p-6 max-w-2xl">
      <h2 className="text-lg font-bold mb-1">Новое объявление (RSA)</h2>
      <p className="text-sm text-muted-foreground mb-4">Группа: {adGroupName}</p>
      {error && <div className="bg-red-50 text-red-700 rounded p-3 mb-4 text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Заголовки */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Заголовки (мин. 3, макс. 15, до 30 символов)</label>
            {headlines.length < 15 && (
              <button type="button" onClick={addHeadline} className="text-xs text-primary hover:underline">+ Добавить</button>
            )}
          </div>
          <div className="space-y-2">
            {headlines.map((h, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={h}
                  onChange={(e) => updateHeadline(i, e.target.value)}
                  maxLength={30}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                  placeholder={`Заголовок ${i + 1}`}
                />
                <span className="text-xs text-muted-foreground self-center w-8">{h.length}/30</span>
                {headlines.length > 3 && (
                  <button type="button" onClick={() => removeHeadline(i)} className="p-2 hover:bg-muted rounded">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Описания */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Описания (мин. 2, макс. 4, до 90 символов)</label>
            {descriptions.length < 4 && (
              <button type="button" onClick={addDescription} className="text-xs text-primary hover:underline">+ Добавить</button>
            )}
          </div>
          <div className="space-y-2">
            {descriptions.map((d, i) => (
              <div key={i} className="flex gap-2">
                <textarea
                  value={d}
                  onChange={(e) => updateDescription(i, e.target.value)}
                  maxLength={90}
                  rows={2}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm resize-none"
                  placeholder={`Описание ${i + 1}`}
                />
                <span className="text-xs text-muted-foreground self-start w-8 pt-2">{d.length}/90</span>
                {descriptions.length > 2 && (
                  <button type="button" onClick={() => removeDescription(i)} className="p-2 hover:bg-muted rounded self-start">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* URL */}
        <div>
          <label className="block text-sm font-medium mb-1">URL целевой страницы</label>
          <input
            type="url"
            value={finalUrl}
            onChange={(e) => setFinalUrl(e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="https://freelanly.com"
          />
        </div>

        {/* Превью */}
        {headlines.filter(Boolean).length >= 1 && (
          <div className="border rounded-lg p-4 bg-muted/30">
            <p className="text-xs text-muted-foreground mb-2">Превью объявления:</p>
            <div className="text-blue-600 font-medium">
              {headlines.filter(Boolean).slice(0, 3).join(' | ')}
            </div>
            <div className="text-green-700 text-sm">{finalUrl}</div>
            <div className="text-sm text-muted-foreground">{descriptions.filter(Boolean)[0]}</div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Создать объявление
          </button>
          <button type="button" onClick={onCancel} className="px-4 py-2 border rounded-lg hover:bg-muted">
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}
