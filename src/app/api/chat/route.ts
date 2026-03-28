import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/db';
import { getPriceCents, formatPrice } from '@/lib/geo-pricing';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

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

// Map category button labels to database slugs
const CATEGORY_SLUG_MAP: Record<string, string | null> = {
  'Development': 'engineering',
  'Design': 'design',
  'Translation': 'translation',
  'Marketing': 'marketing',
  'Writing': 'writing',
  'Data & Analytics': 'data',
  'Other': null,
};

const CATEGORY_LABELS = Object.keys(CATEGORY_SLUG_MAP);

const CATEGORY_BUTTONS = CATEGORY_LABELS.map(label => ({ label, value: label }));

// Quick reply values that trigger flow steps
const FLOW_TRIGGERS: Record<string, string> = {
  'See more projects': 'see_more',
  'Different category': 'different_category',
  'How to apply?': 'how_to_apply',
  'Sign up free': 'signup',
  'Tell me about PRO': 'pro_info',
  'See PRO pricing': 'pro_info',
  'Upgrade now': 'upgrade',
  'Maybe later': 'maybe_later',
  'Show me projects': 'show_projects',
  'Browse projects': 'browse_projects',
};

// Add utm_source=chatbot to freelanly.com URLs
function addUtmSource(url: string): string {
  if (url.includes('utm_source=')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}utm_source=chatbot`;
}

// Add utm_source to all freelanly.com links in a string
function addUtmSourceToContent(content: string): string {
  return content.replace(
    /https:\/\/freelanly\.com(\/[^\s)]*)/g,
    (match, path: string) => {
      const cleanPath = path.replace(/[.,;:!]+$/, '');
      if (cleanPath.includes('utm_source=')) return `https://freelanly.com${cleanPath}`;
      const separator = cleanPath.includes('?') ? '&' : '?';
      return `https://freelanly.com${cleanPath}${separator}utm_source=chatbot`;
    }
  );
}

// Try to detect the last selected category from conversation history
function detectCategoryFromHistory(history: ChatMessage[]): string | null {
  // Walk backwards through history to find the last category selection
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role === 'user' && CATEGORY_LABELS.includes(msg.content)) {
      return msg.content;
    }
  }
  return null;
}

// Count how many times "See more projects" was clicked (to calculate offset)
function countSeeMore(history: ChatMessage[]): number {
  let count = 0;
  for (const msg of history) {
    if (msg.role === 'user' && msg.content === 'See more projects') {
      count++;
    }
  }
  return count;
}

