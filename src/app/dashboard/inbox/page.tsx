import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { InboxClient } from '@/components/app/InboxClient';
import './inbox-design.css';

export const metadata: Metadata = {
  title: 'Inbox — Freelanly',
};

export const revalidate = 60;

export default async function InboxPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const replies = await prisma.autoApplication.findMany({
    where: { userId: session.user.id, status: { in: ['REPLIED', 'INTERVIEW', 'OFFER'] }, repliedAt: { not: null } },
    orderBy: { repliedAt: 'desc' },
    take: 30,
    select: {
      id: true, companyName: true, jobTitle: true, coverLetter: true,
      subject: true, replyText: true, replyCategory: true, replySignal: true,
      repliedAt: true, sentAt: true, appliedToEmail: true,
      user: { select: { name: true, email: true } },
    },
  });

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { resumeUrl: true, resumeFileName: true, telegramChatId: true },
  });
  // Only our own Blob-stored résumés are attachable (matches the SSRF guard server-side).
  const resumeAttachable = (() => {
    try { return !!me?.resumeUrl && new URL(me.resumeUrl).hostname.endsWith('.public.blob.vercel-storage.com'); } catch { return false; }
  })();

  const serialized = replies.map(r => ({
    id: r.id,
    companyName: r.companyName,
    jobTitle: r.jobTitle,
    coverLetter: r.coverLetter,
    subject: r.subject,
    replyText: r.replyText,
    replyCategory: r.replyCategory,
    replySignal: r.replySignal,
    repliedAt: r.repliedAt?.toISOString() || null,
    sentAt: r.sentAt?.toISOString() || null,
    appliedToEmail: r.appliedToEmail,
    userName: r.user.name || 'You',
    userEmail: r.user.email,
  }));

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h1>Inbox <span style={{fontSize: '16px', color: 'var(--ink-4)', fontWeight: 400, fontFamily: "'Geist Mono', monospace"}}>· {replies.length} repl{replies.length === 1 ? 'y' : 'ies'}</span></h1>
          <p>All replies routed to one place. Calls auto-booked when prospects pick a time.</p>
        </div>
      </div>

      <InboxClient replies={serialized} resumeAttachable={resumeAttachable} resumeFileName={me?.resumeFileName || null} telegramConnected={!!me?.telegramChatId} telegramLink={`https://t.me/FLalarmbot?start=direct_${session.user.id.slice(0, 12)}`} />
    </div>
  );
}
