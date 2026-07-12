import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// Client-upload handshake for the in-browser video intro recorder. The video (20-100MB) goes from
// the browser STRAIGHT to Blob storage — Vercel serverless caps request bodies at 4.5MB, so a
// server-side pass-through is impossible (same wall the oversized-résumé bug hit). This route only
// (a) authorizes and issues the upload token, (b) persists the final URL onto the user.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        if (!session?.user?.id) throw new Error('Unauthorized');
        return {
          allowedContentTypes: ['video/webm', 'video/mp4', 'video/quicktime'],
          maximumSizeInBytes: 120 * 1024 * 1024, // ~2 min of camera video with headroom
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: session.user.id }),
        };
      },
      // Fires server-side after the blob lands (prod only — Vercel calls back over the public URL).
      // The client ALSO patches settings as a fallback, so a missed callback can't lose the URL.
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        try {
          const { userId } = JSON.parse(tokenPayload || '{}');
          if (userId) await prisma.user.update({ where: { id: userId }, data: { videoIntroUrl: blob.url } });
        } catch (e) {
          console.error('[video-upload] completion write failed:', (e as Error)?.message);
        }
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
