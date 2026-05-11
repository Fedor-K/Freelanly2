import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/user/voice-training — get samples
 * POST /api/user/voice-training — save 1-3 sample emails
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { voiceSamples: true },
    });

    return NextResponse.json({ samples: (user?.voiceSamples as string[]) || [] });
  } catch (error) {
    console.error('[VoiceTraining] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { samples } = await request.json();

    if (!Array.isArray(samples) || samples.length > 3) {
      return NextResponse.json({ error: 'Provide 1-3 sample emails' }, { status: 400 });
    }

    // Trim and validate
    const cleaned = samples
      .filter((s: unknown) => typeof s === 'string' && (s as string).trim().length > 20)
      .slice(0, 3)
      .map((s: string) => s.trim().slice(0, 2000));

    await prisma.user.update({
      where: { id: session.user.id },
      data: { voiceSamples: cleaned },
    });

    return NextResponse.json({ success: true, count: cleaned.length });
  } catch (error) {
    console.error('[VoiceTraining] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
