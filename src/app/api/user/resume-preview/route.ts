import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { renderResumeTemplate } from '@/lib/resume-renderer';

const VALID_TEMPLATES = ['sequence', 'wire', 'stack', 'spread', 'brief'];
const HETZNER_RESUME_API = 'https://postal.freelanly.com/api/resume';
const RESUME_API_KEY = 'rk_freelanly_resume_2026';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

    const template = request.nextUrl.searchParams.get('template') || 'sequence';
    if (!VALID_TEMPLATES.includes(template)) return new NextResponse('Invalid template', { status: 400 });
    const isPdf = request.nextUrl.searchParams.get('pdf') === '1';

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, resumeText: true, parsedProfile: true },
    });
    if (!user) return new NextResponse('User not found', { status: 404 });

    const p = (user.parsedProfile || {}) as Record<string, unknown>;
    const resumeData = {
      name: user.name || (p.name as string) || 'User',
      email: user.email,
      skills: (p.skills as string[]) || [],
      languages: (p.languages as string[]) || [],
      location: (p.location as string) || '',
      summary: (p.summary as string) || '',
      currentTitle: (p.current_title as string) || '',
      experience: (p.experience as Array<{ title: string; company: string; dates: string; description: string }>) || [],
      education: (p.education as Array<{ degree: string; institution: string; dates: string }>) || [],
      projects: (p.projects as Array<{ name: string; description: string }>) || [],
      certifications: (p.certifications as string[]) || [],
    };

    // Fetch template and render with user data
    const baseUrl = request.nextUrl.origin || 'https://freelanly.com';
    const templateRes = await fetch(`${baseUrl}/resumes/${template}.html`);
    if (!templateRes.ok) return NextResponse.redirect(new URL(`/resumes/${template}.html`, request.url));
    let html = await templateRes.text();
    html = renderResumeTemplate(html, resumeData);

    // PDF: send rendered HTML to Hetzner Puppeteer
    if (isPdf) {
      const res = await fetch(`${HETZNER_RESUME_API}/html-to-pdf?format=binary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': RESUME_API_KEY },
        body: JSON.stringify({ html }),
      });
      if (!res.ok) return new NextResponse(`PDF generation failed: ${await res.text()}`, { status: 500 });
      const pdfBuffer = await res.arrayBuffer();
      const firstName = resumeData.name.split(' ')[0];
      return new NextResponse(pdfBuffer, {
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="Resume_${firstName}_${template}.pdf"` },
      });
    }

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, max-age=60' },
    });
  } catch (error) {
    console.error('[ResumePreview] Error:', error);
    return new NextResponse('Failed to generate preview', { status: 500 });
  }
}
