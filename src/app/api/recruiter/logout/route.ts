import { NextResponse } from 'next/server';
import { clearRecruiterSession } from '@/lib/recruiter-session';

// POST /api/recruiter/logout — clear the recruiter session cookie.
export async function POST() {
  await clearRecruiterSession();
  return NextResponse.json({ ok: true });
}
