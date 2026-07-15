import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// CORS: the extension calls this from jobs.lever.co (cross-origin). Auth is a Bearer token (NOT a
// cookie), so allowing any origin is safe — a request is only useful with a valid token.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// GET /api/extension/profile — Bearer <extensionToken>. Returns the user's structured profile for
// autofilling an ATS form + a `pro` flag. Autofill is PRO-only: FREE tokens get pro:false and the
// extension shows an upgrade prompt instead of filling.
export async function GET(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return NextResponse.json({ error: 'no_token' }, { status: 401, headers: CORS });

  const u = await prisma.user.findUnique({
    where: { extensionToken: token },
    select: {
      name: true, email: true, plan: true, location: true, linkedinUrl: true, githubUrl: true,
      portfolioUrl: true, resumeUrl: true, resumeFileName: true, messenger: true, parsedProfile: true,
      salaryExpectation: true, availableFrom: true, workAuthorization: true,
    },
  });
  if (!u) return NextResponse.json({ error: 'invalid_token' }, { status: 401, headers: CORS });

  // FREE-FOR-ALL (owner 2026-07-15): autofill is open to everyone while we grow adoption — the
  // `pro` flag is still returned so the extension can re-gate later without an update.
  const pro = true;
  const pp = (u.parsedProfile || {}) as Record<string, unknown>;
  const fullName = (u.name || (typeof pp.name === 'string' ? pp.name : '') || '').trim();
  const [firstName, ...restName] = fullName.split(/\s+/);

  const profile = {
    fullName,
    firstName: firstName || '',
    lastName: restName.join(' '),
    email: u.email,
    phone: u.messenger || '',                 // WhatsApp/Telegram doubles as the phone field
    location: u.location || (typeof pp.location === 'string' ? pp.location : '') || '',
    linkedinUrl: u.linkedinUrl || '',
    githubUrl: u.githubUrl || '',
    portfolioUrl: u.portfolioUrl || '',
    currentTitle: typeof pp.current_title === 'string' ? pp.current_title : '',
    currentCompany: typeof pp.current_company === 'string' ? pp.current_company : '',
    yearsExperience: typeof pp.experience_years === 'number' ? pp.experience_years : null,
    skills: Array.isArray(pp.skills) ? (pp.skills as unknown[]).map(String).slice(0, 20) : [],
    salaryExpectation: u.salaryExpectation || '',
    availableFrom: u.availableFrom || '',
    workAuthorization: u.workAuthorization || '',
    resumeUrl: u.resumeUrl && /^https?:\/\//.test(u.resumeUrl) ? u.resumeUrl : null,
    resumeFileName: u.resumeFileName || 'resume.pdf',
  };

  return NextResponse.json({ pro, profile }, { headers: CORS });
}
