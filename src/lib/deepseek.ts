import OpenAI from 'openai';

// Map invalid/symbol currency codes to valid ISO 4217 codes
// AI sometimes returns currency symbols instead of codes
const CURRENCY_CODE_MAP: Record<string, string> = {
  'RM': 'MYR',      // Malaysian Ringgit
  'Rs': 'INR',      // Indian Rupee
  'Rs.': 'INR',
  '₹': 'INR',
  '₱': 'PHP',       // Philippine Peso
  'R$': 'BRL',      // Brazilian Real
  '¥': 'JPY',       // Japanese Yen (could also be CNY)
  'CN¥': 'CNY',     // Chinese Yuan
  '€': 'EUR',
  '£': 'GBP',
  '$': 'USD',
  'A$': 'AUD',      // Australian Dollar
  'C$': 'CAD',      // Canadian Dollar
  'S$': 'SGD',      // Singapore Dollar
  'HK$': 'HKD',     // Hong Kong Dollar
  'zł': 'PLN',      // Polish Zloty
  'kr': 'SEK',      // Swedish Krona
  'Rp': 'IDR',      // Indonesian Rupiah
  '฿': 'THB',       // Thai Baht
  '₫': 'VND',       // Vietnamese Dong
  '₩': 'KRW',       // Korean Won
};

function normalizeCurrencyCode(code: string | null): string | null {
  if (!code) return null;
  const trimmed = code.trim();
  const upper = trimmed.toUpperCase();
  // Already a valid 3-letter ISO code
  if (/^[A-Z]{3}$/.test(upper)) return upper;
  // Try mapping from symbol/abbreviation
  return CURRENCY_CODE_MAP[trimmed] || CURRENCY_CODE_MAP[upper] || 'USD';
}

// AI Provider configuration
// Set AI_PROVIDER=zai to use Z.ai, default is deepseek
type AIProvider = 'deepseek' | 'zai';

function getAIProvider(): AIProvider {
  // Switch: 'zai' (cheaper) or 'deepseek' (faster/more reliable)
  const provider = process.env.AI_PROVIDER?.toLowerCase();
  if (provider === 'zai') return 'zai';
  return 'deepseek'; // default
}

// Lazy initialization to avoid build-time errors
let _deepseek: OpenAI | null = null;
let _zai: OpenAI | null = null;

function getDeepSeekClient(): OpenAI {
  if (!_deepseek) {
    _deepseek = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY || 'dummy-key-for-build',
      baseURL: 'https://api.deepseek.com/v1',
      timeout: 30000, // 30 second timeout
      maxRetries: 2,
    });
  }
  return _deepseek;
}

function getZaiClient(): OpenAI {
  if (!_zai) {
    _zai = new OpenAI({
      apiKey: process.env.ZAI_API_KEY || 'dummy-key-for-build',
      baseURL: 'https://api.z.ai/api/paas/v4',
      timeout: 15000, // 15 second timeout (faster fail)
      maxRetries: 1,  // 1 retry only
    });
  }
  return _zai;
}

// Get the active AI client based on AI_PROVIDER env var
function getAIClient(): { client: OpenAI; model: string; provider: AIProvider } {
  const provider = getAIProvider();
  if (provider === 'zai') {
    return {
      client: getZaiClient(),
      model: 'glm-4-32b-0414-128k', // $0.10/$0.10 per 1M tokens
      provider: 'zai',
    };
  }
  return {
    client: getDeepSeekClient(),
    model: 'deepseek-chat',
    provider: 'deepseek',
  };
}

// Translation work types
export type TranslationType =
  | 'TRANSLATION'
  | 'INTERPRETATION'
  | 'LOCALIZATION'
  | 'EDITING'
  | 'TRANSCRIPTION'
  | 'SUBTITLING'
  | 'MT_POST_EDITING'
  | 'COPYWRITING';

// Valid translation types for validation
const VALID_TRANSLATION_TYPES: TranslationType[] = [
  'TRANSLATION', 'INTERPRETATION', 'LOCALIZATION', 'EDITING',
  'TRANSCRIPTION', 'SUBTITLING', 'MT_POST_EDITING', 'COPYWRITING'
];

// Filter to only valid translation types (AI sometimes returns invalid values like "TRANSLATION")
function filterValidTranslationTypes(types: unknown): TranslationType[] {
  if (!types || !Array.isArray(types)) return [];
  return types.filter((t): t is TranslationType =>
    typeof t === 'string' && VALID_TRANSLATION_TYPES.includes(t as TranslationType)
  );
}

