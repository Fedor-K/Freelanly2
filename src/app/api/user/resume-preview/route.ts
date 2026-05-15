import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { readFile } from 'fs/promises';
import path from 'path';

const VALID_TEMPLATES = ['sequence', 'wire', 'stack', 'spread', 'brief'];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const template = request.nextUrl.searchParams.get('template') || 'sequence';
    if (!VALID_TEMPLATES.includes(template)) {
      return new NextResponse('Invalid template', { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        resumeText: true,
        parsedProfile: true,
      },
    });

    if (!user) return new NextResponse('User not found', { status: 404 });

    const profile = user.parsedProfile as Record<string, unknown> | null;
    const skills = (profile?.skills as string[]) || [];
    const languages = (profile?.languages as string[]) || [];
    const experience = user.resumeText || '';

    // Parse name
    const fullName = user.name || 'Your Name';
    const firstName = fullName.split(' ')[0];
    const lastName = fullName.split(' ').slice(1).join(' ');

    // Build headline from skills
    const headline = skills.length > 0
      ? `${skills.slice(0, 3).join(', ')} specialist`
      : 'Software Developer';

    // Read template HTML
    const templatePath = path.join(process.cwd(), 'public', 'resumes', `${template}.html`);
    let html = await readFile(templatePath, 'utf-8');

    // Replace placeholder data with user data
    // Name replacements
    html = html.replace(/Alex Chen/g, fullName);
    html = html.replace(/Alex/g, firstName);
    html = html.replace(/Chen/g, lastName || firstName);

    // Contact
    html = html.replace(/alex@chen\.studio/g, user.email);
    html = html.replace(/chen\.studio/g, user.email.split('@')[1] || 'portfolio.dev');
    html = html.replace(/@alexchen/g, `@${firstName.toLowerCase()}`);

    // Location — use from profile or generic
    const location = (profile?.location as string) || '';
    if (location) {
      html = html.replace(/Berlin\s*·?\s*CET/g, location);
      html = html.replace(/Berlin/g, location.split(',')[0] || location);
    }

    // Title/headline
    html = html.replace(/Senior engineer — offline-first[\s\S]*?infrastructure/g, headline);
    html = html.replace(/Senior engineer/g, skills.length > 0 ? `${skills[0]} Developer` : 'Software Developer');
    html = html.replace(/senior engineer/g, skills.length > 0 ? `${skills[0].toLowerCase()} developer` : 'software developer');

    // Skills — replace existing skill lists with user's skills
    if (skills.length > 0) {
      // Replace specialties section content where applicable
      const skillChips = skills.slice(0, 8).map(s => `<span>${s}</span>`).join('');
      html = html.replace(
        /Distributed systems[\s\S]*?System design/g,
        skills.slice(0, 6).join('</span></div><div class="spec-row"><span>')
      );
    }

    // Languages
    if (languages.length > 0) {
      html = html.replace(/English[\s\S]*?German/g, languages.join(', '));
    }

    // Experience snippet — replace the detailed experience if we have resume text
    if (experience.length > 100) {
      const expLines = experience.split('\n').filter(l => l.trim().length > 20).slice(0, 5);
      // We don't replace the full experience section as it's complex HTML
      // but we can inject a note
    }

    // Update title
    html = html.replace(/<title>.*?<\/title>/, `<title>Resume — ${fullName} · ${template}</title>`);

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (error) {
    console.error('[ResumePreview] Error:', error);
    return new NextResponse('Failed to generate preview', { status: 500 });
  }
}
