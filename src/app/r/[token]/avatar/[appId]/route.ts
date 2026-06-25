import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyRecruiterToken } from '@/lib/recruiter-token';

// GET /r/[token]/avatar/[appId]
// Proxies the candidate's LinkedIn profile photo (User.image) through our domain. LinkedIn CDN URLs
// can't be hot-linked reliably from another origin (referrer/expiry), so we fetch server-side and
// stream the bytes. 404 on any miss → the client <img> falls back to initials. Gated by the same
// signed recruiter token + ownership check as the CV route.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string; appId: string }> }) {
  const { token, appId } = await params;
  const email = verifyRecruiterToken(token);
  if (!email) return new NextResponse('forbidden', { status: 403 });

  const app = await prisma.autoApplication.findUnique({
    where: { id: appId },
    select: { appliedToEmail: true, user: { select: { image: true } } },
  });
  if (!app || app.appliedToEmail?.toLowerCase().trim() !== email.toLowerCase().trim()) {
    return new NextResponse('not found', { status: 404 });
  }

  const src = app.user.image;
  if (!src || !/^https?:\/\//.test(src)) return new NextResponse('no photo', { status: 404 });

  try {
    const res = await fetch(src, { headers: { 'User-Agent': 'Mozilla/5.0 Freelanly' } });
    if (!res.ok || !res.body) return new NextResponse('upstream', { status: 404 });
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) return new NextResponse('not an image', { status: 404 });
    const buf = Buffer.from(await res.arrayBuffer());
    return new NextResponse(buf, {
      status: 200,
      headers: { 'content-type': contentType, 'cache-control': 'private, max-age=86400' },
    });
  } catch {
    return new NextResponse('fetch failed', { status: 404 });
  }
}