export interface ExtractedJobData {
  title: string | null;
  company: string | null;
  isRemote: boolean;
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: 'HOUR' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ONE_TIME' | null;
  skills: string[];
  level: 'INTERN' | 'ENTRY' | 'JUNIOR' | 'MID' | 'SENIOR' | 'LEAD' | 'MANAGER' | 'DIRECTOR' | 'EXECUTIVE' | null;
  type: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'FREELANCE' | 'INTERNSHIP' | null;
  benefits: string[];
  contactMethod: 'email' | 'dm' | 'apply_link' | null;
  contactEmail: string | null;
  applyUrl: string | null;
  // Translation-specific fields (populated for translation jobs)
  translationTypes: TranslationType[];
  sourceLanguages: string[];  // ISO 639-1 codes: ["EN", "ES"]
  targetLanguages: string[];  // ISO 639-1 codes: ["RU", "FR"]
  // AI-generated clean description (for SEO and UX)
  cleanDescription: string | null; // Structured readable text with sections
}

// Common languages for translation job title detection (75 languages, synced with site.ts)
const LANGUAGES = [
  // Top 10
  'English', 'Spanish', 'French', 'German', 'Chinese', 'Japanese', 'Arabic', 'Portuguese', 'Russian', 'Korean',
  // Western Europe
  'Italian', 'Dutch', 'Greek', 'Maltese', 'Luxembourgish',
  // Scandinavia
  'Swedish', 'Danish', 'Norwegian', 'Finnish', 'Icelandic',
  // Central Europe
  'Polish', 'Czech', 'Slovak', 'Hungarian', 'Romanian',
  // Balkans
  'Bulgarian', 'Serbian', 'Croatian', 'Slovenian', 'Bosnian', 'Macedonian', 'Albanian',
  // Baltics
  'Estonian', 'Latvian', 'Lithuanian',
  // Eastern Europe & Caucasus
  'Ukrainian', 'Georgian', 'Armenian', 'Azerbaijani',
  // Iberian regional
  'Catalan', 'Basque', 'Galician',
  // Celtic
  'Welsh', 'Irish',
  // Middle East
  'Hebrew', 'Persian', 'Turkish', 'Kurdish', 'Pashto', 'Yiddish',
  // Central Asia
  'Kazakh', 'Uzbek', 'Kyrgyz', 'Tajik', 'Turkmen',
  // South Asia
  'Hindi', 'Bengali', 'Urdu', 'Punjabi', 'Tamil', 'Telugu', 'Marathi', 'Gujarati', 'Kannada', 'Malayalam', 'Odia', 'Nepali', 'Sinhala',
  // Southeast Asia
  'Vietnamese', 'Thai', 'Indonesian', 'Malay', 'Tagalog', 'Khmer', 'Lao', 'Burmese',
  // East Asia
  'Cantonese', 'Mongolian',
  // Africa
  'Swahili', 'Amharic', 'Hausa', 'Yoruba', 'Zulu', 'Afrikaans', 'Somali'
];

// Translation-related role keywords
const TRANSLATION_ROLES = [
  'translator', 'interpreter', 'localization', 'localizer', 'transcriber',
  'subtitler', 'captioner', 'linguist', 'language specialist',
  'proofreader', 'revisor', 'reviser', 'post-editor', 'terminologist',
  'language coordinator', 'language lead', 'language manager',
  'translation manager', 'translation specialist', 'translation coordinator'
];

// Language name → ISO 639-1 code mapping for fallback extraction from titles
const LANGUAGE_TO_CODE: Record<string, string> = {
  'english': 'EN', 'spanish': 'ES', 'french': 'FR', 'german': 'DE', 'chinese': 'ZH',
  'japanese': 'JA', 'arabic': 'AR', 'portuguese': 'PT', 'russian': 'RU', 'korean': 'KO',
  'italian': 'IT', 'dutch': 'NL', 'greek': 'EL', 'swedish': 'SV', 'danish': 'DA',
  'norwegian': 'NO', 'finnish': 'FI', 'polish': 'PL', 'czech': 'CS', 'slovak': 'SK',
  'hungarian': 'HU', 'romanian': 'RO', 'bulgarian': 'BG', 'serbian': 'SR', 'croatian': 'HR',
  'slovenian': 'SL', 'albanian': 'SQ', 'estonian': 'ET', 'latvian': 'LV', 'lithuanian': 'LT',
  'ukrainian': 'UK', 'georgian': 'KA', 'armenian': 'HY', 'azerbaijani': 'AZ',
  'catalan': 'CA', 'hebrew': 'HE', 'persian': 'FA', 'turkish': 'TR', 'kurdish': 'KU',
  'kazakh': 'KK', 'uzbek': 'UZ', 'hindi': 'HI', 'bengali': 'BN', 'urdu': 'UR',
  'punjabi': 'PA', 'tamil': 'TA', 'telugu': 'TE', 'marathi': 'MR', 'gujarati': 'GU',
  'vietnamese': 'VI', 'thai': 'TH', 'indonesian': 'ID', 'malay': 'MS', 'tagalog': 'TL',
  'khmer': 'KM', 'burmese': 'MY', 'mongolian': 'MN', 'cantonese': 'YUE',
  'swahili': 'SW', 'amharic': 'AM', 'afrikaans': 'AF', 'somali': 'SO',
  'nepali': 'NE', 'sinhala': 'SI', 'kannada': 'KN', 'malayalam': 'ML', 'odia': 'OR',
  'maltese': 'MT', 'icelandic': 'IS', 'welsh': 'CY', 'irish': 'GA',
  'basque': 'EU', 'galician': 'GL', 'bosnian': 'BS', 'macedonian': 'MK',
  'pashto': 'PS', 'kyrgyz': 'KY', 'tajik': 'TG', 'turkmen': 'TK',
  'hausa': 'HA', 'yoruba': 'YO', 'zulu': 'ZU',
};

