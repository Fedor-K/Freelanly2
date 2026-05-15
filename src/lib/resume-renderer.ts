/**
 * Replace all placeholder data in resume templates with user data.
 * Works across all 5 template styles by targeting content patterns.
 */

interface ResumeData {
  name: string;
  email: string;
  skills: string[];
  languages: string[];
  location: string;
  summary: string;
  currentTitle: string;
  experience: Array<{ title: string; company: string; dates: string; description: string }>;
  education: Array<{ degree: string; institution: string; dates: string }>;
  projects: Array<{ name: string; description: string }>;
  certifications: string[];
}

export function renderResumeTemplate(html: string, data: ResumeData): string {
  const { name, email, skills, languages, location, summary, currentTitle, experience, education, projects, certifications } = data;
  const firstName = name.split(' ')[0];
  const lastName = name.split(' ').slice(1).join(' ') || firstName;

  // ======= NAMES (all formats) =======
  html = html.replace(/Alex<br>Chen/g, `${firstName}<br>${lastName}`);
  html = html.replace(/Alex Chen/g, name);
  html = html.replace(/alex\.chen/g, `${firstName.toLowerCase()}.${lastName.toLowerCase()}`);
  html = html.replace(/alex-chen\.pdf/g, `${firstName.toLowerCase()}-${lastName.toLowerCase()}.pdf`);
  html = html.replace(/alex@chen\.studio/g, email);
  html = html.replace(/chen\.studio/g, email.split('@')[1] || 'portfolio.dev');
  html = html.replace(/@alexchen/g, `@${firstName.toLowerCase()}`);
  // Standalone "Alex" last (after compound replacements)
  html = html.replace(/>Alex</g, `>${firstName}<`);

  // ======= TITLE/ROLE =======
  const headline = currentTitle || (skills.length > 0 ? `${skills.slice(0, 3).join(', ')} specialist` : 'Software Developer');
  // Various formats across templates
  html = html.replace(/Senior engineer — offline-first[\s\S]*?infrastructure\./g, headline);
  html = html.replace(/senior engineer\./g, headline.toLowerCase() + '.');
  html = html.replace(/>senior engineer</g, `>${headline.toLowerCase()}<`);
  html = html.replace(/>Senior engineer</g, `>${headline}<`);

  // ======= LOCATION =======
  if (location) {
    html = html.replace(/Berlin · CET/g, location);
    html = html.replace(/Berlin, CET/g, location);
    html = html.replace(/>Berlin</g, `>${location.split(',')[0]}<`);
  } else {
    html = html.replace(/Berlin · CET/g, '');
    html = html.replace(/Berlin, CET/g, '');
  }

  // ======= EMAIL/CONTACT =======
  html = html.replace(/\$140\/hr · ~30h\/wk/g, '');
  html = html.replace(/\$140\/hr/g, '');

  // ======= LANGUAGES =======
  if (languages.length > 0) {
    html = html.replace(/EN\s+Native\s+·\s+中文\s+Fluent\s+·\s+DE\s+B2/gi, languages.join(' · '));
    html = html.replace(/>English[\s\S]*?German</g, '>' + languages.join(', ') + '<');
    html = html.replace(/EN NATIVE · 中文 FLUENT · DE B2/g, languages.map(l => l.toUpperCase()).join(' · '));
  }

  // ======= SUMMARY/INTRO =======
  if (summary) {
    // Match various intro patterns across templates
    html = html.replace(/Twelve years building[\s\S]*?not headcount\./g, summary);
    html = html.replace(/Twelve years on the boring[\s\S]*?sync engines\./g, summary);
    html = html.replace(/Currently independent[\s\S]*?US-East timezones\./g, summary);
  }

  // ======= EXPERIENCE =======
  if (experience.length > 0) {
    // Build experience HTML
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
        } else {
          expHtml += `<div class="role-body"><p>${role.description}</p></div>`;
        }
      }
      expHtml += '</div>';
    }

    // Replace experience section — find between Experience header and next section
    const expPatterns = ['class="section-h"><span>Experience', 'class="section-h"><span>EXPERIENCE'];
    for (const pattern of expPatterns) {
      const expStart = html.indexOf(pattern);
      if (expStart < 0) continue;
      const expNext = html.indexOf('class="section-h">', expStart + 50);
      if (expNext > expStart) {
        const countText = `${experience.length} role${experience.length > 1 ? 's' : ''}`;
        const header = pattern.includes('EXPERIENCE')
          ? `class="section-h"><span>EXPERIENCE</span><span class="count">${countText.toUpperCase()}</span></div>`
          : `class="section-h"><span>Experience</span><span class="count">${countText}</span></div>`;
        html = html.slice(0, expStart) + header + '\n' + expHtml + '\n</div>\n\n    <div ' + html.slice(expNext);
        break;
      }
    }
  }

  // ======= SKILLS SIDEBAR =======
  if (skills.length > 0) {
    const firstSkill = html.indexOf('<div class="skill-line">');
    if (firstSkill > 0) {
      let lastPos = firstSkill;
      let searchFrom = firstSkill;
      while (true) {
        const next = html.indexOf('<div class="skill-line">', searchFrom + 1);
        if (next < 0 || next > firstSkill + 3000) break;
        lastPos = next;
        searchFrom = next;
      }
      // Find end of last skill-line block
      let endPos = lastPos;
      for (let i = 0; i < 3; i++) endPos = html.indexOf('</div>', endPos + 1);
      endPos += 6;

      let newSkills = '';
      skills.slice(0, 6).forEach((s, i) => {
        const pct = Math.max(40, 95 - i * 10);
        newSkills += `        <div class="skill-line"><span>${s}</span><div class="bar"><div style="width:${pct}%"></div></div></div>\n`;
      });
      html = html.slice(0, firstSkill) + newSkills + html.slice(endPos);
    }
  }

  // ======= PROJECTS (replaces "Selected open-source & writing") =======
  const osPatterns = ['Selected open-source', 'SELECTED OPEN-SOURCE'];
  for (const osPattern of osPatterns) {
    const osIdx = html.indexOf(osPattern);
    if (osIdx < 0) continue;
    const osSectionStart = html.lastIndexOf('<div', osIdx);
    const nextSection = html.indexOf('class="section-h">', osIdx + 30);
    if (osSectionStart < 0 || nextSection < osSectionStart) continue;

    if (projects.length > 0) {
      const isUpper = osPattern === osPattern.toUpperCase();
      let projHtml = `<div ${isUpper ? 'class="section-h"><span>PROJECTS</span>' : 'class="section-h"><span>Projects</span>'}></div>\n<div class="proj-grid">`;
      for (const proj of projects.slice(0, 4)) {
        projHtml += `<div class="proj-card"><div class="nm">${proj.name}</div><div class="dsc">${proj.description.slice(0, 120)}</div></div>`;
      }
      projHtml += '</div>\n</div>\n\n    <div ';
      html = html.slice(0, osSectionStart) + projHtml + html.slice(nextSection);
    } else {
      // Remove section entirely
      html = html.slice(0, osSectionStart) + html.slice(html.lastIndexOf('<div', nextSection));
    }
    break;
  }

  // ======= EDUCATION =======
  if (education.length > 0) {
    // Find edu-row elements and replace them
    const firstEduRow = html.indexOf('<div class="edu-row">');
    if (firstEduRow > 0) {
      // Find the wrapping div (parent of edu-rows)
      const eduWrapStart = html.lastIndexOf('<div>', firstEduRow - 10);
      const eduSectionH = html.lastIndexOf('class="section-h">', firstEduRow);
      const eduBlockStart = html.lastIndexOf('<div', eduSectionH);
      // Find end of education block — it ends with </div>\n\n  </section> or similar
      let eduBlockEnd = firstEduRow;
      let searchFrom = firstEduRow;
      while (true) {
        const next = html.indexOf('<div class="edu-row">', searchFrom + 1);
        if (next < 0 || next > firstEduRow + 2000) break;
        searchFrom = next;
      }
      // End after last edu-row's closing divs
      eduBlockEnd = html.indexOf('</div>', html.indexOf('</div>', searchFrom) + 6) + 6;
      eduBlockEnd = html.indexOf('</div>', eduBlockEnd) + 6;

      let eduHtml = `<div>\n      <div class="section-h"><span>Education</span></div>`;
      for (const edu of education) {
        eduHtml += `\n      <div class="edu-row"><div>${edu.degree} <span class="place">— ${edu.institution}</span></div><div class="yr">${edu.dates || ''}</div></div>`;
      }
      eduHtml += '\n    </div>';
      html = html.slice(0, eduBlockStart) + eduHtml + html.slice(eduBlockEnd);
    }
  }

  // ======= HIDE EMPTY SECTIONS =======
  // Rate line
  html = html.replace(/<div class="contact-row">[\s\S]*?Rate[\s\S]*?<\/div>/g, '');
  // GitHub if not in data
  if (!email.includes('github')) {
    html = html.replace(/<div class="contact-row">[\s\S]*?GitHub[\s\S]*?<\/div>/g, '');
  }

  // ======= COMPACT OVERRIDES (fit everything on 1 page) =======
  const compactCss = `<style>
    .main { padding: 10mm 14mm 8mm !important; }
    .aside { padding: 12mm 10mm 8mm 12mm !important; }
    .intro { font-size: 10px !important; line-height: 1.4 !important; margin-bottom: 3mm !important; }
    .section-h { margin-top: 3mm !important; margin-bottom: 2mm !important; font-size: 9px !important; }
    .role-entry { padding: 2mm 0 !important; border-bottom-width: 0.5px !important; }
    .role-entry.current::before { display: none !important; }
    .role-title { font-size: 11px !important; }
    .role-dates { font-size: 8.5px !important; }
    .role-meta { font-size: 8.5px !important; }
    .role-body { font-size: 9.5px !important; line-height: 1.35 !important; }
    .role-body ul { margin: 1px 0 !important; padding-left: 10px !important; }
    .role-body li { margin-bottom: 0 !important; }
    .role-body p { margin-bottom: 2px !important; }
    .proj-grid { gap: 4px !important; }
    .proj-card { padding: 3px !important; }
    .proj-card .nm { font-size: 10px !important; }
    .proj-card .dsc { font-size: 8.5px !important; line-height: 1.3 !important; }
    .name { font-size: 24px !important; margin-bottom: 2px !important; line-height: 1 !important; }
    .role { font-size: 9px !important; margin-bottom: 5mm !important; }
    .avail { font-size: 8px !important; margin-bottom: 5mm !important; padding: 3px 7px !important; }
    .aside-block { margin-bottom: 4mm !important; }
    .aside-label { font-size: 8px !important; margin-bottom: 4px !important; }
    .skill-line { font-size: 9px !important; }
    .skill-line .bar { height: 2px !important; }
    .contact-row { font-size: 9px !important; line-height: 1.4 !important; }
    .brand { margin-bottom: 12mm !important; font-size: 8.5px !important; }
    .aside-foot { font-size: 7.5px !important; }
  </style>`;
  html = html.replace('</head>', compactCss + '\n</head>');

  // ======= TITLE TAG =======
  html = html.replace(/<title>.*?<\/title>/, `<title>Resume — ${name}</title>`);

  return html;
}
