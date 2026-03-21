import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/db';

const SYSTEM_PROMPT = `You are Freelanly's friendly support assistant. You help users find remote jobs and understand how Freelanly works.

About Freelanly:
- Freelanly.com is a platform for finding remote jobs and freelance projects
- We aggregate jobs from LinkedIn, Lever, Greenhouse, Ashby, Workable, SmartRecruiters
- New jobs are added multiple times per day
- Users can set up instant job alerts by category (engineering, design, data, translation, etc.)

Plans:
- FREE: Browse jobs, save jobs, get instant alerts. Cannot see contact details or apply.
- PRO: Everything in FREE + direct contact details, apply to jobs, salary insights.
  Pricing: €15/month (Monthly), €35/3 months (Quarterly, save 22%), €150/year (Annual, save 17%).
  Cancel anytime.

How it works:
1. Sign up free — takes 30 seconds
2. Choose job categories you're interested in
3. Get instant email alerts when matching jobs appear
4. Upgrade to PRO to see contact details and apply directly

Key benefits of PRO:
- Direct contact with recruiters — no agencies, no middlemen
- Apply before others see the job on crowded job boards
- Salary insights with full range and percentiles
- Instant alerts for new matching jobs

Common questions:
- "How to cancel?" → Go to Dashboard → Settings, or contact us and we'll cancel for you
- "Is there a free trial?" → No trial, but you can browse all jobs for free. PRO unlocks contact details.
- "What categories?" → Engineering, Design, Data, DevOps, QA, Security, Product, Marketing, Sales, Finance, HR, Operations, Legal, Project Management, Writing, Translation, Creative, Support, Education, Research, Consulting
- "How do alerts work?" → Choose categories when you sign up. We'll email you instantly when matching jobs appear.
- "Can I get a refund?" → Contact us within 7 days of purchase for a full refund.

Key links (ALWAYS include relevant links in your responses):
- Browse all projects: https://freelanly.com/freelance
- Translation projects: https://freelanly.com/freelance?category=translation
- Engineering projects: https://freelanly.com/freelance?category=engineering
- Design projects: https://freelanly.com/freelance?category=design
- Marketing projects: https://freelanly.com/freelance?category=marketing
- Writing projects: https://freelanly.com/freelance?category=writing
- Data projects: https://freelanly.com/freelance?category=data
- All jobs (ATS): https://freelanly.com/jobs
- Pricing / Upgrade to PRO: https://freelanly.com/pricing
- Sign up free: https://freelanly.com/auth/signin
- Dashboard / Manage alerts: https://freelanly.com/dashboard/alerts
- Contact: info@freelanly.com

Rules:
- Be helpful, friendly, and concise
- ALWAYS include a relevant link in your response (browse jobs, pricing, signup, etc.)
- When user asks about specific job categories, link to that category page
- If user asks something you can't answer, say you'll connect them with the team
- Reply in the same language the user writes in
- Keep responses short (2-3 sentences max unless explaining something complex)
- Don't make up information about specific jobs or companies

SALES RULES (important!):
- Your main goal is to CONVERT users — get them to sign up or upgrade to PRO
- After answering their question, ALWAYS add a call-to-action:
  - For anonymous users: push to sign up ("Sign up free to get instant alerts: https://freelanly.com/auth/signin")
  - For FREE users: push to PRO ("Upgrade to PRO to see contacts and apply directly — from €0.39/day: https://freelanly.com/pricing")
  - For PRO users: be helpful, no upselling needed
- Ask engaging follow-up questions: "What category are you looking for?", "Which country do you prefer?"
- Create urgency: "Jobs get filled fast — PRO members apply first"
- Mention specific numbers: "We have 13,000+ active remote jobs right now"
- Never be pushy or annoying — be naturally helpful while guiding to conversion`;

// Add user status context to the system prompt
function getSystemPromptWithUserStatus(status?: string): string {
  const statusContext = status === 'PRO'
    ? '\n\nCurrent user: PRO subscriber. Be helpful, no need to upsell. Help them find and apply to jobs.'
    : status === 'FREE'
    ? '\n\nCurrent user: FREE plan (logged in). They can browse but cannot see contacts or apply. Your goal: convince them to upgrade to PRO. Mention specific benefits they are missing.'
    : '\n\nCurrent user: NOT logged in (anonymous visitor). Your goal: get them to sign up for free first. Mention it takes 30 seconds and they get instant job alerts.';
  return SYSTEM_PROMPT + statusContext;
}