/**
 * Fallback: extract languages from title when AI returns empty arrays.
 * "Korean Interpreter" → EN↔KO, "Spanish-French Translator" → ES↔FR
 */
function extractLanguagesFromTitle(title: string): { sourceLanguages: string[]; targetLanguages: string[] } | null {
  const titleLower = title.toLowerCase();

  // Only for translation-related jobs
  const isTranslationJob = TRANSLATION_ROLES.some(role => titleLower.includes(role));
  if (!isTranslationJob) return null;

  // Find all languages mentioned in the title
  const foundCodes: string[] = [];
  for (const [langName, code] of Object.entries(LANGUAGE_TO_CODE)) {
    if (langName === 'english') continue; // Skip English, handle separately
    if (titleLower.includes(langName)) {
      foundCodes.push(code);
    }
  }

  if (foundCodes.length === 0) return null;

  // If only one language found (e.g., "Korean Interpreter"), assume EN↔that language
  if (foundCodes.length === 1) {
    return {
      sourceLanguages: ['EN', foundCodes[0]],
      targetLanguages: [foundCodes[0], 'EN'],
    };
  }

  // Multiple languages found (e.g., "Spanish-French Translator") — use them bidirectionally
  return {
    sourceLanguages: foundCodes,
    targetLanguages: foundCodes,
  };
}

/**
 * Normalizes translation job titles to consistent format.
 * Transforms "Arabic Translator" → "English-Arabic Translator"
 * when only target language is specified (assumes English as source).
 */
export function normalizeTranslationTitle(title: string): string {
  if (!title) return title;

  const titleLower = title.toLowerCase();

  // Check if this is a translation-related job
  const isTranslationJob = TRANSLATION_ROLES.some(role => titleLower.includes(role));
  if (!isTranslationJob) return title;

  // Check if already has language pair format (e.g., "English-Arabic" or "Arabic-English")
  const hasLanguagePair = LANGUAGES.some(lang1 =>
    LANGUAGES.some(lang2 => {
      const pair1 = `${lang1.toLowerCase()}-${lang2.toLowerCase()}`;
      const pair2 = `${lang1.toLowerCase()} to ${lang2.toLowerCase()}`;
      return titleLower.includes(pair1) || titleLower.includes(pair2);
    })
  );
  if (hasLanguagePair) return title;

  // Check if "Multilingual" is already present
  if (titleLower.includes('multilingual')) return title;

  // Find single language at the start of title
  for (const lang of LANGUAGES) {
    const langLower = lang.toLowerCase();

    // Skip if it's English (we're adding English as source)
    if (langLower === 'english') continue;

    // Pattern: "Arabic Translator", "Spanish Medical Interpreter"
    const startsWithLang = titleLower.startsWith(langLower + ' ');

    if (startsWithLang) {
      // Check that this language is followed by a role word (not another language)
      const afterLang = title.substring(lang.length + 1);
      const isFollowedByRole = TRANSLATION_ROLES.some(role =>
        afterLang.toLowerCase().includes(role)
      );

      if (isFollowedByRole) {
        // Transform: "Arabic Translator" → "English-Arabic Translator"
        return `English-${title}`;
      }
    }
  }

  return title;
}

