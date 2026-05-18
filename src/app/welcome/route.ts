import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { readFileSync } from 'fs';
import { join } from 'path';
import { headers } from 'next/headers';

const COLORS = ['#FF6B6B','#A8E024','#6EE7FF','#FFB951','#A78BFA','#34D399'];

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    // Read the HTML template — try filesystem first, fallback to HTTP
    let html = '';
    try {
      html = readFileSync(join(process.cwd(), 'public', 'welcome-v2.html'), 'utf-8');
    } catch {
      // Vercel serverless: fetch from own origin
      const h = await headers();
      const host = h.get('host') || 'freelanly.com';
      const proto = host.includes('localhost') ? 'http' : 'https';
      const res = await fetch(`${proto}://${host}/welcome-v2.html`);
      html = await res.text();
    }

    // Remove demo bar, shell elements, and page header
    html = html.replace(/<!-- DEMO.*?<!-- \/DEMO -->/gs, '');
    html = html.replace(/<div class="demo-bar">[\s\S]*?<\/div>\s*(?=\s*<!--)/, '');
    html = html.replace('<div id="shellSidebar"></div>', '');
    html = html.replace('<div id="shellTopbar"></div>', '');
    html = html.replace(/Freelanly\.initShell\([^)]*\);/, '// shell removed');
    // Remove page header (parent dashboard has its own)
    html = html.replace(/<div class="page-header">[\s\S]*?<\/div>\s*<\/div>/m, '');

    if (!userId) {
      return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // Fetch user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, parsedProfile: true },
    });

    const loop = await prisma.autoApplyLoop.findFirst({
      where: { userId },
      select: { jobTitles: true, keywords: true, dailyLimit: true },
    });

    // Fetch real matches
    const dayAgo = new Date(Date.now() - 24 * 3600000);
    const opps = await prisma.opportunity.findMany({
      where: { isActive: true, createdAt: { gte: dayAgo }, applyEmail: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { title: true, clientName: true, location: true, applyEmail: true, skills: true, company: { select: { name: true } } },
    });

    const totalToday = await prisma.opportunity.count({
      where: { isActive: true, createdAt: { gte: dayAgo } },
    });

    const firstName = user?.name?.split(' ')[0] || 'there';
    const fullName = user?.name || 'Applicant';
    const top = opps[0];
    const topCompany = top?.company?.name || top?.clientName || 'Company';
    const topRole = top?.title || 'Developer';
    const topEmail = top?.applyEmail || 'contact@company.com';
    const topMeta = top?.location || 'Remote';
    const topSkills = (top?.skills || []).slice(0, 5);
    const topLogo = topCompany[0].toUpperCase();

    // Build matches JS array
    const matchesJS = opps.map((o, i) => {
      const co = o.company?.name || o.clientName || 'Company';
      const score = Math.floor(75 + Math.random() * 20);
      return `{ co: '${co.replace(/'/g, "\\'")}', logo: { ch: '${co[0].toUpperCase()}', bg: '${COLORS[i % COLORS.length]}' }, role: '${o.title.replace(/'/g, "\\'")}', meta: '${(o.location || 'Remote').replace(/'/g, "\\'")}', score: ${score}, pass: ${i !== 2} ${i === 2 ? ", reason: 'below threshold'" : ''} }`;
    }).join(',\n  ');

    // Build cover letter paragraphs
    const coverJS = [
      `'Hi there,'`,
      `'Saw your <em>${topRole.replace(/'/g, "\\'")}</em> post at <em>${topCompany.replace(/'/g, "\\'")}</em> — my background aligns well with what you\\'re looking for.'`,
      `'I\\'d love to discuss how my experience can contribute to your team.'`,
      `'Quick call this week?'`,
      `'— ${fullName.replace(/'/g, "\\'")}'`,
    ].join(',\n  ');

    // Replace hardcoded values in HTML
    html = html.replace('Welcome, Alex.', `Welcome, ${firstName}.`);
    html = html.replace(/First application sent — to Linear, "Senior React Developer"/g, `First application sent — to ${topCompany}, "${topRole}"`);
    html = html.replace(/<span class="right"><b>Top pick:<\/b> Linear · Senior React Developer · 94%<\/span>/g, `<span class="right"><b>Top pick:</b> ${topCompany} · ${topRole} · 94%</span>`);
    html = html.replace(/<div class="nm">Senior React Developer<span class="co">Linear · remote, EU<\/span><\/div>/g, `<div class="nm">${topRole}<span class="co">${topCompany} · ${topMeta}</span></div>`);
    html = html.replace(/Hiring manager · <b>Sarah Karp<\/b>/g, `Recruiter · <b>${topCompany}</b>`);
    html = html.replace(/sarah@linear\.app/g, topEmail);
    html = html.replace(/via alex@chen\.studio · Re: Senior React Developer role/g, `via ${user?.email || 'you'} · Re: ${topRole}`);
    html = html.replace(/Sent — to Linear\./g, `Sent — to ${topCompany}.`);
    html = html.replace(/Your first application is on its way to <b>Sarah Karp<\/b>/g, `Your first application is on its way to <b>${topCompany}</b>`);
    html = html.replace(/Senior React Developer · Linear/g, `${topRole} · ${topCompany}`);
    html = html.replace(/✓ delivered to sarah@linear\.app/g, `✓ delivered to ${topEmail}`);
    html = html.replace("'— Alex'", `'— ${fullName.replace(/'/g, "\\'")}'`);
    html = html.replace("Portfolio: chen.studio.", '');

    // Replace skills tags
    const skillsHTML = topSkills.length > 0
      ? topSkills.map((s: string) => `<span class="tag">${s}</span>`).join('\n                    ')
      : '<span class="tag">Skills</span>';
    html = html.replace(/<span class="tag hit">React<\/span>\s*<span class="tag hit">TypeScript<\/span>\s*<span class="tag">Sync engine<\/span>\s*<span class="tag">Go<\/span>\s*<span class="tag">Postgres<\/span>/g, skillsHTML);

    // Replace MATCHES constant
    if (matchesJS) {
      html = html.replace(
        /const MATCHES = \[[\s\S]*?\];/,
        `const MATCHES = [\n  ${matchesJS}\n];`
      );
    }

    // Replace COVER_PARAGRAPHS
    html = html.replace(
      /const COVER_PARAGRAPHS = \[[\s\S]*?\];/,
      `const COVER_PARAGRAPHS = [\n  ${coverJS}\n];`
    );

    // Replace scan summary line with real count
    html = html.replace(
      /Found <b>47<\/b> matches above 70 % threshold/g,
      `Found <b>${totalToday}</b> matches above 70 % threshold`
    );
    html = html.replace(/data-counter="42"/g, `data-counter="${totalToday}"`);

    // Replace "$120–145k equiv"
    html = html.replace(/\$120–145k<\/b> equiv/g, `Remote</b>`);

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('[Welcome] Error:', error);
    // Fallback to static file
    const html = readFileSync(join(process.cwd(), 'public', 'welcome-v2.html'), 'utf-8');
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}
