import OpenAI from 'openai';

// AI Provider — Z.ai (GLM-4-32B) only
let _zai: OpenAI | null = null;

function getZaiClient(): OpenAI {
  if (!_zai) {
    _zai = new OpenAI({
      apiKey: process.env.ZAI_API_KEY || 'dummy-key-for-build',
      baseURL: 'https://api.z.ai/api/paas/v4',
      timeout: 30000,
      maxRetries: 2,
    });
  }
  return _zai;
}

function getAIClient(): { client: OpenAI; model: string } {
  return { client: getZaiClient(), model: 'glm-4-32b-0414-128k' };
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
  // Feed more real material so the AI has concrete proof points to cite (the best-replying
  // letters are substantive ~700-1000 chars, not 100-word stubs).
  const experienceSnippet = (userProfile.resumeText || userProfile.experience || '').slice(0, 1500);

  // Randomize style + length to avoid pattern detection by recruiters receiving multiple applications
  const STYLES = [
    'Lead with the applicant\'s strongest achievement or a specific number/metric.',
    'Open with a question or observation about something specific in the job post.',
    'Start with a brief relevant story or anecdote from the applicant\'s experience.',
    'Begin with a direct, confident statement of fit — no preamble.',
    'React to one specific detail or requirement from the job description that genuinely excites.',
    'Open with what the applicant can deliver in the first 30 days.',
  ];
  const LENGTHS = [
    { label: 'concise', words: '80-100', paragraphs: '2 short' },
    { label: 'medium', words: '120-160', paragraphs: '2-3' },
    { label: 'detailed', words: '180-220', paragraphs: '3-4' },
  ];
  const style = STYLES[Math.floor(Math.random() * STYLES.length)];
  const length = LENGTHS[Math.floor(Math.random() * LENGTHS.length)];

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.85,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: styleOverride || `You are writing a job application email on behalf of someone. You receive ALL raw data about the job and the applicant. Write the COMPLETE email ready to send.

STYLE FOR THIS EMAIL: ${style}
LENGTH: ${length.label} — aim for ${length.words} words, ${length.paragraphs} paragraphs.

YOUR JOB:
1. Figure out who to address — look at the recruiter email and job description. If you can identify the person's actual first name, greet them by it (e.g. "Hi Sarah,"). If you CANNOT, write exactly "Hi there,". NEVER output a literal bracket placeholder like [Name], [Recruiter], [Company], [LinkedIn] or [Your Name] — fill it with the real value or leave it out.
2. Figure out the company — from the description, email domain, poster info, anything. Mention it.
3. FOLLOW THE STYLE INSTRUCTION ABOVE for the opening. NEVER default to "I saw the [role] at [company] and was interested" / "I noticed your post for". The first sentence must feel hand-written, not templated.
4. Give 1-2 CONCRETE proof points from the applicant's real background — a relevant project, result, or number. ONLY real things from the profile — NEVER invent.
5. End with a soft call to action.
6. Sign off with the applicant's name.

RULES:
- OUTPUT ONLY THE EMAIL ITSELF: greeting → 2-3 short body paragraphs → sign-off with the name. NEVER paste the résumé, an experience/education/skills list, contact blocks, phone numbers, links, or any raw profile data into the email. The Background you were given is reference material to mine ONE-TWO facts from — it must NOT appear in the output.
- NO unfilled placeholders in the output (no "[...]"). If you don't know a value, omit it.
- LEAD WITH THE APPLICANT'S STRONGEST GENUINE MATCH. NEVER mention a skill/technology the job asks for that the applicant does NOT have. Do not write "you need X — I have Y": that highlights the gap. If the overlap is partial, focus on the transferable strengths and never apologise for or draw attention to what's missing.
- ALWAYS write in FIRST PERSON (I/my/me). NEVER use third person or refer to the applicant by name in the body. "I have experience" NOT "John has experience".
- NEVER say "I am excited", "I am eager", "I am confident", "I am writing to express interest", "I believe I align".
- Sound like a real person writing a confident, specific note to someone they want to work with — not a template.
- Follow the LENGTH instruction above (${length.label}: ${length.words} words, ${length.paragraphs} paragraphs). Never pad with filler.
- Include line breaks between greeting, body paragraphs, and sign-off.`,
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

    let content = response.choices[0]?.message?.content?.trim();
    if (!content) return `${jobTitle} — ${userName}`;
    content = content.replace(/^["']|["']$/g, '');
    // Remove AI placeholders
    content = content.replace(/\[Company Name\]/gi, '').replace(/\[Your Name\]/gi, userName).replace(/\s{2,}/g, ' ').trim();
    return content;
  } catch {
    return `${jobTitle} — ${userName}`;
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
