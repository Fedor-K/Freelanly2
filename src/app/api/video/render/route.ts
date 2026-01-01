import { NextResponse } from 'next/server';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Video render configuration
const RENDER_CONFIG = {
  codec: 'h264' as const,
  imageFormat: 'jpeg' as const,
  chromiumOptions: {
    enableMultiProcessOnLinux: true,
  },
};

/**
 * POST /api/video/render
 * Render a video using Remotion
 *
 * Body:
 * - compositionId: 'JobAlert' | 'SalaryReveal' | 'TopJobs'
 * - inputProps: object with video data
 * - format: 'vertical' | 'square' | 'horizontal' (optional)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { compositionId, inputProps, format = 'vertical' } = body;

    if (!compositionId || !inputProps) {
      return NextResponse.json(
        { error: 'Missing compositionId or inputProps' },
        { status: 400 }
      );
    }

    // Adjust composition ID for format
    let finalCompositionId = compositionId;
    if (format === 'square' && compositionId === 'JobAlert') {
      finalCompositionId = 'JobAlert-Square';
    }

    console.log(`[VideoRender] Starting render: ${finalCompositionId}`);

    // Bundle the Remotion project
    const bundleLocation = await bundle({
      entryPoint: path.join(process.cwd(), 'src/remotion/index.ts'),
      webpackOverride: (config) => config,
    });

    // Select the composition
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: finalCompositionId,
      inputProps,
    });

    // Generate output path
    const outputDir = path.join(os.tmpdir(), 'remotion-videos');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(
      outputDir,
      `${finalCompositionId}-${Date.now()}.mp4`
    );

    // Render the video
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: RENDER_CONFIG.codec,
      outputLocation: outputPath,
      inputProps,
      chromiumOptions: RENDER_CONFIG.chromiumOptions,
    });

    console.log(`[VideoRender] Completed: ${outputPath}`);

    // Read the file and return as response
    const videoBuffer = fs.readFileSync(outputPath);

    // Clean up the file after reading
    fs.unlinkSync(outputPath);

    return new NextResponse(videoBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${finalCompositionId}.mp4"`,
      },
    });
  } catch (error) {
    console.error('[VideoRender] Error:', error);
    return NextResponse.json(
      { error: 'Failed to render video', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/video/render
 * Get available compositions
 */
export async function GET() {
  return NextResponse.json({
    compositions: [
      {
        id: 'JobAlert',
        description: 'Job alert video for social media',
        formats: ['vertical', 'square'],
        requiredProps: ['jobTitle', 'companyName', 'location', 'jobType'],
        optionalProps: ['companyLogo', 'salary'],
      },
      {
        id: 'SalaryReveal',
        description: 'Salary reveal video by experience level',
        formats: ['vertical'],
        requiredProps: ['categoryName'],
        optionalProps: ['entryLevel', 'midLevel', 'seniorLevel'],
      },
      {
        id: 'TopJobs',
        description: 'Top paying jobs video',
        formats: ['vertical'],
        requiredProps: ['jobs'],
        optionalProps: [],
      },
    ],
  });
}
