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
}

const EXTRACTION_PROMPT = `You are a job data extractor. Extract structured data from LinkedIn hiring posts.

Return a valid JSON object with these fields:
- title: job title (string or null)
- company: company name mentioned (string or null)
- isRemote: whether remote work is mentioned (boolean)
- location: specific location if mentioned, e.g., "USA", "Europe", "Germany" (string or null)
- salaryMin: minimum salary if mentioned, as number (number or null)
- salaryMax: maximum salary if mentioned, as number (number or null)
- salaryCurrency: currency code like "USD", "EUR" (string or null)
- salaryPeriod: salary period - one of: HOUR, DAY, WEEK, MONTH, YEAR, ONE_TIME (or null, default YEAR for annual salaries, ONE_TIME for project/task payments)
- skills: array of technical skills/technologies mentioned (string[])
- level: seniority level - one of: INTERN, ENTRY, JUNIOR, MID, SENIOR, LEAD, MANAGER, DIRECTOR, EXECUTIVE (or null)
- type: employment type - one of: FULL_TIME, PART_TIME, CONTRACT, FREELANCE, INTERNSHIP (or null, default to FULL_TIME if unclear)
- benefits: array of benefits mentioned like "health insurance", "401k", "unlimited PTO" (string[])
- contactMethod: how to apply - "email", "dm", or "apply_link" (or null)
- contactEmail: email address if mentioned (string or null)
- applyUrl: application URL if mentioned (string or null)

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
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const data = JSON.parse(content) as ExtractedJobData;
    return data;
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