const EXTRACTION_PROMPT = `You are a job data extractor. Extract structured data from LinkedIn hiring posts.

Return a valid JSON object with these fields:
- title: job title following these SEO rules:
  * Use Title Case (capitalize each word)
  * Max 60 characters
  * For translation/interpreter jobs with 1-2 languages: "[Language1]-[Language2] [Role]" (e.g., "Korean-English Translator", "Russian Medical Interpreter")
  * For translation jobs with 3+ languages: "Multilingual [Role]" (e.g., "Multilingual Interpreter")
  * Remove seniority levels from title (no "Fresher", "Entry Level", "Senior" - extract to level field instead)
  * Use ONE main role only (not "Writer, Editor, Designer" - pick the primary one)
  * Examples: "Korean-English Translator", "Full Stack Developer", "Content Writer", "Voice-over Artist"
- company: ACTUAL company name that is hiring (string or null). IMPORTANT: Do NOT use generic terms like "Freelance Recruitment", "Remote Hiring", "Staffing Agency", "Recruitment", "Talent Acquisition" as company names. Only use specific company/organization names. If no specific company name is mentioned, return null.
- isRemote: whether remote work is mentioned (boolean)
- location: specific location if mentioned, e.g., "USA", "Europe", "Germany" (string or null)
- salaryMin: minimum salary if mentioned, as number (number or null)
- salaryMax: maximum salary if mentioned, as number (number or null)
- salaryCurrency: currency code like "USD", "EUR" (string or null)
- salaryPeriod: salary period - one of: HOUR, DAY, WEEK, MONTH, YEAR, ONE_TIME (or null, default YEAR for annual salaries, ONE_TIME for project/task payments)
- skills: array of technical skills/technologies mentioned (string[])
- level: seniority level - one of: INTERN, ENTRY, JUNIOR, MID, SENIOR, LEAD, MANAGER, DIRECTOR, EXECUTIVE (or null). Extract from title words like "Fresher"→ENTRY, "Junior"→JUNIOR, "Senior"→SENIOR, "Lead"→LEAD
- type: employment type - one of: FULL_TIME, PART_TIME, CONTRACT, FREELANCE, INTERNSHIP (or null, default to FULL_TIME if unclear)
- benefits: array of benefits mentioned like "health insurance", "401k", "unlimited PTO" (string[])
- contactMethod: how to apply - "email", "dm", or "apply_link" (or null)
- contactEmail: email address if mentioned (string or null)
- applyUrl: application URL if mentioned (string or null)

FOR TRANSLATION/LOCALIZATION JOBS ONLY, also extract:
- translationTypes: array of translation work types mentioned. Use these exact values:
  - TRANSLATION (written translation, document translation)
  - INTERPRETATION (oral/verbal interpretation, conference interpretation, consecutive/simultaneous)
  - LOCALIZATION (software localization, game localization, website localization)
  - EDITING (editing, proofreading, reviewing translations)
  - TRANSCRIPTION (audio/video transcription)
  - SUBTITLING (subtitling, captioning, closed captions)
  - MT_POST_EDITING (machine translation post-editing, MTPE)
  - COPYWRITING (multilingual copywriting, transcreation)
- sourceLanguages: array of source language ISO 639-1 codes (uppercase), e.g., ["EN", "ES", "DE"]
- targetLanguages: array of target language ISO 639-1 codes (uppercase), e.g., ["RU", "FR", "ZH"]

Common language codes (ISO 639-1):
EN (English), ES (Spanish), FR (French), DE (German), ZH (Chinese), JA (Japanese), AR (Arabic), PT (Portuguese), RU (Russian), KO (Korean),
IT (Italian), NL (Dutch), EL (Greek), SV (Swedish), DA (Danish), NO (Norwegian), FI (Finnish), PL (Polish), CS (Czech), SK (Slovak),
HU (Hungarian), RO (Romanian), BG (Bulgarian), SR (Serbian), HR (Croatian), SL (Slovenian), SQ (Albanian), ET (Estonian), LV (Latvian), LT (Lithuanian),
UK (Ukrainian), KA (Georgian), HY (Armenian), AZ (Azerbaijani), CA (Catalan), HE (Hebrew), FA (Persian), TR (Turkish), KU (Kurdish),
KK (Kazakh), UZ (Uzbek), HI (Hindi), BN (Bengali), UR (Urdu), PA (Punjabi), TA (Tamil), TE (Telugu), MR (Marathi), GU (Gujarati),
VI (Vietnamese), TH (Thai), ID (Indonesian), MS (Malay), TL (Tagalog), KM (Khmer), MY (Burmese), MN (Mongolian),
SW (Swahili), AM (Amharic), AF (Afrikaans), SO (Somali)

IMPORTANT: If a language is mentioned in the title (e.g., "Korean Interpreter", "Spanish Translator") but the translation direction is unclear, assume bidirectional with English. Example: "Korean Interpreter" → sourceLanguages: ["EN", "KO"], targetLanguages: ["KO", "EN"]. NEVER return empty arrays for translation/interpreter jobs that mention a language.

For non-translation jobs, set translationTypes, sourceLanguages, targetLanguages to empty arrays [].

CLEAN DESCRIPTION (for SEO and better UX):
- cleanDescription: A professionally rewritten job description. Transform the raw post into a clean, structured, easy-to-read text.

Format for cleanDescription:
1. Start with "About the Role" paragraph (2-3 sentences summarizing the position)
2. "Key Responsibilities" section with bullet points (use "• " for bullets)
3. "Requirements" section with bullet points
4. "Benefits" section with bullet points - ONLY include if benefits are explicitly mentioned in original. If no benefits mentioned, DO NOT include this section at all.

Rules for cleanDescription:
- Write in professional, clear English
- REMOVE all: emojis, hashtags, excessive punctuation (!!!), promotional phrases ("Amazing opportunity!!!")
- REMOVE: EEO statements, legal disclaimers, "About Us" company history, application instructions
- Keep ONLY job-relevant content: role, responsibilities, requirements, qualifications, benefits
- NEVER write "Not specified", "N/A", "None mentioned" or similar placeholders - just omit the section entirely
- Use proper capitalization and punctuation
- Each section header on its own line, followed by content
- For bullet points, use "• " prefix
- Keep it concise but comprehensive (aim for 150-300 words)
- If original is too short or lacks structure, write what you can extract professionally

Example format:
"About the Role
We are looking for a Senior Developer to join our team. This role focuses on building scalable backend systems.

Key Responsibilities
• Design and implement RESTful APIs
• Lead code reviews and mentor junior developers
• Collaborate with product team on technical requirements

Requirements
• 5+ years of experience with Python or Node.js
• Strong understanding of database design
• Experience with cloud platforms (AWS, GCP)

Benefits
• Competitive salary and equity
• Remote-first culture
• Health insurance and 401k"

Be conservative - only extract what is explicitly stated. Don't infer or guess.
Return ONLY valid JSON, no markdown or explanation.`;

