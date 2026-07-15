import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/extension/token — session-authed. Returns the logged-in user's extension bearer token,
// generating one on first call. The user pastes this into the browser autofill extension once; the
// extension then calls /api/extension/* with Authorization: Bearer <token> (it runs on jobs.lever.co,
// a cross-origin page, so the session cookie isn't available to it).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const u = await prisma.user.findUnique({ where: { id: session.user.id }, select: { extensionToken: true, plan: true } });
  let token = u?.extensionToken || null;
  if (!token) {
    token = `fx_${randomBytes(24).toString('base64url')}`;
    await prisma.user.update({ where: { id: session.user.id }, data: { extensionToken: token } });
  }
  return NextResponse.json({ token, plan: u?.plan || 'FREE' });
}

// POST — rotate (revoke old, issue new).
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const token = `fx_${randomBytes(24).toString('base64url')}`;
  await prisma.user.update({ where: { id: session.user.id }, data: { extensionToken: token } });
  return NextResponse.json({ token });
}
