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

  // Multiple-choice mode: the extension sends the dropdown/radio options and we pick ONE verbatim.
  const options: string[] = Array.isArray(body.options)
    ? (body.options as unknown[]).map(String).map((s) => s.trim()).filter(Boolean).slice(0, 40)
    : [];

  const pp = (u.parsedProfile || {}) as Record<string, unknown>;
  const ctx = [
    u.name ? `Name: ${u.name}` : '',
    typeof pp.current_title === 'string' ? `Title: ${pp.current_title}` : '',
    typeof pp.current_company === 'string' ? `Current company: ${pp.current_company}` : '',
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

  const jobContext = typeof body.jobContext === 'string' ? body.jobContext : undefined;

  if (options.length > 0) {
    const raw = await answerApplicationQuestion(
      `${question}\n\nPick EXACTLY ONE of these options (reply with the option text verbatim, nothing else):\n${options.map((o) => `- ${o}`).join('\n')}`,
      ctx,
      jobContext,
    );
    // Canonicalize: only return an option that actually exists in the control.
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const hit = raw ? options.find((o) => norm(o) === norm(raw)) || options.find((o) => norm(raw).includes(norm(o)) || norm(o).includes(norm(raw))) : undefined;
    return NextResponse.json({ answer: hit || '' }, { headers: CORS });
  }

  const answer = await answerApplicationQuestion(question, ctx, jobContext);
  return NextResponse.json({ answer }, { headers: CORS });
}
