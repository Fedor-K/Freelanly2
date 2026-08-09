import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendAutoApplyViaPostal } from '@/lib/email/postal';
import { escapeHtml } from '@/lib/html-escape';
import { fetchResumeAttachment } from '@/lib/resume-attachment';
import { consumeApplyQuota, refundApplyQuota } from '@/lib/apply-quota';
import { checkPartnerSecret } from '../_lib/partner';

/**
 * POST /api/partner/send — send a reviewed application for a watcher user.
 * Body: { userId, opportunityId, coverLetter, subject }
 *
 * Deliberately leaner than quick-apply: watcher users are $5 subscribers sending
 * from their own niche feed after reviewing the draft. Reply-To is the USER'S
 * real email (no reply+ routing) — recruiter replies land straight in their
 * inbox, so no engine reply-notification (which is Freelanly-branded) ever
 * reaches a watcher user. Daily anti-spam quota still applies.
 */
export async function POST(request: NextRequest) {
  if (!checkPartnerSecret(request)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  let quotaTaken = false;
  let quotaUserId = '';
  let quotaPlan = 'FREE';
  try {
    const { userId, opportunityId, coverLetter, subject } = await request.json();
    if (!userId || !opportunityId || !coverLetter || !subject) {
      return NextResponse.json({ error: 'userId, opportunityId, coverLetter, subject required' }, { status: 400 });
    }

    const [user, opportunity] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, plan: true, resumeUrl: true, resumeFileName: true, parsedProfile: true },
      }),
      prisma.opportunity.findUnique({
        where: { id: opportunityId },
        select: { id: true, title: true, clientName: true, applyEmail: true, isActive: true },
      }),
    ]);
    if (!user) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
    if (!opportunity?.applyEmail) return NextResponse.json({ error: 'no_apply_email' }, { status: 409 });

    // Dedup: one sent application per user↔opportunity, ever.
    const existing = await prisma.autoApplication.findFirst({
      where: { userId, opportunityId, sentAt: { not: null } },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ error: 'already_applied' }, { status: 409 });

    // Daily anti-spam brake (same slot pool the engine uses).
    const quotaOk = await consumeApplyQuota(user.id, user.plan);
    if (!quotaOk) {
      return NextResponse.json({ error: 'daily_limit', message: "That's all your sends for today — new ones open up tomorrow." }, { status: 429 });
    }
    quotaTaken = true; quotaUserId = user.id; quotaPlan = user.plan;

    const loop = (await prisma.autoApplyLoop.findFirst({ where: { userId: user.id } }))
      || (await prisma.autoApplyLoop.create({ data: { userId: user.id, name: 'Watcher', jobTitles: [], dailyLimit: 20, mode: 'MANUAL', isActive: false } }));

    const profile = (user.parsedProfile as Record<string, unknown> | null) || {};
    const userName = user.name || String(profile.name || '') || 'Applicant';
    const cv = await fetchResumeAttachment(user.resumeUrl, user.resumeFileName || undefined);

    const paragraphs = String(coverLetter)
      .split(/\n\s*\n/).map((b: string) => b.trim()).filter(Boolean)
      .map((b: string) => `<p style="margin: 0 0 14px; line-height: 1.6;">${escapeHtml(b).replace(/\s*\n\s*/g, ' ')}</p>`)
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; font-size: 15px; line-height: 1.6;">
${paragraphs}
</body></html>`;

    const appRecord = await prisma.autoApplication.create({
      data: {
        origin: 'SELF',
        userId: user.id,
        loopId: loop.id,
        opportunityId: opportunity.id,
        companyName: opportunity.clientName,
        jobTitle: opportunity.title,
        appliedToEmail: opportunity.applyEmail,
        coverLetter: String(coverLetter),
        subject: String(subject),
        status: 'SENDING',
        sentVia: 'postal',
      },
    });

    // No applicationId on purpose: Reply-To falls back to the user's own email,
    // keeping the whole reply path outside the engine's branded pipeline.
    const sent = await sendAutoApplyViaPostal({
      userName,
      userEmail: user.email,
      to: opportunity.applyEmail,
      subject: String(subject),
      html,
      text: String(coverLetter),
      attachmentBase64: cv?.base64,
      attachmentFilename: cv?.filename,
    });

    if (sent.success) {
      await prisma.autoApplication.update({ where: { id: appRecord.id }, data: { status: 'SENT', sentAt: new Date() } }).catch(() => {});
      return NextResponse.json({ ok: true, sentTo: opportunity.applyEmail });
    }
    await refundApplyQuota(quotaUserId, quotaPlan).catch(() => {});
    quotaTaken = false;
    await prisma.autoApplication.update({ where: { id: appRecord.id }, data: { status: 'FAILED', errorMessage: (sent.error || '').slice(0, 500) } }).catch(() => {});
    return NextResponse.json({ error: 'send_failed', message: sent.error }, { status: 502 });
  } catch (e) {
    if (quotaTaken) await refundApplyQuota(quotaUserId, quotaPlan).catch(() => {});
    return NextResponse.json({ error: 'internal', message: e instanceof Error ? e.message : 'unknown' }, { status: 500 });
  }
}