// Pricing per 1M tokens (as of Jan 2025)
const PRICING = {
  deepseek: { input: 0.28, output: 0.42 },  // DeepSeek V3.2
  zai: { input: 0.10, output: 0.10 },       // GLM-4-32B
};

function getPricing(provider: AIProvider) {
  return PRICING[provider];
}

// Track cumulative usage for monitoring
let cumulativeUsage = {
  inputTokens: 0,
  outputTokens: 0,
  calls: 0,
  estimatedCostUSD: 0,
  provider: 'deepseek' as AIProvider,
};

export function getAIUsageStats() {
  return { ...cumulativeUsage };
}

// Legacy alias
export function getDeepSeekUsageStats() {
  return getAIUsageStats();
}

export function resetAIUsageStats() {
  cumulativeUsage = {
    inputTokens: 0,
    outputTokens: 0,
    calls: 0,
    estimatedCostUSD: 0,
    provider: getAIProvider(),
  };
}

// Legacy alias
export function resetDeepSeekUsageStats() {
  resetAIUsageStats();
}

function trackUsage(usage: { prompt_tokens: number; completion_tokens: number } | undefined, provider: AIProvider) {
  if (!usage) return;

  const pricing = getPricing(provider);
  const inputCost = (usage.prompt_tokens / 1_000_000) * pricing.input;
  const outputCost = (usage.completion_tokens / 1_000_000) * pricing.output;
  const totalCost = inputCost + outputCost;

  cumulativeUsage.inputTokens += usage.prompt_tokens;
  cumulativeUsage.outputTokens += usage.completion_tokens;
  cumulativeUsage.calls++;
  cumulativeUsage.estimatedCostUSD += totalCost;
  cumulativeUsage.provider = provider;

  const providerName = provider === 'zai' ? 'Z.ai' : 'DeepSeek';
  console.log(`[${providerName}] Tokens: ${usage.prompt_tokens} in / ${usage.completion_tokens} out | Cost: $${totalCost.toFixed(5)} | Cumulative: $${cumulativeUsage.estimatedCostUSD.toFixed(4)}`);
}

export async function extractJobData(postText: string): Promise<ExtractedJobData | null> {
  try {
    const { client, model, provider } = getAIClient();
    const response = await client.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: postText }
      ],
      temperature: 0.1,
      max_tokens: 2000,
    });

    trackUsage(response.usage, provider);

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const data = JSON.parse(content) as ExtractedJobData;
    // Ensure translation fields have defaults, normalize title and currency
    let sourceLanguages = data.sourceLanguages || [];
    let targetLanguages = data.targetLanguages || [];

    // Fallback: if AI returned empty languages but title mentions a language, assume EN↔that language
    if (sourceLanguages.length === 0 && targetLanguages.length === 0 && data.title) {
      const fallbackLangs = extractLanguagesFromTitle(data.title);
      if (fallbackLangs) {
        sourceLanguages = fallbackLangs.sourceLanguages;
        targetLanguages = fallbackLangs.targetLanguages;
      }
    }

    return {
      ...data,
      title: data.title ? normalizeTranslationTitle(data.title) : null,
      salaryCurrency: normalizeCurrencyCode(data.salaryCurrency),
      translationTypes: filterValidTranslationTypes(data.translationTypes),
      sourceLanguages,
      targetLanguages,
      cleanDescription: data.cleanDescription || null,
    };
  } catch (error) {
    const provider = getAIProvider();
    console.error(`[${provider}] Extraction error:`, error);
    return null;
  }
}

