import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

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

Rules:
- Be helpful, friendly, and concise
- When relevant, mention PRO benefits and link to freelanly.com/pricing
- If user asks something you can't answer, say you'll connect them with the team
- Reply in the same language the user writes in
- Keep responses short (2-3 sentences max unless explaining something complex)
- Don't make up information about specific jobs or companies`;

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
      model: 'glm-4-32b',
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
    const { message, history } = await request.json() as {
      message: string;
      history?: ChatMessage[];
    };

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    if (message.length > 1000) {
      return NextResponse.json({ error: 'Message too long' }, { status: 400 });
    }

    // Build messages array
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT },
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

    const reply = completion.choices[0]?.message?.content || 'Sorry, I could not process your request. Please try again.';

    // Check if bot wants to escalate
    const shouldEscalate = reply.toLowerCase().includes('connect you with') ||
      reply.toLowerCase().includes('team will') ||
      reply.toLowerCase().includes('переведу') ||
      reply.toLowerCase().includes('свяжу с');

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
    }, { status: 200 }); // Return 200 even on error so the widget shows the message
  }
}
