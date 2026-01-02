import { NextResponse } from 'next/server';

export async function GET() {
  const aiProvider = process.env.AI_PROVIDER;
  const hasDeepSeekKey = !!process.env.DEEPSEEK_API_KEY;
  const hasZaiKey = !!process.env.ZAI_API_KEY;

  return NextResponse.json({
    AI_PROVIDER: aiProvider || '(not set)',
    AI_PROVIDER_lowercase: aiProvider?.toLowerCase() || '(not set)',
    would_use: aiProvider?.toLowerCase() === 'zai' ? 'Z.ai' : 'DeepSeek',
    DEEPSEEK_API_KEY: hasDeepSeekKey ? 'set' : 'not set',
    ZAI_API_KEY: hasZaiKey ? 'set' : 'not set',
  });
}