const CATEGORY_PROMPT = `Classify this job into ONE category. Return ONLY the category slug, nothing else.

Categories (use exact slug):
- engineering: Software engineers, developers, programmers
- design: UI/UX designers, graphic designers, product designers
- data: Data scientists, analysts, ML engineers, BI analysts
- devops: DevOps, SRE, infrastructure, cloud engineers
- qa: QA engineers, testers, quality assurance, SDET
- security: Security engineers, cybersecurity, infosec
- product: Product managers, product owners
- marketing: Marketing, growth, SEO, content marketing
- sales: Sales, business development, account managers
- finance: Finance, accounting, payroll specialists
- hr: HR, recruiters, people operations
- operations: Operations, administration, office management
- legal: Legal, compliance, contracts
- project-management: Project managers, scrum masters, agile coaches
- writing: Copywriters, content writers, technical writers
- translation: Translators, interpreters, localization
- creative: Video producers, animators, photographers
- support: Customer support, customer success, tech support
- education: Trainers, teachers, instructional designers
- research: Researchers, user researchers, market researchers
- consulting: Consultants, advisors, strategists

Match based on job title and skills. Choose the MOST specific category that fits.
Examples:
- "Business Analyst" → data (or product if product-focused)
- "Research Manager" → research
- "Image Review/Annotation" → qa
- "SDET" or "Test Engineer" → qa
- "Data Architect" → data
- "Software Engineer" → engineering
- "Full Stack Developer" → engineering`;

/**
 * Detect country from job posting using AI.
 * Returns ISO 3166-1 alpha-2 country code or null if remote/worldwide.
 */
