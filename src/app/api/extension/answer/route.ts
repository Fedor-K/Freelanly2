import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { answerApplicationQuestion } from '@/lib/ai';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// POST /api/extension/answer — Bearer <extensionToken>, PRO-only. Body: { question, jobContext? }.
// Returns { answer } filled from the candidate's profile, or { answer: '' } (leave for the user) when
// the profile lacks the info. Powers the autofill of ATS custom screening questions.
export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return NextResponse.json({ error: 'no_token' }, { status: 401, headers: CORS });

  const u = await prisma.user.findUnique({
    where: { extensionToken: token },
    select: { plan: true, name: true, resumeText: true, parsedProfile: true, linkedinUrl: true, githubUrl: true, salaryExpectation: true, availableFrom: true, workAuthorization: true, location: true },
  });
  if (!u) return NextResponse.json({ error: 'invalid_token' }, { status: 401, headers: CORS });
  // FREE-FOR-ALL (owner 2026-07-15): AI answers open to everyone while we grow adoption.

  const body = await req.json().catch(() => ({}));
  const question = String(body.question || '').trim();
  if (!question) return NextResponse.json({ error: 'no_question', answer: '' }, { status: 400, headers: CORS });

  const pp = (u.parsedProfile || {}) as Record<string, unknown>;
  const ctx = [
    u.name ? `Name: ${u.name}` : '',
    typeof pp.current_title === 'string' ? `Title: ${pp.current_title}` : '',
    typeof pp.experience_years === 'number' ? `Years experience: ${pp.experience_years}` : '',
    u.location ? `Location: ${u.location}` : '',
    Array.isArray(pp.skills) ? `Skills: ${(pp.skills as unknown[]).map(String).slice(0, 20).join(', ')}` : '',
    u.workAuthorization ? `Work authorization: ${u.workAuthorization}` : '',
    u.availableFrom ? `Available from: ${u.availableFrom}` : '',
    u.salaryExpectation ? `Salary expectation: ${u.salaryExpectation}` : '',
    u.linkedinUrl ? `LinkedIn: ${u.linkedinUrl}` : '',
    u.githubUrl ? `GitHub: ${u.githubUrl}` : '',
    u.resumeText ? `Resume:\n${u.resumeText.slice(0, 2000)}` : '',
  ].filter(Boolean).join('\n');

  const answer = await answerApplicationQuestion(question, ctx, typeof body.jobContext === 'string' ? body.jobContext : undefined);
  return NextResponse.json({ answer }, { headers: CORS });
}
