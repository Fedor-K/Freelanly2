import OpenAI from 'openai';

// Lazy initialization to avoid build-time errors
let _deepseek: OpenAI | null = null;

function getDeepSeekClient(): OpenAI {
  if (!_deepseek) {
    _deepseek = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY || 'dummy-key-for-build',
      baseURL: 'https://api.deepseek.com/v1',
    });
  }
  return _deepseek;
}

// Translation work types
export type TranslationType =
  | 'WRITTEN'
  | 'INTERPRETATION'
  | 'LOCALIZATION'
  | 'EDITING'
  | 'TRANSCRIPTION'
  | 'SUBTITLING'
  | 'MT_POST_EDITING'
  | 'COPYWRITING';

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
  summaryBullets: string[];      // 5-7 key responsibilities (legacy)
  requirementBullets: string[];  // 5-7 requirements (legacy)
  benefitBullets: string[];      // benefits if mentioned (legacy)
}

// Common languages for translation job title detection
const LANGUAGES = [
  'Arabic', 'Bengali', 'Bulgarian', 'Chinese', 'Croatian', 'Czech', 'Danish',
  'Dutch', 'English', 'Estonian', 'Finnish', 'French', 'German', 'Greek',
  'Hebrew', 'Hindi', 'Hungarian', 'Indonesian', 'Italian', 'Japanese',
  'Korean', 'Latvian', 'Lithuanian', 'Malay', 'Norwegian', 'Persian', 'Polish',
  'Portuguese', 'Romanian', 'Russian', 'Serbian', 'Slovak', 'Slovenian',
  'Spanish', 'Swedish', 'Thai', 'Turkish', 'Ukrainian', 'Urdu', 'Vietnamese'
];

// Translation-related role keywords
const TRANSLATION_ROLES = [
  'translator', 'interpreter', 'localization', 'localizer', 'transcriber',
  'subtitler', 'captioner', 'linguist', 'language specialist'
];

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
  - WRITTEN (written translation, document translation)
  - INTERPRETATION (oral/verbal interpretation, conference interpretation, consecutive/simultaneous)
  - LOCALIZATION (software localization, game localization, website localization)
  - EDITING (editing, proofreading, reviewing translations)
  - TRANSCRIPTION (audio/video transcription)
  - SUBTITLING (subtitling, captioning, closed captions)
  - MT_POST_EDITING (machine translation post-editing, MTPE)
  - COPYWRITING (multilingual copywriting, transcreation)
- sourceLanguages: array of source language ISO 639-1 codes (uppercase), e.g., ["EN", "ES", "DE"]
- targetLanguages: array of target language ISO 639-1 codes (uppercase), e.g., ["RU", "FR", "ZH"]

Common language codes: EN (English), ES (Spanish), DE (German), FR (French), RU (Russian), ZH (Chinese), JA (Japanese), KO (Korean), PT (Portuguese), IT (Italian), AR (Arabic), NL (Dutch), PL (Polish), TR (Turkish), UK (Ukrainian), SV (Swedish)

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

Also include legacy bullet fields for backwards compatibility:
- summaryBullets: array of 5-7 key job responsibilities (max 15 words each)
- requirementBullets: array of 5-7 requirements (max 15 words each)
- benefitBullets: array of benefits mentioned (empty array if none)

Be conservative - only extract what is explicitly stated. Don't infer or guess.
Return ONLY valid JSON, no markdown or explanation.`;

export async function extractJobData(postText: string): Promise<ExtractedJobData | null> {
  try {
    const deepseek = getDeepSeekClient();
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: postText }
      ],
      temperature: 0.1,
      max_tokens: 2000, // Increased for cleanDescription
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const data = JSON.parse(content) as ExtractedJobData;
    // Ensure translation fields have defaults and normalize title
    return {
      ...data,
      title: data.title ? normalizeTranslationTitle(data.title) : null,
      translationTypes: data.translationTypes || [],
      sourceLanguages: data.sourceLanguages || [],
      targetLanguages: data.targetLanguages || [],
      cleanDescription: data.cleanDescription || null,
      summaryBullets: data.summaryBullets || [],
      requirementBullets: data.requirementBullets || [],
      benefitBullets: data.benefitBullets || [],
    };
  } catch (error) {
    console.error('DeepSeek extraction error:', error);
    return null;
  }
}

export async function classifyJobCategory(
  title: string,
  skills: string[]
): Promise<string> {
  try {
    const deepseek = getDeepSeekClient();
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `Classify this job into ONE category. Return ONLY the category slug, nothing else.

Categories (use exact slug):
- engineering: Software engineers, developers, programmers
- design: UI/UX designers, graphic designers, product designers
- data: Data scientists, analysts, ML engineers, BI analysts
- devops: DevOps, SRE, infrastructure, cloud engineers
- qa: QA engineers, testers, quality assurance
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
- "Software Engineer" → engineering
- "Full Stack Developer" → engineering`
        },
        { role: 'user', content: `Title: ${title}\nSkills: ${skills.join(', ') || 'none specified'}` }
      ],
      temperature: 0,
      max_tokens: 50,
    });

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
    const t = title.toLowerCase();
    if (t.includes('research') || t.includes('researcher')) return 'research';
    if (t.includes('analyst') || t.includes('data') || t.includes('bi ')) return 'data';
    if (t.includes('product manager') || t.includes('product owner')) return 'product';
    if (t.includes('qa') || t.includes('quality') || t.includes('test') || t.includes('review')) return 'qa';
    if (t.includes('support') || t.includes('customer success')) return 'support';
    if (t.includes('marketing') || t.includes('growth')) return 'marketing';
    if (t.includes('sales') || t.includes('account')) return 'sales';
    if (t.includes('design') || t.includes('ux') || t.includes('ui')) return 'design';
    if (t.includes('writer') || t.includes('content') || t.includes('copy')) return 'writing';
    if (t.includes('translat') || t.includes('locali')) return 'translation';
    if (t.includes('project manager') || t.includes('scrum')) return 'project-management';
    if (t.includes('hr') || t.includes('recruit') || t.includes('people')) return 'hr';
    if (t.includes('finance') || t.includes('account') || t.includes('payroll')) return 'finance';
    if (t.includes('legal') || t.includes('compliance')) return 'legal';
    if (t.includes('operations') || t.includes('admin')) return 'operations';
    if (t.includes('engineer') || t.includes('develop') || t.includes('program')) return 'engineering';

    return 'support'; // Safe default for misc jobs
  } catch (error) {
    console.error('Category classification error:', error);
    // Local fallback on API error
    const t = title.toLowerCase();
    if (t.includes('engineer') || t.includes('develop')) return 'engineering';
    if (t.includes('analyst') || t.includes('data')) return 'data';
    if (t.includes('manager')) return 'product';
    return 'support';
  }
}

export { getDeepSeekClient as deepseek };
