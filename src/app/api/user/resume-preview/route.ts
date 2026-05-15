import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const VALID_TEMPLATES = ['sequence', 'wire', 'stack', 'spread', 'brief'];
const HETZNER_RESUME_API = 'https://postal.freelanly.com/api/resume';
const RESUME_API_KEY = 'rk_freelanly_resume_2026';

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

    const isPdf = request.nextUrl.searchParams.get('pdf') === '1';

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
    const location = (profile?.location as string) || '';

    if (isPdf) {
      // Generate PDF via Hetzner Puppeteer
      const res = await fetch(`${HETZNER_RESUME_API}/generate-from-template?format=binary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': RESUME_API_KEY },
        body: JSON.stringify({
          template,
          user: {
            name: user.name || 'User',
            email: user.email,
            skills,
            languages,
            resumeText: user.resumeText || '',
            location,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return new NextResponse(`PDF generation failed: ${err}`, { status: 500 });
      }

      const pdfBuffer = await res.arrayBuffer();
      const firstName = (user.name || 'User').split(' ')[0];
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="Resume_${firstName}_${template}.pdf"`,
        },
      });
    }

    // HTML preview: fetch static template from own domain and do text replacement
    const baseUrl = request.nextUrl.origin || 'https://freelanly.com';
    const templateRes = await fetch(`${baseUrl}/resumes/${template}.html`);
    if (!templateRes.ok) {
      return NextResponse.redirect(new URL(`/resumes/${template}.html`, request.url));
    }
    let html = await templateRes.text();

    // Do the replacements
    const fullName = user.name || 'User';
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || firstName;

    html = html.replace(/Alex Chen/g, fullName);
    html = html.replace(/Alex<br>Chen/g, `${firstName}<br>${lastName}`);
    html = html.replace(/alex\.chen/g, `${firstName.toLowerCase()}.${lastName.toLowerCase()}`);
    html = html.replace(/alex-chen\.pdf/g, `${firstName.toLowerCase()}-${lastName.toLowerCase()}.pdf`);
    html = html.replace(/alex@chen\.studio/g, user.email);
    html = html.replace(/chen\.studio/g, user.email.split('@')[1] || 'portfolio.dev');
    html = html.replace(/@alexchen/g, `@${firstName.toLowerCase()}`);
    html = html.replace(/Alex/g, firstName);

    if (location) {
      html = html.replace(/Berlin · CET/g, location);
      html = html.replace(/Berlin/g, location.split(',')[0] || location);
    } else {
      html = html.replace(/Berlin · CET/g, '');
    }

    const headline = skills.length > 0 ? `${skills.slice(0, 3).join(', ')} specialist` : 'Software Developer';
    html = html.replace(/Senior engineer — offline-first[\s\S]*?infrastructure/g, headline);
    html = html.replace(/Senior engineer/g, skills.length > 0 ? `${skills[0]} Developer` : 'Software Developer');
    if (languages.length > 0) {
      html = html.replace(/>English[\s\S]*?German</g, '>' + languages.join(', ') + '<');
    }

    // Parse resume into sections
    const experience = user.resumeText || '';
    const resumeSections = experience.split(/(?=EXPERIENCE|EDUCATION|PROJECTS|SKILLS|CERTIFICATIONS|LANGUAGES)/);
    const introText = resumeSections[0]?.trim().slice(0, 300) || '';

    if (introText.length > 20) {
      html = html.replace(/Twelve years building[\s\S]*?not headcount\./, introText);
      html = html.replace(/Twelve years on the boring[\s\S]*?sync engines\./, introText.slice(0, 200));
    }

    // Replace experience
    const expSection = resumeSections.find(s => s.startsWith('EXPERIENCE')) || '';
    const expContent = expSection.replace(/^EXPERIENCE\s*/, '');
    if (expContent.length > 50) {
      // Split by company/date patterns
      const roleBlocks = expContent.split(/(?=(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z])|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/);
      const lines = roleBlocks.filter(b => b.trim().length > 10);
      let expHtml = '';
      let roleCount = 0;
      for (const block of lines) {
        if (roleCount >= 5) break;
        const trimmed = block.trim();
        if (trimmed.length < 10) continue;
        // First sentence = role title, rest = body
        const dotIdx = trimmed.indexOf('. ');
        const title = dotIdx > 0 && dotIdx < 80 ? trimmed.slice(0, dotIdx) : trimmed.slice(0, 80);
        const body = dotIdx > 0 ? trimmed.slice(dotIdx + 2) : '';
        expHtml += `<div class="role-entry${roleCount === 0 ? ' current' : ''}">`;
        expHtml += `<div class="role-head"><div class="role-title">${title}</div></div>`;
        if (body.length > 10) {
          const bullets = body.split(/\.\s+/).filter(s => s.length > 10).slice(0, 3);
          expHtml += `<div class="role-body"><ul>${bullets.map(b => `<li>${b}.</li>`).join('')}</ul></div>`;
        }
        expHtml += '</div>';
        roleCount++;
      }
      if (roleCount > 0) {
        const expStart = html.indexOf('class="section-h"><span>Experience');
        const expNext = html.indexOf('class="section-h">', expStart + 50);
        if (expStart > 0 && expNext > expStart) {
          html = html.slice(0, expStart) + `class="section-h"><span>Experience</span><span class="count">${roleCount} roles</span></div>\n${expHtml}\n</div>\n\n    <div ` + html.slice(expNext);
        }
      }
    }

    // Hide sections that user doesn't have data for (don't show Alex Chen's fake data)
    // Remove "Selected open-source & writing" section if user doesn't have projects
    const hasProjects = experience.toLowerCase().includes('project') || experience.toLowerCase().includes('open-source');
    if (!hasProjects) {
      const osStart = html.indexOf('Selected open-source');
      if (osStart > 0) {
        const osSectionStart = html.lastIndexOf('<div', osStart);
        const nextSection = html.indexOf('class="section-h">', osStart + 30);
        if (osSectionStart > 0 && nextSection > osSectionStart) {
          const osSectionEnd = html.lastIndexOf('</div>', nextSection);
          html = html.slice(0, osSectionStart) + html.slice(nextSection > 0 ? html.lastIndexOf('<div', nextSection) : osSectionEnd);
        }
      }
    }

    // Remove Rate/GitHub lines if user doesn't have them
    if (!experience.includes('$') && !experience.includes('/hr')) {
      html = html.replace(/<div class="contact-row">[\s\S]*?Rate[\s\S]*?<\/div>/g, '');
    }
    if (!experience.toLowerCase().includes('github.com')) {
      html = html.replace(/<div class="contact-row">[\s\S]*?GitHub[\s\S]*?<\/div>/g, '');
    }

    // Remove location placeholder if user has no location
    if (!location) {
      html = html.replace(/Berlin\s*·?\s*CET/g, '');
    }

    html = html.replace(/<title>.*?<\/title>/, `<title>Resume — ${fullName} · ${template}</title>`);

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, max-age=60' },
    });
  } catch (error) {
    console.error('[ResumePreview] Error:', error);
    return new NextResponse('Failed to generate preview', { status: 500 });
  }
}
