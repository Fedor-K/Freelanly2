import OpenAI from 'openai';

// DeepSeek uses OpenAI-compatible API
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
});

export interface ExtractedJobData {
  title: string | null;
  company: string | null;
  isRemote: boolean;
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
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
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `Classify this job into ONE category. Return only the slug.
Categories: engineering, frontend, backend, fullstack, mobile, devops, data, design, product, marketing, sales, support, hr, finance

If unsure, return "engineering" for technical roles.`
        },
        { role: 'user', content: `Title: ${title}\nSkills: ${skills.join(', ')}` }
      ],
      temperature: 0,
      max_tokens: 50,
    });

    const category = response.choices[0]?.message?.content?.trim().toLowerCase();
    const validCategories = ['engineering', 'frontend', 'backend', 'fullstack', 'mobile', 'devops', 'data', 'design', 'product', 'marketing', 'sales', 'support', 'hr', 'finance'];

    return validCategories.includes(category || '') ? category! : 'engineering';
  } catch (error) {
    console.error('Category classification error:', error);
    return 'engineering';
  }
}

export { deepseek };
