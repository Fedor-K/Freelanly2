import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRecruiterPortalUrl } from '@/lib/recruiter-token';

const ADMIN_EMAILS = ['fedor.hatla@gmail.com'];

// Admin-only "view as recruiter": mints a signed portal token for any recruiter email and redirects
// straight into their /r/<token> portal (the token authorizes on its own — no OTP needed). Lets the
// owner see exactly what a given recruiter sees, populated with that recruiter's real candidates.
//   /api/admin/view-recruiter?email=<recruiter@domain>
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'pass ?email=<recruiter email>' }, { status: 400 });
  }
  return NextResponse.redirect(getRecruiterPortalUrl(email));
}