function getAIClient() {
  // Try Z.ai first, fallback to DeepSeek
  if (process.env.ZAI_API_KEY) {
    return {
      client: new OpenAI({
        apiKey: process.env.ZAI_API_KEY,
        baseURL: 'https://api.z.ai/api/paas/v4',
        timeout: 15000,
        maxRetries: 1,
      }),
      model: 'glm-4-32b-0414-128k',
    };
  }
  return {
    client: new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      baseURL: 'https://api.deepseek.com/v1',
      timeout: 15000,
    }),
    model: 'deepseek-chat',
  };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const { message, history, sessionId, userStatus } = await request.json() as {
      message: string;
      history?: ChatMessage[];
      sessionId?: string;
      userStatus?: 'anonymous' | 'FREE' | 'PRO';
    };

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    if (message.length > 1000) {
      return NextResponse.json({ error: 'Message too long' }, { status: 400 });
    }

    // Get user country from IP
    const userCountry = request.headers.get('x-vercel-ip-country') || null;
    const userCity = request.headers.get('x-vercel-ip-city') ? decodeURIComponent(request.headers.get('x-vercel-ip-city')!) : null;

    // Build messages array with user-status-aware system prompt + country
    let systemPrompt = getSystemPromptWithUserStatus(userStatus);
    if (userCountry) {
      systemPrompt += `\n\nUser's location: ${userCountry}${userCity ? `, ${userCity}` : ''}. Personalize responses for their country — mention relevant local opportunities, use their context. Link to country-specific pages like https://freelanly.com/freelance?country=${userCountry} when relevant.`;
    }

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history (last 10 messages max)
    if (history && Array.isArray(history)) {
      const recentHistory = history.slice(-10);
      for (const msg of recentHistory) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content.substring(0, 500) });
        }
      }
    }

    messages.push({ role: 'user', content: message });

    const { client, model } = getAIClient();

    const completion = await client.chat.completions.create({
      model,
      messages,
      max_tokens: 300,
      temperature: 0.7,
    });

    let reply = completion.choices[0]?.message?.content || 'Sorry, I could not process your request. Please try again.';

    // Add utm_source=chatbot to all freelanly.com links in reply
    reply = reply.replace(
      /https:\/\/freelanly\.com(\/[^\s)]*)/g,
      (match, path: string) => {
        // Strip trailing punctuation (. , ; : !)
        const cleanPath = path.replace(/[.,;:!]+$/, '');
        const separator = cleanPath.includes('?') ? '&' : '?';
        return `https://freelanly.com${cleanPath}${separator}utm_source=chatbot`;
      }
    );

    // Check if bot wants to escalate
    const shouldEscalate = reply.toLowerCase().includes('connect you with') ||
      reply.toLowerCase().includes('team will') ||
      reply.toLowerCase().includes('переведу') ||
      reply.toLowerCase().includes('свяжу с');

    // Log chat message to DB (non-blocking)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    const country = request.headers.get('x-vercel-ip-country') || null;
    const city = request.headers.get('x-vercel-ip-city') ? decodeURIComponent(request.headers.get('x-vercel-ip-city')!) : null;
    prisma.activityLog.create({
      data: {
        action: 'CHAT_MESSAGE',
        sessionId: sessionId || null,
        details: {
          type: 'chat_message',
          userMessage: message.substring(0, 500),
          botReply: reply.substring(0, 500),
          escalated: shouldEscalate,
        },
        ipAddress: ip,
        country,
        city,
      },
    }).catch(() => {});

    return NextResponse.json({
      reply,
      escalate: shouldEscalate,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[Chat API] Error:', errMsg);
    return NextResponse.json({
      reply: 'Sorry, something went wrong. Please try again or email us at info@freelanly.com.',
      escalate: false,
    }, { status: 200 });
  }
}
