import OpenAI from 'openai';

// AI Provider configuration — mirrors src/lib/deepseek.ts pattern
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
    return {
      client: getZaiClient(),
      model: 'glm-4-32b-0414-128k',
      provider: 'zai',
    };
  }
  return {
    client: getDeepSeekClient(),
    model: 'deepseek-chat',
    provider: 'deepseek',
  };
}

interface UserProfile {
  name: string;
  skills: string[];
  experience: string;
  resumeText?: string;
  languages?: string[];
  workPreference?: string;
}

interface CoverLetterInput {
  jobTitle: string;
  jobDescription: string;
  companyName: string;
  userProfile: UserProfile;
  styleOverride?: string;
}

/**
 * Generate a personalized cover letter using AI.
 * Returns a concise 3-5 sentence cover letter body (no greeting/signature).
 */
export async function generateCoverLetter(input: CoverLetterInput): Promise<string> {
  const { jobTitle, jobDescription, companyName, userProfile, styleOverride } = input;
  const { client, model } = getAIClient();

  // Truncate job description to save tokens
  const truncatedDesc = jobDescription.slice(0, 800);
  const skillsList = userProfile.skills.slice(0, 10).join(', ');
  const experienceSnippet = userProfile.experience.slice(0, 300);

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.7,
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: styleOverride ||
            'Write a 3-5 sentence cover letter body for a job application. Be professional and specific to the role. CRITICAL: ONLY mention skills, languages, and experience that are explicitly listed in the applicant\'s profile below. NEVER invent, fabricate, or assume skills the applicant does not have. If the applicant lacks a key requirement, focus on transferable skills they DO have. No greeting or signature — just the body text. Keep it under 150 words.',
        },
        {
          role: 'user',
          content: `Role: ${jobTitle} at ${companyName}
Description: ${truncatedDesc}
Applicant: ${userProfile.name}
Skills: ${skillsList}
Languages: ${userProfile.languages?.join(', ') || 'Not specified'}
Experience: ${experienceSnippet}
${userProfile.workPreference ? `Work preference: ${userProfile.workPreference}` : ''}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Empty AI response');
    }

    return content;
  } catch (error) {
    console.error('[CoverLetterGenerator] AI generation failed:', error);

    // Fallback: generate a basic template-based cover letter
    return generateFallbackCoverLetter(input);
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
          content:
            'Generate a short professional email subject line for a job application. Max 60 chars. Return ONLY the subject line, nothing else.',
        },
        {
          role: 'user',
          content: `Role: ${jobTitle}, Applicant: ${userName}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      return `Application for ${jobTitle} — ${userName}`;
    }

    // Remove quotes if AI wraps in quotes
    return content.replace(/^["']|["']$/g, '');
  } catch (error) {
    console.error('[CoverLetterGenerator] Subject line generation failed:', error);
    return `Application for ${jobTitle} — ${userName}`;
  }
}

/**
 * Generate a follow-up email body.
 * Short, polite nudge referencing the original application.
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
          content:
            'Write a 2-3 sentence follow-up email body for a job application sent a few days ago. Be polite, brief, and express continued interest. No greeting or signature — just the body. Keep it under 80 words.',
        },
        {
          role: 'user',
          content: `Role: ${jobTitle} at ${companyName}, Applicant: ${userName}, Sent ${daysSinceSent} days ago`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (content) return content;
  } catch (error) {
    console.error('[CoverLetterGenerator] Follow-up generation failed:', error);
  }

  return `I wanted to follow up on my application for the ${jobTitle} position at ${companyName}. I remain very interested in this opportunity and would welcome the chance to discuss how I can contribute to your team.`;
}

/**
 * Fallback cover letter when AI is unavailable
 */
function generateFallbackCoverLetter(input: CoverLetterInput): string {
  const { jobTitle, companyName, userProfile } = input;
  const topSkills = userProfile.skills.slice(0, 3).join(', ');

  return `I am writing to express my interest in the ${jobTitle} position at ${companyName}. With my background in ${topSkills}, I believe I can make a meaningful contribution to your team. ${userProfile.experience ? 'My experience includes ' + userProfile.experience.slice(0, 150).trim() + '.' : ''} I would welcome the opportunity to discuss how my skills align with your needs.`;
}