export async function detectCountry(
  title: string,
  description: string,
  location?: string | null
): Promise<string | null> {
  const { client, model } = getAIClient();

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You determine which country a job/project is for based on the posting text.

Rules:
- Return ONLY the ISO 3166-1 alpha-2 country code (e.g., US, GB, IN, DE, BR)
- If the job is remote/worldwide with no specific country requirement, return "REMOTE"
- Look for clues: mentioned cities, countries, time zones, languages, currencies, companies
- If a city is mentioned (e.g., "London"), return the country (GB)
- If the client/company location suggests a country, use it
- If truly ambiguous with no country clues, return "REMOTE"

Return ONLY the 2-letter code or "REMOTE". Nothing else.`,
        },
        {
          role: 'user',
          content: `Title: ${title}\nLocation: ${location || 'not specified'}\nDescription: ${description.substring(0, 500)}`,
        },
      ],
      max_tokens: 10,
      temperature: 0,
    });

    const result = (completion.choices[0]?.message?.content || '').trim().toUpperCase();

    if (result === 'REMOTE' || result === 'NULL' || result === 'WORLDWIDE' || result === 'GLOBAL') {
      return null;
    }

    // Validate it looks like a country code (2 uppercase letters)
    if (/^[A-Z]{2}$/.test(result)) {
      return result;
    }

    return null;
  } catch (error) {
    console.error('[AI] Country detection failed:', error);
    return null;
  }
}

export async function classifyJobCategory(
  title: string,
  skills: string[]
): Promise<string> {
  try {
    const { client, model, provider } = getAIClient();
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: CATEGORY_PROMPT },
        { role: 'user', content: `Title: ${title}\nSkills: ${skills.join(', ') || 'none specified'}` }
      ],
      temperature: 0,
      max_tokens: 50,
    });

    trackUsage(response.usage, provider);

    const category = response.choices[0]?.message?.content?.trim().toLowerCase().replace(/[^a-z-]/g, '');
    const validCategories = [
      'engineering', 'design', 'data', 'devops', 'qa', 'security',
      'product', 'marketing', 'sales', 'finance', 'hr', 'operations',
      'legal', 'project-management', 'writing', 'translation', 'creative',
      'support', 'education', 'research', 'consulting'
    ];

    if (validCategories.includes(category || '')) {
      return category!;
    }

    // Fallback: classify locally based on title keywords
    return localClassifyJob(title);
  } catch (error) {
    const provider = getAIProvider();
    console.error(`[${provider}] Category classification error:`, error);
    return localClassifyJob(title);
  }
}

// Local fallback classification
function localClassifyJob(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('research') || t.includes('researcher')) return 'research';
  if (t.includes('analyst') || t.includes('data') || t.includes('bi ')) return 'data';
  if (t.includes('product manager') || t.includes('product owner')) return 'product';
  if (t.includes('qa') || t.includes('quality') || t.includes('test') || t.includes('sdet') || t.includes('review')) return 'qa';
  if (t.includes('support') || t.includes('customer success')) return 'support';
  if (t.includes('marketing') || t.includes('growth')) return 'marketing';
  if (t.includes('sales') || t.includes('account')) return 'sales';
  if (t.includes('design') || t.includes('ux') || t.includes('ui')) return 'design';
  if (t.includes('writer') || t.includes('content') || t.includes('copy')) return 'writing';
  if (t.includes('translat') || t.includes('locali') || t.includes('linguist') ||
      t.includes('interpret') || t.includes('proofreader') || t.includes('subtitl') ||
      t.includes('caption') || t.includes('transcription') || t.includes('terminolog') ||
      t.includes('post-editor') || t.includes('mtpe') || t.includes('revisor') ||
      t.includes('bilingual') || t.includes('multilingual')) return 'translation';
  if (t.includes('project manager') || t.includes('scrum')) return 'project-management';
  if (t.includes('hr') || t.includes('recruit') || t.includes('people')) return 'hr';
  if (t.includes('finance') || t.includes('account') || t.includes('payroll')) return 'finance';
  if (t.includes('legal') || t.includes('compliance')) return 'legal';
  if (t.includes('operations') || t.includes('admin')) return 'operations';
  if (t.includes('engineer') || t.includes('develop') || t.includes('program')) return 'engineering';
  return 'support';
}

const JOB_FILTER_PROMPT = `You are a STRICT job classifier for a TECH-focused REMOTE jobs board.
We only want DIGITAL/TECH jobs. Be very strict - when in doubt, SKIP.

IMPORT (YES) - Tech/digital work only:
- Software developers, engineers, programmers (all tech stacks)
- Designers (UI/UX, product, web, graphic for digital)
- Data analysts, scientists, ML/AI engineers
- Product managers, project managers (tech companies)
- DevOps, SRE, cloud engineers
- QA, test engineers
- Marketing (digital: SEO, SEM, growth, content marketing)
- Tech sales (SaaS, B2B software), solutions engineers
- Technical writers, UX writers
- Tech recruiters, technical sourcers
- Financial analysts (tech/fintech companies only)
- TRANSLATION & LOCALIZATION (ALWAYS IMPORT): translators, interpreters, localization specialists, linguists, proofreaders, post-editors, subtitlers, captioners, transcriptionists, terminologists, language specialists, bilingual roles, multilingual roles

SKIP (NO) - NOT for our platform:
- TRAVEL/HOSPITALITY: booking agents, reservationists, travel coordinators, wedding planners, cruise specialists, hotel staff, concierge
- VIRTUAL ASSISTANTS: generic VA, executive assistant, personal assistant, admin assistant
- HEALTHCARE: nurses, doctors, therapists, pharmacists, medical staff, patient coordinators, dental assistants
- ACCOUNTING: accountants, bookkeepers, CPAs, auditors, payroll, billing, collections
- TRADITIONAL: drivers, warehouse, retail, restaurant, construction, manufacturing
- FIELD WORK: technicians (non-IT), installers, maintenance, field service
- EDUCATION: teachers, tutors, instructors (non-corporate training)
- GIG WORK: data labeling, annotation, content moderation projects
- INSURANCE: insurance agents, claims processors, underwriters
- PROPERTY: real estate agents, property managers, leasing agents
- GENERIC ROLES: "specialist", "coordinator", "representative" without clear tech context

CRITICAL: If title sounds like hospitality, travel, healthcare, or generic office work - SKIP IT.

Respond ONLY with JSON: {"import": true/false, "reason": "brief reason"}`;

/**
 * AI-based job filter: determines if a job is suitable for our remote job board
 * Returns true if job should be imported, false if it should be skipped
 */
export async function isTargetRemoteJob(title: string, company?: string): Promise<{ import: boolean; reason: string }> {
  // Pre-filter: Skip non-English titles (detect common non-English patterns)
  const nonEnglishPatterns = [
    /\b(funcional|desenvolvedor|analista|gerente|coordenador|engenheiro)\b/i, // Portuguese
    /\b(ingeniero|gerente|coordinador|desarrollador|especialista)\b/i, // Spanish (no analista - too close to analyst)
    /\b(ingénieur|analyste|développeur|gestionnaire|conseiller)\b/i, // French
    /\b(entwickler|sachbearbeiter|leiter|koordinator|berater)\b/i, // German (no analyst - it's English)
  ];
  if (nonEnglishPatterns.some(p => p.test(title))) {
    console.log(`[AI Filter] "${title}" → SKIP: Non-English title`);
    return { import: false, reason: 'Non-English job title' };
  }

  try {
    const { client, model, provider } = getAIClient();
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: JOB_FILTER_PROMPT },
        { role: 'user', content: `Job title: ${title}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 100,
    });

    trackUsage(response.usage, provider);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { import: false, reason: 'AI response empty' };
    }

    const result = JSON.parse(content) as { import: boolean; reason: string };
    const providerName = provider === 'zai' ? 'Z.ai' : 'DeepSeek';
    console.log(`[${providerName} Filter] "${title}" → ${result.import ? 'IMPORT' : 'SKIP'}: ${result.reason}`);
    return result;
  } catch (error) {
    const provider = getAIProvider();
    console.error(`[${provider} Filter] Error:`, error);
    // On error, fall back to simple keyword check
    const lower = title.toLowerCase();
    const skipKeywords = ['driver', 'nurse', 'warehouse', 'construction', 'retail', 'cashier', 'cook', 'chef'];
    const skip = skipKeywords.some(kw => lower.includes(kw));
    return { import: !skip, reason: skip ? 'Fallback: matched skip keyword' : 'Fallback: no skip keywords' };
  }
}

