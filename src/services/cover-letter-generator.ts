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
}

interface CoverLetterInput {
  jobTitle: string;
  jobDescription: string;
  companyName: string;
  userProfile: UserProfile;
}

/**
 * Generate a personalized cover letter using AI.
 * Returns a concise 3-5 sentence cover letter body (no greeting/signature).
 */
export async function generateCoverLetter(input: CoverLetterInput): Promise<string> {
  const { jobTitle, jobDescription, companyName, userProfile } = input;
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
          content:
            'Write a 3-5 sentence cover letter body for a job application. Be professional, specific to the role, and mention relevant skills. No greeting or signature — just the body text. Keep it under 150 words.',
        },
        {
          role: 'user',
          content: `Role: ${jobTitle} at ${companyName}
Description: ${truncatedDesc}
Applicant: ${userProfile.name}
Skills: ${skillsList}
Experience: ${experienceSnippet}`,
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
 * Fallback cover letter when AI is unavailable
 */
function generateFallbackCoverLetter(input: CoverLetterInput): string {
  const { jobTitle, companyName, userProfile } = input;
  const topSkills = userProfile.skills.slice(0, 3).join(', ');

  return `I am writing to express my interest in the ${jobTitle} position at ${companyName}. With my background in ${topSkills}, I believe I can make a meaningful contribution to your team. ${userProfile.experience ? 'My experience includes ' + userProfile.experience.slice(0, 150).trim() + '.' : ''} I would welcome the opportunity to discuss how my skills align with your needs.`;
}
