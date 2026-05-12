import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/user/export
 * CSV export of all applications.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const apps = await prisma.autoApplication.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        jobTitle: true,
        companyName: true,
        appliedToEmail: true,
        status: true,
        matchScore: true,
        matchLabel: true,
        coverLetter: true,
        subject: true,
        sentVia: true,
        sentAt: true,
        followUpSentAt: true,
        replyText: true,
        createdAt: true,
      },
    });

    // Build CSV
    const headers = ['Job Title', 'Company', 'Email', 'Status', 'Match Score', 'Match Label', 'Subject', 'Sent Via', 'Sent At', 'Follow-up At', 'Reply Text', 'Created At'];
    const rows = apps.map(a => [
      `"${(a.jobTitle || '').replace(/"/g, '""')}"`,
      `"${(a.companyName || '').replace(/"/g, '""')}"`,
      a.appliedToEmail,
      a.status,
      a.matchScore || '',
      a.matchLabel || '',
      `"${(a.subject || '').replace(/"/g, '""')}"`,
      a.sentVia || '',
      a.sentAt?.toISOString() || '',
      a.followUpSentAt?.toISOString() || '',
      `"${(a.replyText || '').replace(/"/g, '""').slice(0, 200)}"`,
      a.createdAt.toISOString(),
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="freelanly-applications-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    console.error('[Export] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
