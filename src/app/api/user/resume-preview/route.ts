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

    // Replace the intro paragraph
    const introText = experience.length > 50
      ? experience.split('\n').filter(l => l.trim().length > 20).slice(0, 2).join(' ').slice(0, 300)
      : `${headline}. ${skills.slice(0, 5).join(', ')}.`;
    html = html.replace(
      /Twelve years building[\s\S]*?not headcount\./,
      introText
    );

    // Replace experience section with user's resume content
    if (experience.length > 100) {
      const lines = experience.split('\n').filter(l => l.trim().length > 5);
      let expHtml = '';
      let roleCount = 0;

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length < 100 && trimmed.length > 5 && !trimmed.startsWith('-') && !trimmed.startsWith('•') && !trimmed.startsWith('·') && !trimmed.startsWith('–')) {
          if (roleCount > 0) expHtml += '</ul></div></div>';
          expHtml += `<div class="role-entry${roleCount === 0 ? ' current' : ''}">
            <div class="role-head"><div class="role-title">${trimmed}</div></div>
            <div class="role-body"><ul>`;
          roleCount++;
        } else if ((trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('·') || trimmed.startsWith('–')) && roleCount > 0) {
          expHtml += `<li>${trimmed.replace(/^[-•·–]\s*/, '')}</li>`;
        } else if (trimmed.length > 20 && roleCount > 0) {
          expHtml += `<li>${trimmed}</li>`;
        }
        if (roleCount >= 6) break;
      }
      if (roleCount > 0) expHtml += '</ul></div></div>';

      if (roleCount > 0) {
        // Find and replace between Experience header and next section header
        const expStart = html.indexOf('class="section-h"><span>Experience');
        const expNextSection = html.indexOf('class="section-h">', expStart + 50);
        if (expStart > 0 && expNextSection > expStart) {
          // Find the closing </div> before next section
          const beforeNext = html.lastIndexOf('</div>', expNextSection);
          if (beforeNext > expStart) {
            const newSection = `class="section-h"><span>Experience</span><span class="count">${roleCount} roles</span></div>\n${expHtml}\n</div>\n\n    <div `;
            html = html.slice(0, expStart) + newSection + html.slice(expNextSection);
          }
        }
      }
    }

    // Update title
    html = html.replace(/<title>.*?<\/title>/, `<title>Resume — ${fullName} · ${template}</title>`);

    // Auto-print if requested
    const autoPrint = request.nextUrl.searchParams.get('print') === '1';
    if (autoPrint) {
      html = html.replace('</body>', '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),600))</script></body>');
    }

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
