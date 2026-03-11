import { NextRequest, NextResponse } from 'next/server';
import { checkAdminSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// One-time endpoint to add messageId column to AlertNotification
// Safe to run multiple times (IF NOT EXISTS)
// DELETE THIS FILE after confirming the column exists
export async function POST(request: NextRequest) {
  const authError = await checkAdminSession(request);
  if (authError) return authError;

  try {
    // Add messageId column if it doesn't exist
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "AlertNotification"
      ADD COLUMN IF NOT EXISTS "messageId" TEXT
    `);

    // Add index if it doesn't exist
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "AlertNotification_messageId_idx"
      ON "AlertNotification" ("messageId")
    `);

    // Verify
    const result = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'AlertNotification' AND column_name = 'messageId'
    `;

    return NextResponse.json({
      success: true,
      message: 'messageId column added successfully',
      verified: result.length > 0,
    });
  } catch (error) {
    console.error('[DB Migrate] Error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
