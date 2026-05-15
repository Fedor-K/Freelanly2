import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

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
    const skills = (p.skills as string[]) || [];
    const languages = (p.languages as string[]) || [];
    const location = (p.location as string) || '';
    const experience = (p.experience as Array<{title: string; company: string; dates: string; description: string}>) || [];
    const education = (p.education as Array<{degree: string; institution: string; dates: string}>) || [];
    const projects = (p.projects as Array<{name: string; description: string}>) || [];
    const certifications = (p.certifications as string[]) || [];
    const summary = (p.summary as string) || '';
    const fullName = user.name || (p.name as string) || 'User';
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || firstName;

    // For PDF, send structured data to Hetzner
    if (isPdf) {
      const res = await fetch(`${HETZNER_RESUME_API}/generate-from-template?format=binary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': RESUME_API_KEY },
        body: JSON.stringify({ template, user: { name: fullName, email: user.email, skills, languages, resumeText: user.resumeText || '', location } }),
      });
      if (!res.ok) return new NextResponse(`PDF generation failed: ${await res.text()}`, { status: 500 });
      const pdfBuffer = await res.arrayBuffer();
      return new NextResponse(pdfBuffer, {
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="Resume_${firstName}_${template}.pdf"` },
      });
    }

    // HTML preview: fetch static template, replace with structured data
    const baseUrl = request.nextUrl.origin || 'https://freelanly.com';
    const templateRes = await fetch(`${baseUrl}/resumes/${template}.html`);
    if (!templateRes.ok) return NextResponse.redirect(new URL(`/resumes/${template}.html`, request.url));
    let html = await templateRes.text();

    // === NAME ===
    html = html.replace(/Alex Chen/g, fullName);
    html = html.replace(/Alex<br>Chen/g, `${firstName}<br>${lastName}`);
    html = html.replace(/alex\.chen/g, `${firstName.toLowerCase()}.${lastName.toLowerCase()}`);
    html = html.replace(/alex-chen\.pdf/g, `${firstName.toLowerCase()}-${lastName.toLowerCase()}.pdf`);
    html = html.replace(/alex@chen\.studio/g, user.email);
    html = html.replace(/chen\.studio/g, user.email.split('@')[1] || 'portfolio.dev');
    html = html.replace(/@alexchen/g, `@${firstName.toLowerCase()}`);
    html = html.replace(/Alex/g, firstName);

    // === LOCATION ===
    if (location) {
      html = html.replace(/Berlin · CET/g, location);
      html = html.replace(/Berlin/g, location.split(',')[0] || location);
    } else {
      html = html.replace(/Berlin · CET/g, '');
    }

    // === TITLE ===
    const headline = skills.length > 0 ? `${skills.slice(0, 3).join(', ')} specialist` : 'Software Developer';
    html = html.replace(/Senior engineer — offline-first[\s\S]*?infrastructure/g, headline);
    html = html.replace(/Senior engineer/g, skills.length > 0 ? `${skills[0]} Developer` : 'Software Developer');

    // === LANGUAGES ===
    if (languages.length > 0) {
      html = html.replace(/>English[\s\S]*?German</g, '>' + languages.join(', ') + '<');
    }

    // === INTRO ===
    if (summary) {
      html = html.replace(/Twelve years building[\s\S]*?not headcount\./, summary);
      html = html.replace(/Twelve years on the boring[\s\S]*?sync engines\./, summary);
    }

    // === EXPERIENCE ===
    if (experience.length > 0) {
      let expHtml = '';
      for (let i = 0; i < Math.min(experience.length, 5); i++) {
        const role = experience[i];
        expHtml += `<div class="role-entry${i === 0 ? ' current' : ''}">`;
        expHtml += `<div class="role-head"><div class="role-title">${role.title} <span class="co">— ${role.company}</span></div>`;
        if (role.dates) expHtml += `<div class="role-dates">${role.dates}</div>`;
        expHtml += `</div>`;
        if (role.description) {
          const bullets = role.description.split(/\.\s+/).filter(s => s.length > 10).slice(0, 3);
          if (bullets.length > 0) {
            expHtml += `<div class="role-body"><ul>${bullets.map(b => `<li>${b}.</li>`).join('')}</ul></div>`;
          }
        }
        expHtml += '</div>';
      }
      const expStart = html.indexOf('class="section-h"><span>Experience');
      const expNext = html.indexOf('class="section-h">', expStart + 50);
      if (expStart > 0 && expNext > expStart) {
        html = html.slice(0, expStart) + `class="section-h"><span>Experience</span><span class="count">${experience.length} roles</span></div>\n${expHtml}\n</div>\n\n    <div ` + html.slice(expNext);
      }
    }

    // === PROJECTS (replace "Selected open-source") ===
    const osStart = html.indexOf('Selected open-source');
    if (osStart > 0) {
      const osSectionStart = html.lastIndexOf('<div', osStart);
      const nextSection = html.indexOf('class="section-h">', osStart + 30);
      if (osSectionStart > 0 && nextSection > osSectionStart) {
        if (projects.length > 0) {
          let projHtml = 'class="section-h"><span>Projects</span></div>\n<div class="proj-grid">';
          for (const proj of projects.slice(0, 4)) {
            projHtml += `<div class="proj-card"><div class="nm">${proj.name}</div><div class="dsc">${proj.description.slice(0, 120)}</div></div>`;
          }
          projHtml += '</div>\n</div>\n\n    <div ';
          html = html.slice(0, osSectionStart) + '<div ' + projHtml + html.slice(nextSection);
        } else {
          html = html.slice(0, osSectionStart) + html.slice(html.lastIndexOf('<div', nextSection));
        }
      }
    }

    // === EDUCATION ===
    const eduIdx = html.indexOf('>Education<');
    if (eduIdx > 0 && education.length > 0) {
      const eduSectionStart = html.lastIndexOf('<div', eduIdx);
      const afterEdu = html.indexOf('</section>', eduIdx);
      if (eduSectionStart > 0 && afterEdu > eduSectionStart) {
        let eduHtml = `<div class="section-h"><span>Education</span></div>`;
        for (const edu of education) {
          eduHtml += `<div class="role-entry"><div class="role-head"><div class="role-title">${edu.degree} <span class="co">— ${edu.institution}</span></div><div class="role-dates">${edu.dates || ''}</div></div></div>`;
        }
        html = html.slice(0, eduSectionStart) + eduHtml + html.slice(afterEdu);
      }
    }

    // === HIDE EMPTY ===
    if (!location) html = html.replace(/Berlin\s*·?\s*CET/g, '');
    if (!(user.resumeText || '').includes('$')) html = html.replace(/<div class="contact-row">[\s\S]*?Rate[\s\S]*?<\/div>/g, '');
    if (!(user.resumeText || '').toLowerCase().includes('github.com')) html = html.replace(/<div class="contact-row">[\s\S]*?GitHub[\s\S]*?<\/div>/g, '');

    html = html.replace(/<title>.*?<\/title>/, `<title>Resume — ${fullName} · ${template}</title>`);

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, max-age=60' },
    });
  } catch (error) {
    console.error('[ResumePreview] Error:', error);
    return new NextResponse('Failed to generate preview', { status: 500 });
  }
}
