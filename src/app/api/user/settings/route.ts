import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { usernameFromGitHubUrl } from '@/lib/github-review/extract-username';

// GET /api/user/settings - Get full user settings + loop settings
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        headline: true,
        location: true,
        availability: true,
        availableFrom: true,
        rateFloorHourly: true,
        rateFloorProject: true,
        caseStudies: true,
        linkedinUrl: true,
        githubUrl: true,
        resumeUrl: true,
        timezone: true,
        sendStartHour: true,
        sendEndHour: true,
        sendWeekdaysOnly: true,
        notifyOnReply: true,
        notifyDigest: true,
        notifySlackUrl: true,
        bookingUrl: true,
        voiceSamples: true,
        plan: true,
        userSmtp: { select: { host: true, email: true, verified: true } },
        gmailAuth: { select: { email: true, verified: true } },
        autoApplyLoops: {
          where: { isActive: true },
          take: 1,
          select: {
            id: true,
            dailyLimit: true,
            matchThreshold: true,
            followUpDay1: true,
            followUpDay2: true,
            followUpEnabled: true,
            pauseOnUnanswered: true,
            pauseOnLowRate: true,
            pauseOnInactive: true,
            excludeKeywords: true,
            mode: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const loop = user.autoApplyLoops[0] || null;

    return NextResponse.json({
      profile: {
        name: user.name,
        email: user.email,
        headline: user.headline,
        location: user.location,
        availability: user.availability,
        availableFrom: user.availableFrom,
        rateFloorHourly: user.rateFloorHourly,
        rateFloorProject: user.rateFloorProject,
        caseStudies: user.caseStudies,
        linkedinUrl: user.linkedinUrl,
        resumeUrl: user.resumeUrl,
        bookingUrl: user.bookingUrl,
        voiceSamples: user.voiceSamples,
      },
      sendingRules: {
        timezone: user.timezone,
        sendStartHour: user.sendStartHour ?? 9,
        sendEndHour: user.sendEndHour ?? 17,
        sendWeekdaysOnly: user.sendWeekdaysOnly,
        dailyLimit: loop?.dailyLimit ?? 10,
        matchThreshold: loop?.matchThreshold ?? 50,
        excludeKeywords: loop?.excludeKeywords || '',
        followUpEnabled: loop?.followUpEnabled ?? true,
        followUpDay1: loop?.followUpDay1 ?? 4,
        followUpDay2: loop?.followUpDay2 ?? 8,
        pauseOnUnanswered: loop?.pauseOnUnanswered,
        pauseOnLowRate: loop?.pauseOnLowRate,
        pauseOnInactive: loop?.pauseOnInactive,
        mode: loop?.mode || 'AUTO',
      },
      integrations: {
        smtp: user.userSmtp ? { host: user.userSmtp.host, email: user.userSmtp.email, verified: user.userSmtp.verified } : null,
        gmail: user.gmailAuth ? { email: user.gmailAuth.email, verified: user.gmailAuth.verified } : null,
        linkedin: user.linkedinUrl ? { connected: true, url: user.linkedinUrl } : null,
      },
      notifications: {
        onReply: user.notifyOnReply,
        digest: user.notifyDigest,
        slackUrl: user.notifySlackUrl,
      },
      plan: user.plan,
    });
  } catch (error) {
    console.error('[Settings] GET error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// PATCH /api/user/settings - Update user settings
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { section } = body;

    if (section === 'profile') {
      const { name, headline, location, availability, availableFrom,
        rateFloorHourly, rateFloorProject, caseStudies, linkedinUrl, bookingUrl, githubUrl } = body;

      // githubUrl: empty clears; anything else must parse to a github.com/<user> profile and is
      // stored normalized (feeds the GitHubReview verification pipeline).
      let githubUrlNorm: string | null | undefined = undefined;
      if (githubUrl !== undefined) {
        const trimmed = String(githubUrl || '').trim();
        if (!trimmed) {
          githubUrlNorm = null;
        } else {
          const ghUser = usernameFromGitHubUrl(trimmed);
          if (!ghUser) {
            return NextResponse.json({ error: "That doesn't look like a GitHub profile URL" }, { status: 400 });
          }
          githubUrlNorm = `https://github.com/${ghUser}`;
        }
      }

      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          ...(name !== undefined && { name: name?.trim() || null }),
          ...(headline !== undefined && { headline: headline?.trim() || null }),
          ...(location !== undefined && { location: location?.trim() || null }),
          ...(availability !== undefined && { availability: availability?.trim() || null }),
          ...(availableFrom !== undefined && { availableFrom: availableFrom?.trim() || null }),
          ...(rateFloorHourly !== undefined && { rateFloorHourly: rateFloorHourly ? parseInt(rateFloorHourly) : null }),
          ...(rateFloorProject !== undefined && { rateFloorProject: rateFloorProject ? parseInt(rateFloorProject) : null }),
          ...(caseStudies !== undefined && { caseStudies: caseStudies || null }),
          ...(linkedinUrl !== undefined && { linkedinUrl: linkedinUrl?.trim() || null }),
          ...(bookingUrl !== undefined && { bookingUrl: bookingUrl?.trim() || null }),
          ...(githubUrlNorm !== undefined && { githubUrl: githubUrlNorm }),
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (section === 'sendingRules') {
      const { timezone, sendStartHour, sendEndHour, sendWeekdaysOnly,
        dailyLimit, matchThreshold, excludeKeywords, mode,
        followUpEnabled, followUpDay1, followUpDay2,
        pauseOnUnanswered, pauseOnLowRate, pauseOnInactive } = body;

      // Update user-level send schedule
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          ...(timezone !== undefined && { timezone }),
          ...(sendStartHour !== undefined && { sendStartHour: parseInt(sendStartHour) }),
          ...(sendEndHour !== undefined && { sendEndHour: parseInt(sendEndHour) }),
          ...(sendWeekdaysOnly !== undefined && { sendWeekdaysOnly }),
        },
      });

      // Update active loop settings
      const activeLoop = await prisma.autoApplyLoop.findFirst({
        where: { userId: session.user.id, isActive: true },
      });

      if (activeLoop) {
        await prisma.autoApplyLoop.update({
          where: { id: activeLoop.id },
          data: {
            ...(dailyLimit !== undefined && { dailyLimit: Math.max(1, Math.min(100, parseInt(dailyLimit))) }),
            ...(matchThreshold !== undefined && { matchThreshold: Math.max(0, Math.min(100, parseInt(matchThreshold))) }),
            ...(excludeKeywords !== undefined && { excludeKeywords }),
            ...(mode !== undefined && { mode }),
            ...(followUpEnabled !== undefined && { followUpEnabled }),
            ...(followUpDay1 !== undefined && { followUpDay1: parseInt(followUpDay1) }),
            ...(followUpDay2 !== undefined && { followUpDay2: parseInt(followUpDay2) }),
            ...(pauseOnUnanswered !== undefined && { pauseOnUnanswered: pauseOnUnanswered ? parseInt(pauseOnUnanswered) : null }),
            ...(pauseOnLowRate !== undefined && { pauseOnLowRate: pauseOnLowRate ? parseFloat(pauseOnLowRate) : null }),
            ...(pauseOnInactive !== undefined && { pauseOnInactive: pauseOnInactive ? parseInt(pauseOnInactive) : null }),
          },
        });
      }
      return NextResponse.json({ ok: true });
    }

    if (section === 'notifications') {
      const { onReply, digest, slackUrl } = body;
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          ...(onReply !== undefined && { notifyOnReply: onReply }),
          ...(digest !== undefined && { notifyDigest: digest }),
          ...(slackUrl !== undefined && { notifySlackUrl: slackUrl?.trim() || null }),
        },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown section' }, { status: 400 });
  } catch (error) {
    console.error('[Settings] PATCH error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
