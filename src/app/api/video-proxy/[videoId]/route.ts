/**
 * Video Proxy - streams video from VPS Short Video Maker
 *
 * GET /api/video-proxy/[videoId]
 *
 * This endpoint proxies video files from the internal VPS service
 * to make them accessible via public Freelanly URL.
 */

import { NextRequest, NextResponse } from 'next/server';

const VPS_VIDEO_URL = 'http://198.12.73.168:3123/api/short-video';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params;

  if (!videoId || !/^[a-z0-9]+$/i.test(videoId)) {
    return NextResponse.json({ error: 'Invalid video ID' }, { status: 400 });
  }

  try {
    // Fetch video from VPS
    const response = await fetch(`${VPS_VIDEO_URL}/${videoId}`, {
      headers: {
        'Accept': 'video/mp4',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Video not found or not ready' },
        { status: response.status }
      );
    }

    // Get the video as array buffer
    const videoBuffer = await response.arrayBuffer();

    // Return video with correct headers
    return new NextResponse(videoBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': videoBuffer.byteLength.toString(),
        'Content-Disposition': `inline; filename="${videoId}.mp4"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[VideoProxy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video' },
      { status: 500 }
    );
  }
}