// Export current provider info
export function getActiveAIProvider() {
  return getAIProvider();
}

/**
 * AI validation: Check if a LinkedIn post is actually a JOB POSTING
 * Filters out: events, announcements, articles, personal updates, promotions
 * Returns: { isJob: boolean, reason: string }
 */
const IS_JOB_POSTING_PROMPT = `You are a content classifier. Determine if this LinkedIn post is a JOB POSTING (someone HIRING for a role).

A JOB POSTING must have:
- A specific job role/position being offered BY A COMPANY/CLIENT
- Someone is HIRING (an employer looking to fill a position)
- Clear intent to HIRE someone else (not promote themselves)

NOT a job posting (REJECT these):
- EVENT INVITATIONS: webinars, conferences, workshops, previews, meetups ("Join us on...", "Register for...")
- ANNOUNCEMENTS: company news, product launches, achievements, milestones
- JOB SEEKERS: "I'm looking for work", "Open to opportunities", career transitions
- FREELANCER SELF-PROMOTION: "I am a [profession]", "I'm a copywriter/designer/developer", "Hire me", "I offer services", "I'm available for projects", "My services include", "Looking for clients", freelancers advertising THEMSELVES
- ARTICLES/THOUGHTS: industry insights, tips, advice, opinions
- PROMOTIONS: sales, discounts, special offers
- CALL FOR PARTNERS: looking for collaborators, partners, investors
- NETWORKING: "Connect with me", "Let's chat", community building

CRITICAL: If the post author is describing THEIR OWN skills/services (e.g., "I'm a copywriter", "I do translations"), this is SELF-PROMOTION, not a job posting. A job posting is when someone needs to HIRE another person.

Respond ONLY with JSON: {"isJob": true/false, "reason": "brief reason"}`;

export async function isJobPosting(postContent: string, retryCount = 0): Promise<{ isJob: boolean; reason: string }> {
  const MAX_RETRIES = 2;

  try {
    const { client, model, provider } = getAIClient();

    // Truncate to save tokens (first 1500 chars is enough to determine post type)
    const truncatedContent = postContent.length > 1500
      ? postContent.substring(0, 1500) + '...'
      : postContent;

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: IS_JOB_POSTING_PROMPT },
        { role: 'user', content: truncatedContent }
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 100,
    });

    trackUsage(response.usage, provider);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { isJob: false, reason: 'AI response empty' };
    }

    const result = JSON.parse(content) as { isJob: boolean; reason: string };
    const providerName = provider === 'zai' ? 'Z.ai' : 'DeepSeek';
    console.log(`[${providerName}] Post validation: ${result.isJob ? 'JOB' : 'NOT_JOB'} - ${result.reason}`);
    return result;
  } catch (error) {
    const provider = getAIProvider();
    console.error(`[${provider}] isJobPosting error (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, error);

    // Retry on transient errors (rate limit, timeout, server error)
    if (retryCount < MAX_RETRIES) {
      const delayMs = (retryCount + 1) * 2000; // 2s, 4s
      console.log(`[${provider}] Retrying isJobPosting in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return isJobPosting(postContent, retryCount + 1);
    }

    // All retries exhausted — reject to be safe
    return { isJob: false, reason: 'Error during validation, rejecting to be safe' };
  }
}

// Legacy exports for backwards compatibility
export { getDeepSeekClient as deepseek };
