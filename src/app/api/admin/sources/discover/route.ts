import { NextRequest, NextResponse } from 'next/server';
import {
  discoverLeverCompanies,
  getDiscoveryProgress,
  cancelDiscovery,
  addDiscoveredSources,
} from '@/services/lever-discovery';

// GET /api/admin/sources/discover - Get current discovery progress
export async function GET() {
  const progress = getDiscoveryProgress();
  return NextResponse.json({ progress });
}

// POST /api/admin/sources/discover - Start discovery or add sources
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, searchQuery, maxPages, slugs } = body;

    if (action === 'start') {
      // Check if discovery is already running
      const currentProgress = getDiscoveryProgress();
      if (currentProgress?.status === 'running') {
        return NextResponse.json(
          { error: 'Discovery is already running' },
          { status: 400 }
        );
      }

      // Start discovery in background (don't await)
      discoverLeverCompanies(
        searchQuery || 'site:jobs.lever.co',
        maxPages || 10
      ).catch(console.error);

      return NextResponse.json({
        success: true,
        message: 'Discovery started',
      });
    }

    if (action === 'add') {
      // Add discovered slugs to database
      if (!slugs || !Array.isArray(slugs) || slugs.length === 0) {
        return NextResponse.json(
          { error: 'No slugs provided' },
          { status: 400 }
        );
      }

      const result = await addDiscoveredSources(slugs);

      return NextResponse.json({
        success: true,
        message: `Added ${result.added} sources, skipped ${result.skipped}`,
        ...result,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Discovery error:', error);
    return NextResponse.json(
      { error: 'Discovery failed', details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/sources/discover - Cancel current discovery
export async function DELETE() {
  cancelDiscovery();
  return NextResponse.json({
    success: true,
    message: 'Discovery cancelled',
  });
}
