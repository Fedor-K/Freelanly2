import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import type { CvProfile } from './recruiter-cv';

// Generates a clean one-page PDF résumé from a user's parsed profile, for candidates whose
// original PDF was never stored as a Blob (legacy uploads, pasted LinkedIn URLs). Attaching
// SOMETHING is worth +34-48% reply-rate vs nothing (measured), and CV is the #1 thing
// recruiters re-ask for. Pure JS (no headless browser) so it runs anywhere @react-pdf does.
// Built from the SAME CvProfile shape the recruiter portal renders to HTML — single source.

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (v == null ? '' : String(v)).trim();

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a', lineHeight: 1.4 },
  name: { fontSize: 20, fontFamily: 'Helvetica-Bold', lineHeight: 1.2, marginBottom: 5 },
  title: { fontSize: 11, color: '#444', marginBottom: 4 },
  contact: { fontSize: 9, color: '#666', marginBottom: 14 },
  section: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 6, color: '#000', borderBottom: '1 solid #ddd', paddingBottom: 2 },
  summary: { fontSize: 10, color: '#333', marginBottom: 2 },
  skillsRow: { fontSize: 10, color: '#333' },
  exp: { marginBottom: 8 },
  expHead: { flexDirection: 'row', justifyContent: 'space-between' },
  expTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  expCo: { fontSize: 10, color: '#555' },
  expDates: { fontSize: 9, color: '#888' },
  expDesc: { fontSize: 9.5, color: '#444', marginTop: 2 },
  eduLine: { fontSize: 10, color: '#333', marginBottom: 3 },
});

const h = React.createElement;

/** Render a CvProfile to a PDF Buffer. Returns null if there's nothing worth rendering. */
export async function generateCvPdf(profile: CvProfile, fallbackName?: string): Promise<Buffer | null> {
  const p = profile || {};
  const name = str(p.name) || str(fallbackName) || 'Candidate';
  const skills = arr(p.skills).map(str).filter(Boolean);
  const languages = arr(p.languages).map(str).filter(Boolean);
  const experience = arr(p.experience) as Array<Record<string, unknown>>;
  const education = arr(p.education) as Array<Record<string, unknown>>;
  const summary = str(p.summary);

  if (!skills.length && !experience.length && !summary) return null;

  const contactBits = [str(p.email), str(p.location), p.experience_years ? `${p.experience_years} yrs exp` : '']
    .filter(Boolean)
    .join('  ·  ');

  const children: React.ReactNode[] = [
    h(Text, { style: styles.name, key: 'n' }, name),
    str(p.current_title) ? h(Text, { style: styles.title, key: 't' }, str(p.current_title)) : null,
    contactBits ? h(Text, { style: styles.contact, key: 'c' }, contactBits) : null,
  ];

  if (summary) {
    children.push(h(Text, { style: styles.section, key: 's-h' }, 'Summary'));
    children.push(h(Text, { style: styles.summary, key: 's-b' }, summary));
  }

  if (skills.length) {
    children.push(h(Text, { style: styles.section, key: 'sk-h' }, 'Skills'));
    children.push(h(Text, { style: styles.skillsRow, key: 'sk-b' }, skills.join('  •  ')));
  }

  if (experience.length) {
    children.push(h(Text, { style: styles.section, key: 'e-h' }, 'Experience'));
    experience.forEach((raw, i) => {
      const title = str(raw.title);
      const company = str(raw.company);
      const dates = str(raw.dates);
      const desc = str(raw.description);
      if (!title && !company && !desc) return;
      children.push(
        h(View, { style: styles.exp, key: `e-${i}` }, [
          h(View, { style: styles.expHead, key: 'hd' }, [
            h(Text, { key: 'l' }, [
              h(Text, { style: styles.expTitle, key: 'tt' }, title || ''),
              company ? h(Text, { style: styles.expCo, key: 'co' }, `  ·  ${company}`) : null,
            ]),
            dates ? h(Text, { style: styles.expDates, key: 'd' }, dates) : null,
          ]),
          desc ? h(Text, { style: styles.expDesc, key: 'ds' }, desc) : null,
        ]),
      );
    });
  }

  if (education.length) {
    children.push(h(Text, { style: styles.section, key: 'ed-h' }, 'Education'));
    education.forEach((raw, i) => {
      const line = [str(raw.degree) || str(raw.title), str(raw.school) || str(raw.institution), str(raw.dates) || str(raw.year)]
        .filter(Boolean)
        .join('  ·  ');
      if (line) children.push(h(Text, { style: styles.eduLine, key: `ed-${i}` }, line));
    });
  }

  if (languages.length) {
    children.push(h(Text, { style: styles.section, key: 'lg-h' }, 'Languages'));
    children.push(h(Text, { style: styles.skillsRow, key: 'lg-b' }, languages.join('  •  ')));
  }

  const doc = h(Document, {}, h(Page, { size: 'A4', style: styles.page }, children.filter(Boolean)));
  return renderToBuffer(doc as Parameters<typeof renderToBuffer>[0]);
}
