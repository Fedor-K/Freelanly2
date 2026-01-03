/**
 * Analytics Configuration
 *
 * Центральный файл для всех счётчиков и событий аналитики.
 */

// ============================================
// CONFIGURATION
// ============================================

export const analyticsConfig = {
  // Яндекс.Метрика
  yandexMetrika: {
    id: '103606747',
    enabled: true,
  },

  // Google Analytics 4
  googleAnalytics: {
    id: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '',
    enabled: !!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  },

  // Microsoft Clarity (бесплатные записи сессий)
  clarity: {
    id: process.env.NEXT_PUBLIC_CLARITY_ID || 'uqwmja72lg',
    enabled: true,
  },
};

// ============================================
// EVENT TYPES
// ============================================

export type AnalyticsEvent =
  // Job events
  | { name: 'job_view'; params: { job_id: string; job_title: string; category: string; company: string } }
  | { name: 'job_apply_click'; params: { job_id: string; method: 'email' | 'url' | 'linkedin' } }
  | { name: 'job_save'; params: { job_id: string } }
  | { name: 'job_share'; params: { job_id: string; platform: 'twitter' | 'linkedin' | 'telegram' | 'whatsapp' | 'copy' } }
  | { name: 'job_search'; params: { query: string; results_count?: number } }
  | { name: 'job_filter'; params: { category?: string; level?: string; type?: string } }

  // User events
  | { name: 'signup'; params: { method: 'email' | 'google' | 'github' | 'linkedin' } }
  | { name: 'login'; params: { method: 'email' | 'google' | 'github' | 'linkedin' } }
  | { name: 'job_alert_subscribe'; params: { category?: string; keywords?: string; source?: string } }
  | { name: 'job_alert_unsubscribe'; params: Record<string, never> }

  // Conversion events
  | { name: 'registration_modal_open'; params: { job_id: string } }
  | { name: 'upgrade_modal_open'; params: { job_id: string } }
  | { name: 'upgrade_click'; params: { source: 'paywall' | 'pricing' | 'banner' | 'email' } }
  | { name: 'upgrade_complete'; params: { plan: 'pro' | 'enterprise'; amount: number } }
  | { name: 'trial_start'; params: { plan: 'pro' } }

  // Engagement events
  | { name: 'page_scroll'; params: { depth: 25 | 50 | 75 | 100 } }
  | { name: 'time_on_page'; params: { seconds: number } }
  | { name: 'company_view'; params: { company_id: string; company_name: string } }
  | { name: 'salary_insights_view'; params: { job_id: string } }

  // Error events
  | { name: 'error'; params: { type: string; message: string; page: string } };

// ============================================
// TRACK FUNCTION
// ============================================

declare global {
  interface Window {
    // Yandex.Metrika has different signatures for different methods:
    // - reachGoal: (id, 'reachGoal', goalName, params)
    // - hit: (id, 'hit', url, options)
    // - userParams: (id, 'userParams', paramsObject)
    ym?: (id: number, action: string, ...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
  }
}

/**
 * Отправляет событие во все подключённые системы аналитики
 */
export function track<E extends AnalyticsEvent>(event: E): void {
  if (typeof window === 'undefined') return;

  const { name, params } = event;

  // Яндекс.Метрика
  if (analyticsConfig.yandexMetrika.enabled && window.ym) {
    window.ym(
      parseInt(analyticsConfig.yandexMetrika.id),
      'reachGoal',
      name,
      params
    );
  }

  // Google Analytics 4
  if (analyticsConfig.googleAnalytics.enabled && window.gtag) {
    window.gtag('event', name, params);
  }

  // Console log in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics]', name, params);
  }
}

// ============================================
// GOAL DEFINITIONS (для настройки в Метрике/GA)
// ============================================

/**
 * Цели для настройки в Яндекс.Метрике
 *
 * Админка → Цели → Добавить цель → JavaScript-событие
 */
export const yandexGoals = {
  // 🔴 Критичные (влияют на revenue)
  job_alert_subscribe: 'Подписка на job alerts',
  job_apply_click: 'Клик на "Apply"',
  upgrade_click: 'Клик на upgrade',
  upgrade_complete: 'Успешный апгрейд',
  signup: 'Регистрация',

  // 🟡 Важные (engagement)
  job_view: 'Просмотр вакансии',
  job_save: 'Сохранение вакансии',
  job_search: 'Поиск вакансий',

  // 🟢 Дополнительные
  job_share: 'Шаринг вакансии',
  company_view: 'Просмотр компании',
};

/**
 * Конверсии для Google Analytics 4
 *
 * Admin → Events → Mark as conversion
 */
export const ga4Conversions = [
  'job_alert_subscribe',
  'job_apply_click',
  'upgrade_click',
  'upgrade_complete',
  'signup',
];

// ============================================
// PAGEVIEW TRACKING
// ============================================

/**
 * Трекинг просмотра страницы (вызывается в layout)
 */
export function trackPageView(url: string, title: string): void {
  if (typeof window === 'undefined') return;

  // Яндекс.Метрика (автоматически через SPA режим)
  if (analyticsConfig.yandexMetrika.enabled && window.ym) {
    window.ym(parseInt(analyticsConfig.yandexMetrika.id), 'hit', url, {
      title,
    });
  }

  // GA4 (автоматически если настроен enhanced measurement)
  if (analyticsConfig.googleAnalytics.enabled && window.gtag) {
    window.gtag('config', analyticsConfig.googleAnalytics.id, {
      page_path: url,
      page_title: title,
    });
  }
}

// ============================================
// USER IDENTIFICATION
// ============================================

/**
 * Связывает анонимного пользователя с аккаунтом после логина
 */
export function identifyUser(userId: string, traits?: { email?: string; plan?: string }): void {
  if (typeof window === 'undefined') return;

  // Яндекс.Метрика
  if (analyticsConfig.yandexMetrika.enabled && window.ym) {
    window.ym(parseInt(analyticsConfig.yandexMetrika.id), 'userParams', {
      UserID: userId,
      ...traits,
    });
  }

  // GA4
  if (analyticsConfig.googleAnalytics.enabled && window.gtag) {
    window.gtag('set', 'user_properties', {
      user_id: userId,
      ...traits,
    });
  }
}
