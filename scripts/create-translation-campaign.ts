/**
 * Создание Search-кампании "Freelanly Translation Jobs"
 * Бюджет уже создан: customers/9737618327/campaignBudgets/15446510528
 *
 * Запуск: npx tsx scripts/create-translation-campaign.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import {
  createCampaign,
  createAdGroup,
  addKeywords,
  createResponsiveSearchAd,
  type KeywordInput,
} from '../src/lib/google-ads';

const EXISTING_BUDGET = 'customers/9737618327/campaignBudgets/15446510528';

async function main() {
  console.log('=== Создание кампании Freelanly Translation Jobs ===\n');

  // 1. Создать кампанию (используя существующий бюджет €3/day)
  console.log('1. Создаю кампанию...');
  const campaign = await createCampaign(
    'Freelanly Translation Jobs',
    3, // не используется т.к. existingBudgetResourceName
    'SEARCH',
    {
      biddingStrategy: 'manual_cpc',
      existingBudgetResourceName: EXISTING_BUDGET,
      networkSettings: {
        targetGoogleSearch: true,
        targetSearchNetwork: true,
        targetContentNetwork: false,
      },
    }
  );
  console.log('   Кампания:', campaign.campaignResourceName);

  // Извлекаем ID кампании
  const campaignId = campaign.campaignResourceName.split('/').pop()!;
  console.log('   Campaign ID:', campaignId);

  // 2. Создать ad group с CPC €0.30
  console.log('\n2. Создаю группу объявлений...');
  const adGroupResource = await createAdGroup(
    campaignId,
    'Translation Keywords',
    300000 // €0.30 in micros
  );
  const adGroupId = adGroupResource.split('/').pop()!;
  console.log('   Ad Group:', adGroupResource);
  console.log('   Ad Group ID:', adGroupId);

  // 3. Добавить ключевые слова
  console.log('\n3. Добавляю ключевые слова...');
  const keywords: KeywordInput[] = [
    { text: 'remote translation jobs', matchType: 'PHRASE' },
    { text: 'freelance translation work', matchType: 'PHRASE' },
    { text: 'online translation jobs', matchType: 'PHRASE' },
    { text: 'translation jobs from home', matchType: 'PHRASE' },
    { text: 'remote translator jobs', matchType: 'PHRASE' },
    { text: 'freelance translator work', matchType: 'PHRASE' },
    { text: 'remote localization jobs', matchType: 'PHRASE' },
    { text: 'translation work online', matchType: 'PHRASE' },
    { text: 'remote interpreter jobs', matchType: 'PHRASE' },
    { text: 'work from home translation', matchType: 'PHRASE' },
    { text: 'remote subtitling jobs', matchType: 'PHRASE' },
  ];

  const keywordResults = await addKeywords(adGroupId, keywords);
  console.log(`   Добавлено ${keywordResults.length} ключевых слов`);

  // 4. Создать Responsive Search Ad
  console.log('\n4. Создаю объявление...');
  const headlines = [
    'Remote Translation Jobs',
    'Freelance Translator Work',
    '13,000+ Remote Jobs',
    'Apply Direct to Companies',
    'Translation Jobs Online',
    'Work From Home Today',
    'No Middlemen — Direct',
    'New Jobs Every Day',
    'Start Translating Now',
    'Remote Localization Jobs',
    'Freelanly.com',
    'Get Hired as Translator',
    'Join 5000+ Translators',
    'Translation & Subtitling',
    'Instant Job Alerts',
  ];

  const descriptions = [
    'Find remote translation, localization & subtitling jobs. Apply directly to companies — no agencies.',
    'Browse 13,000+ remote jobs. Get instant alerts for new translation opportunities. Free to sign up.',
    'Direct contact with hiring managers. Apply before others see the job. From €0.39/day.',
    'Remote translation jobs updated daily. Set up alerts and never miss an opportunity.',
  ];

  const adResource = await createResponsiveSearchAd(
    adGroupId,
    headlines,
    descriptions,
    'https://freelanly.com/freelance?category=translation&utm_source=google&utm_medium=cpc&utm_campaign=translation_jobs'
  );
  console.log('   Объявление:', adResource);

  console.log('\n=== Готово! Кампания создана в статусе PAUSED ===');
  console.log('Включите через админку или Google Ads когда будете готовы.');
}

main().catch((err) => {
  console.error('\nОшибка:', err);
  process.exit(1);
});