async function queryOpportunities(categorySlug: string | null, offset: number = 0) {
  const where: Record<string, unknown> = { isActive: true };
  if (categorySlug) {
    where.category = { slug: categorySlug };
  }

  const opportunities = await prisma.opportunity.findMany({
    where,
    select: {
      title: true,
      slug: true,
      clientName: true,
      country: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 3,
    skip: offset,
  });

  return opportunities;
}

function formatOpportunitiesList(
  opportunities: Array<{ title: string; slug: string; clientName: string; country: string | null }>,
  categoryLabel: string
): string {
  if (opportunities.length === 0) {
    return `No active ${categoryLabel.toLowerCase()} projects found right now. New projects are added multiple times per day — sign up for instant alerts to be the first to know!\n\n${addUtmSource('https://freelanly.com/auth/signin')}`;
  }

  const lines = opportunities.map((opp, i) => {
    const country = opp.country ? ` (${opp.country})` : '';
    return `${i + 1}. **${opp.title}** — ${opp.clientName}${country}`;
  });

  return `Here are the latest ${categoryLabel.toLowerCase()} projects:\n\n${lines.join('\n')}\n\nThese are the latest projects. Want to see more or refine your search?`;
}

function getProPricingMessage(countryCode: string | null): string {
  const priceCents = getPriceCents(countryCode);
  const pricePerContact = formatPrice(priceCents);

  return `\u{1F680} **PRO gives you the unfair advantage:**\n\n` +
    `\u2705 Direct contact details for every job\n` +
    `\u2705 Apply before others see the job\n` +
    `\u2705 Salary insights (full range + percentiles)\n` +
    `\u2705 Instant alerts for new matching jobs\n` +
    `\u2705 Single contact unlock for just ${pricePerContact}\n\n` +
    `**Pricing:**\n` +
    `\u2022 Monthly: \u20AC15/month (\u20AC0.50/day)\n` +
    `\u2022 Quarterly: \u20AC35/3 months (\u20AC0.39/day — save 22%)\n` +
    `\u2022 Annual: \u20AC150/year (\u20AC0.41/day — save 17%)\n\n` +
    `Cancel anytime. Jobs get filled fast \u2014 PRO members apply first!\n\n` +
    `${addUtmSource('https://freelanly.com/pricing')}`;
}

export async function POST(request: NextRequest) {
  try {
    const { message, history, sessionId, userStatus, userEmail, userId, quickReply } = await request.json() as {
      message: string;
      history?: ChatMessage[];
      sessionId?: string;
      userStatus?: 'anonymous' | 'FREE' | 'PRO';
      userEmail?: string;
      userId?: string;
      quickReply?: boolean;
    };

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    if (message.length > 1000) {
      return NextResponse.json({ error: 'Message too long' }, { status: 400 });
    }

    // Rate limit: 20 requests per minute per IP (prevents cost abuse)
    const clientIp = getClientIp(request.headers);
    const chatLimit = rateLimit('chat_ip', clientIp, 20, 60_000);
    if (chatLimit.limited) {
      return NextResponse.json({
        reply: 'You\'re sending messages too fast. Please wait a moment and try again.',
        escalate: false,
      }, { status: 429, headers: { 'Retry-After': String(chatLimit.retryAfter) } });
    }

    // Get user country from IP
    const userCountry = request.headers.get('x-vercel-ip-country') || null;
    const userCity = request.headers.get('x-vercel-ip-city') ? decodeURIComponent(request.headers.get('x-vercel-ip-city')!) : null;

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    const country = request.headers.get('x-vercel-ip-country') || null;
    const city = request.headers.get('x-vercel-ip-city') ? decodeURIComponent(request.headers.get('x-vercel-ip-city')!) : null;

    // Sanitize conversation history — prevent injection of arbitrary content
    const conversationHistory: ChatMessage[] = (history && Array.isArray(history))
      ? history
          .filter((m): m is ChatMessage =>
            m && typeof m === 'object' &&
            (m.role === 'user' || m.role === 'assistant') &&
            typeof m.content === 'string'
          )
          .slice(-10)
          .map(m => ({
            role: m.role,
            content: m.content.substring(0, 500),
          }))
      : [];

    // ==========================================
    // FLOW DETECTION — handle quick reply buttons
    // ==========================================

    if (quickReply) {
      const flowStep = FLOW_TRIGGERS[message];
      const isCategory = CATEGORY_LABELS.includes(message);

      // ----- Step 1: Category selected -----
      if (isCategory) {
        const categorySlug = CATEGORY_SLUG_MAP[message];
        try {
          const opportunities = await queryOpportunities(categorySlug, 0);
          const reply = formatOpportunitiesList(opportunities, message);
          const buttons = opportunities.length > 0
            ? [
                { label: 'See more projects', value: 'See more projects' },
                { label: 'Different category', value: 'Different category' },
                { label: 'How to apply?', value: 'How to apply?' },
              ]
            : [
                { label: 'Different category', value: 'Different category' },
                { label: 'Sign up free', value: 'Sign up free' },
              ];

          // Log
          prisma.activityLog.create({
            data: {
              userId: userId || null,
              action: 'CHAT_MESSAGE',
              sessionId: sessionId || null,
              details: {
                type: 'chat_message',
                flowStep: 'category_selected',
                category: message,
                userMessage: message,
                botReply: reply.substring(0, 500),
                userEmail: userEmail || undefined,
                userStatus: userStatus || 'anonymous',
              },
              ipAddress: ip,
              country,
              city,
            },
          }).catch(() => {});

          return NextResponse.json({ reply, escalate: false, buttons });
        } catch (err) {
          console.error('[Chat API] DB query error:', err);
          // Fall through to AI if DB fails
        }
      }

      // ----- Step: See more projects -----
      if (flowStep === 'see_more') {
        const lastCategory = detectCategoryFromHistory(conversationHistory);
        const categorySlug = lastCategory ? (CATEGORY_SLUG_MAP[lastCategory] ?? null) : null;
        const seeMoreCount = countSeeMore(conversationHistory) + 1; // +1 for current click
        const offset = seeMoreCount * 3;

        try {
          const opportunities = await queryOpportunities(categorySlug, offset);
          const categoryLabel = lastCategory || 'all';
          const reply = opportunities.length > 0
            ? formatOpportunitiesList(opportunities, categoryLabel)
            : `That's all the ${categoryLabel.toLowerCase()} projects we have right now. New projects are added multiple times per day!\n\nSign up for instant alerts to never miss a new one: ${addUtmSource('https://freelanly.com/auth/signin')}`;

          const buttons = opportunities.length > 0
            ? [
                { label: 'See more projects', value: 'See more projects' },
                { label: 'Different category', value: 'Different category' },
                { label: 'How to apply?', value: 'How to apply?' },
              ]
            : [
                { label: 'Different category', value: 'Different category' },
                { label: 'How to apply?', value: 'How to apply?' },
              ];

          prisma.activityLog.create({
            data: {
              userId: userId || null,
              action: 'CHAT_MESSAGE',
              sessionId: sessionId || null,
              details: {
                type: 'chat_message',
                flowStep: 'show_jobs',
                category: lastCategory || 'all',
                offset,
                userMessage: message,
                botReply: reply.substring(0, 500),
                userEmail: userEmail || undefined,
                userStatus: userStatus || 'anonymous',
              },
              ipAddress: ip,
              country,
              city,
            },
          }).catch(() => {});

          return NextResponse.json({ reply, escalate: false, buttons });
        } catch (err) {
          console.error('[Chat API] DB query error:', err);
        }
      }

      // ----- Step: Different category -----
      if (flowStep === 'different_category') {
        const reply = 'What kind of remote work are you looking for?';

        prisma.activityLog.create({
          data: {
            userId: userId || null,
            action: 'CHAT_MESSAGE',
            sessionId: sessionId || null,
            details: {
              type: 'chat_message',
              flowStep: 'category_selected',
              userMessage: message,
              botReply: reply,
              userEmail: userEmail || undefined,
              userStatus: userStatus || 'anonymous',
            },
            ipAddress: ip,
            country,
            city,
          },
        }).catch(() => {});

        return NextResponse.json({ reply, escalate: false, buttons: CATEGORY_BUTTONS });
      }

      // ----- Step: How to apply? -----
      if (flowStep === 'how_to_apply') {
        const lastCategory = detectCategoryFromHistory(conversationHistory);
        const categoryText = lastCategory ? lastCategory.toLowerCase() : 'matching';
        let reply: string;
        let buttons: Array<{ label: string; value: string }>;

        if (userStatus === 'PRO') {
          reply = `You can apply directly! Click on any project above to see the contact details and apply.\n\nBrowse all projects: ${addUtmSource('https://freelanly.com/freelance')}`;
          buttons = [
            { label: 'Browse projects', value: 'Browse projects' },
            { label: 'Different category', value: 'Different category' },
          ];
        } else if (userStatus === 'FREE') {
          const priceCents = getPriceCents(userCountry);
          const pricePerContact = formatPrice(priceCents);
          reply = `You need PRO to see contact details and apply directly. PRO members apply before others see the job!\n\nUnlock contacts from just ${pricePerContact} per job, or get unlimited access with a PRO subscription.\n\n${addUtmSource('https://freelanly.com/pricing')}`;
          buttons = [
            { label: 'See PRO pricing', value: 'See PRO pricing' },
            { label: 'Maybe later', value: 'Maybe later' },
          ];
        } else {
          // anonymous
          reply = `To apply, you need a free account. It takes 30 seconds and you'll get instant alerts for new ${categoryText} projects! \u{1F680}\n\nSign up here: ${addUtmSource('https://freelanly.com/auth/signin')}`;
          buttons = [
            { label: 'Sign up free', value: 'Sign up free' },
            { label: 'Tell me about PRO', value: 'Tell me about PRO' },
          ];
        }

        prisma.activityLog.create({
          data: {
            userId: userId || null,
            action: 'CHAT_MESSAGE',
            sessionId: sessionId || null,
            details: {
              type: 'chat_message',
              flowStep: 'how_to_apply',
              userMessage: message,
              botReply: reply.substring(0, 500),
              userEmail: userEmail || undefined,
              userStatus: userStatus || 'anonymous',
            },
            ipAddress: ip,
            country,
            city,
          },
        }).catch(() => {});

        return NextResponse.json({ reply, escalate: false, buttons });
      }

      // ----- Step: Tell me about PRO / See PRO pricing -----
      if (flowStep === 'pro_info') {
        const reply = getProPricingMessage(userCountry);
        const buttons = [
          { label: 'Upgrade now', value: 'Upgrade now' },
          { label: 'Maybe later', value: 'Maybe later' },
        ];

        prisma.activityLog.create({
          data: {
            userId: userId || null,
            action: 'CHAT_MESSAGE',
            sessionId: sessionId || null,
            details: {
              type: 'chat_message',
              flowStep: 'pro_info',
              userMessage: message,
              botReply: reply.substring(0, 500),
              userEmail: userEmail || undefined,
              userStatus: userStatus || 'anonymous',
            },
            ipAddress: ip,
            country,
            city,
          },
        }).catch(() => {});

        return NextResponse.json({ reply, escalate: false, buttons });
      }

      // ----- Step: Upgrade now -----
      if (flowStep === 'upgrade') {
        const reply = `Great choice! \u{1F389} Head to our pricing page to pick your plan:\n\n${addUtmSource('https://freelanly.com/pricing')}\n\nYou'll get instant access to contact details, apply to jobs, and salary insights.`;
        const buttons = [
          { label: 'Browse projects', value: 'Browse projects' },
        ];

        prisma.activityLog.create({
          data: {
            userId: userId || null,
            action: 'CHAT_MESSAGE',
            sessionId: sessionId || null,
            details: {
              type: 'chat_message',
              flowStep: 'pro_info',
              userMessage: message,
              botReply: reply.substring(0, 500),
              userEmail: userEmail || undefined,
              userStatus: userStatus || 'anonymous',
            },
            ipAddress: ip,
            country,
            city,
          },
        }).catch(() => {});

        return NextResponse.json({ reply, escalate: false, buttons });
      }

      // ----- Step: Sign up free -----
      if (flowStep === 'signup') {
        const reply = `Awesome! Create your free account in 30 seconds:\n\n${addUtmSource('https://freelanly.com/auth/signin')}\n\nYou'll get instant email alerts when new matching projects appear. \u{1F4E9}`;
        const buttons = [
          { label: 'Tell me about PRO', value: 'Tell me about PRO' },
          { label: 'Browse projects', value: 'Browse projects' },
        ];

        prisma.activityLog.create({
          data: {
            userId: userId || null,
            action: 'CHAT_MESSAGE',
            sessionId: sessionId || null,
            details: {
              type: 'chat_message',
              flowStep: 'how_to_apply',
              userMessage: message,
              botReply: reply.substring(0, 500),
              userEmail: userEmail || undefined,
              userStatus: userStatus || 'anonymous',
            },
            ipAddress: ip,
            country,
            city,
          },
        }).catch(() => {});

        return NextResponse.json({ reply, escalate: false, buttons });
      }

      // ----- Step: Maybe later -----
      if (flowStep === 'maybe_later') {
        const reply = `No worries! You can always browse projects for free. New ones are added daily.\n\n${addUtmSource('https://freelanly.com/freelance')}`;
        const buttons = [
          { label: 'Browse projects', value: 'Browse projects' },
          { label: 'Different category', value: 'Different category' },
        ];

        prisma.activityLog.create({
          data: {
            userId: userId || null,
            action: 'CHAT_MESSAGE',
            sessionId: sessionId || null,
            details: {
              type: 'chat_message',
              flowStep: 'free_text',
              userMessage: message,
              botReply: reply.substring(0, 500),
              userEmail: userEmail || undefined,
              userStatus: userStatus || 'anonymous',
            },
            ipAddress: ip,
            country,
            city,
          },
        }).catch(() => {});

        return NextResponse.json({ reply, escalate: false, buttons });
      }

      // ----- Step: Show me projects / Browse projects -----
      if (flowStep === 'show_projects' || flowStep === 'browse_projects') {
        const reply = 'What kind of remote work are you looking for?';

        prisma.activityLog.create({
          data: {
            userId: userId || null,
            action: 'CHAT_MESSAGE',
            sessionId: sessionId || null,
            details: {
              type: 'chat_message',
              flowStep: 'category_selected',
              userMessage: message,
              botReply: reply,
              userEmail: userEmail || undefined,
              userStatus: userStatus || 'anonymous',
            },
            ipAddress: ip,
            country,
            city,
          },
        }).catch(() => {});

        return NextResponse.json({ reply, escalate: false, buttons: CATEGORY_BUTTONS });
      }
    }

    // ==========================================
    // FREE TEXT — AI fallback (existing logic)
    // ==========================================

    // Build messages array with user-status-aware system prompt + country
    let systemPrompt = getSystemPromptWithUserStatus(userStatus);
    if (userCountry) {
      systemPrompt += `\n\nUser's location: ${userCountry}${userCity ? `, ${userCity}` : ''}. Personalize responses for their country — mention relevant local opportunities, use their context. Link to country-specific pages like https://freelanly.com/freelance?country=${userCountry} when relevant.`;
    }

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history (last 10 messages max)
    if (conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-10);
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
    reply = addUtmSourceToContent(reply);

    // Check if bot wants to escalate
    const shouldEscalate = reply.toLowerCase().includes('connect you with') ||
      reply.toLowerCase().includes('team will') ||
      reply.toLowerCase().includes('переведу') ||
      reply.toLowerCase().includes('свяжу с');

    // Determine contextual buttons for AI responses
    let buttons: Array<{ label: string; value: string }>;
    const replyLower = reply.toLowerCase();
    if (replyLower.includes('pricing') || replyLower.includes('pro ') || replyLower.includes('upgrade')) {
      buttons = [
        { label: 'See PRO pricing', value: 'See PRO pricing' },
        { label: 'Browse projects', value: 'Browse projects' },
      ];
    } else if (replyLower.includes('job') || replyLower.includes('project') || replyLower.includes('opportunit')) {
      buttons = [
        { label: 'Show me projects', value: 'Show me projects' },
        { label: 'How to apply?', value: 'How to apply?' },
      ];
    } else {
      buttons = [
        { label: 'Browse projects', value: 'Browse projects' },
        { label: 'How to apply?', value: 'How to apply?' },
      ];
    }

    // Log chat message to DB (non-blocking)
    prisma.activityLog.create({
      data: {
        userId: userId || null,
        action: 'CHAT_MESSAGE',
        sessionId: sessionId || null,
        details: {
          type: 'chat_message',
          flowStep: 'free_text',
          userMessage: message.substring(0, 500),
          botReply: reply.substring(0, 500),
          escalated: shouldEscalate,
          userEmail: userEmail || undefined,
          userStatus: userStatus || 'anonymous',
        },
        ipAddress: ip,
        country,
        city,
      },
    }).catch(() => {});

    return NextResponse.json({
      reply,
      escalate: shouldEscalate,
      buttons,
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
