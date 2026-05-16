import OpenAI from 'openai';

type AIProvider = 'deepseek' | 'zai';

function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER?.toLowerCase();
  if (provider === 'zai') return 'zai';
  return 'deepseek';
}

let _deepseek: OpenAI | null = null;
let _zai: OpenAI | null = null;

function getDeepSeekClient(): OpenAI {
  if (!_deepseek) {
    _deepseek = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY || 'dummy-key-for-build',
      baseURL: 'https://api.deepseek.com/v1',
      timeout: 30000,
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
      timeout: 15000,
      maxRetries: 1,
    });
  }
  return _zai;
}

function getAIClient(): { client: OpenAI; model: string; provider: AIProvider } {
  const provider = getAIProvider();
  if (provider === 'zai') {
    return { client: getZaiClient(), model: 'glm-4-32b-0414-128k', provider: 'zai' };
  }
  return { client: getDeepSeekClient(), model: 'deepseek-chat', provider: 'deepseek' };
}

// =========================================================================
// INTERFACES
// =========================================================================

/** Raw data about the job/opportunity — everything we know */
interface JobData {
  title: string;
  description: string;
  recruiterEmail?: string;
  /** Raw LinkedIn post content or original posting text */
  originalContent?: string;
  /** Poster/recruiter name from LinkedIn */
  posterName?: string;
  /** Poster headline from LinkedIn */
  posterHeadline?: string;
  /** Company name if known */
  companyName?: string;
}

/** User's profile — everything we know about the applicant */
interface UserData {
  name: string;
  email: string;
  skills: string[];
  languages?: string[];
  resumeText?: string;
  workPreference?: string;
  bookingUrl?: string;
  caseStudies?: Array<{ title: string; description: string; url?: string }>;
}

// Keep backward-compatible interface
interface UserProfile {
  name: string;
  skills: string[];
  experience: string;
  resumeText?: string;
  languages?: string[];
  workPreference?: string;
  bookingUrl?: string;
  caseStudies?: Array<{ title: string; description: string; tech?: string[]; url?: string }>;
  recruiterEmail?: string;
}

interface CoverLetterInput {
  jobTitle: string;
  jobDescription: string;
  companyName: string;
  userProfile: UserProfile;
  styleOverride?: string;
}

// =========================================================================
// MAIN: Generate complete application email
// =========================================================================

/**
 * Generate a complete application email. AI gets ALL raw data and decides
 * everything: greeting, body, sign-off, what to mention, tone.
 */
export async function generateCoverLetter(input: CoverLetterInput): Promise<string> {
  const { jobTitle, jobDescription, companyName, userProfile, styleOverride } = input;
  const { client, model } = getAIClient();

  const skillsList = userProfile.skills.slice(0, 15).join(', ');
  const experienceSnippet = (userProfile.resumeText || userProfile.experience || '').slice(0, 500);

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.7,
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content: styleOverride || `You are writing a job application email on behalf of someone. You receive ALL raw data about the job and the applicant. Write the COMPLETE email ready to send.

YOUR JOB:
1. Figure out who to address — look at the recruiter email and job description. If you can tell the person's first name, use "Hi [Name],". Otherwise "Hi there,".
2. Figure out the company — from the description, email domain, poster info, anything. Mention it.
3. Write 3-4 sentences that show the applicant read the job post. Reference something specific.
4. Mention 1-2 skills from the applicant's profile that match. ONLY real skills — NEVER invent.
5. End with a soft call to action.
6. Sign off with the applicant's name.

RULES:
- NEVER say "I am excited", "I am eager", "I am confident", "I am writing to express interest"
- Sound like a real person writing a quick note to someone they want to work with
- Short. 4-6 lines total including greeting and sign-off. Under 100 words.
- Include line breaks between greeting, body, and sign-off.`,
        },
        {
          role: 'user',
          content: `=== JOB POST ===
Title: ${jobTitle}
Description: ${jobDescription.slice(0, 800)}
Recruiter email: ${(userProfile as any).recruiterEmail || 'unknown'}
Company/poster: ${companyName}

=== APPLICANT ===
Name: ${userProfile.name}
Skills: ${skillsList}
Languages: ${userProfile.languages?.join(', ') || 'Not specified'}
Background: ${experienceSnippet}
${userProfile.workPreference ? `Work preference: ${userProfile.workPreference}` : ''}
${userProfile.bookingUrl ? `Booking: ${userProfile.bookingUrl}` : ''}
${userProfile.caseStudies?.length ? `Portfolio: ${userProfile.caseStudies.map(p => `${p.title}${p.url ? ` (${p.url})` : ''}`).join(', ')}` : ''}

Write the complete email now.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) throw new Error('Empty AI response');
    return content;
  } catch (error) {
    console.error('[CoverLetterGenerator] AI generation failed:', error);
    // Minimal fallback
    const topSkills = userProfile.skills.slice(0, 3).join(', ');
    return `Hi there,\n\nI saw your post for ${jobTitle}. I have experience with ${topSkills} and would love to discuss how I can help. Happy to chat anytime.\n\n${userProfile.name}`;
  }
}

/**
 * Generate a subject line for the application email.
 */
export async function generateSubjectLine(params: {
  jobTitle: string;
  userName: string;
}): Promise<string> {
  const { jobTitle, userName } = params;
  const { client, model } = getAIClient();

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.5,
      max_tokens: 50,
      messages: [
        {
          role: 'system',
          content: 'Generate a short professional email subject line for a job application. Max 60 chars. Return ONLY the subject line, nothing else. Do NOT use "Application:" prefix — make it sound like a reply to their post.',
        },
        { role: 'user', content: `Role: ${jobTitle}, Applicant: ${userName}` },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return `Re: ${jobTitle}`;
    return content.replace(/^["']|["']$/g, '');
  } catch {
    return `Re: ${jobTitle}`;
  }
}

/**
 * Generate a follow-up email.
 */
export async function generateFollowUp(params: {
  jobTitle: string;
  companyName: string;
  userName: string;
  daysSinceSent: number;
}): Promise<string> {
  const { jobTitle, companyName, userName, daysSinceSent } = params;
  const { client, model } = getAIClient();

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.6,
      max_tokens: 200,
      messages: [
        {
          role: 'system',
          content: 'Write a complete short follow-up email (greeting + 2 sentences + sign-off). Polite bump, not pushy. Under 50 words.',
        },
        { role: 'user', content: `Role: ${jobTitle} at ${companyName}, Applicant: ${userName}, Sent ${daysSinceSent} days ago` },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (content) return content;
  } catch (error) {
    console.error('[CoverLetterGenerator] Follow-up generation failed:', error);
  }

  return `Hi there,\n\nJust bumping my note about the ${jobTitle} role. Still very interested — happy to hop on a quick call whenever works.\n\n${params.userName}`;
}
