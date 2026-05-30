import { redirect } from 'next/navigation';
import { getRecruiterSession } from '@/lib/recruiter-session';
import { signRecruiterToken } from '@/lib/recruiter-token';

export const dynamic = 'force-dynamic';

// /recruiter — the logged-in entry point. A valid session cookie drops the recruiter straight
// into their existing /r/<token> portal (zero duplication — the portal IS the dashboard);
// otherwise send them to the login screen.
export default async function RecruiterHome() {
  const email = await getRecruiterSession();
  if (!email) redirect('/recruiter/login');
  redirect(`/r/${signRecruiterToken(email)}`);
}
