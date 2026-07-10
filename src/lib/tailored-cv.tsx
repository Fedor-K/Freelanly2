// Tailored CV per application (PRO): rebuild the candidate's résumé FOR a specific role — summary
// angled to the job, most-relevant skills first, role descriptions re-emphasized around what the
// posting asks for. The ai-job-search recipe (relevance-weighted, never chronology-only), with a
// structural no-fabrication guarantee: the LLM may ONLY return a new summary, a skill ORDERING, and
// re-phrasings of each existing role description — companies, titles, dates and the entry list are
// copied from the original profile verbatim, so nothing can be invented into the factual skeleton.
import React from 'react';
import OpenAI from 'openai';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import type { CvProfile } from '@/lib/recruiter-cv';

const s = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

type TailorResult = {
  summary?: string;
  orderedSkills?: string[];
  roleDescriptions?: string[]; // by index of the original experience array
};

/** One LLM call: re-angle the profile for THIS job. Output is advisory — validated + merged below. */
async function tailorWithLlm(profile: CvProfile, jobTitle: string, jobDescription: string): Promise<TailorResult | null> {
  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) return null;
  const client = new OpenAI({ baseURL: 'https://api.z.ai/api/paas/v4', apiKey, timeout: 25000, maxRetries: 1 });

  const skills = arr(profile.skills).map(s).filter(Boolean);
  const roles = arr(profile.experience) as Array<{ title?: string; company?: string; dates?: string; description?: string }>;
  const rolesBlock = roles.map((r, i) => `#${i} ${s(r.title)} @ ${s(r.company)} (${s(r.dates)}): ${s(r.description)}`).join('\n');

  try {
    const resp = await client.chat.completions.create({
      model: 'glm-4-32b-0414-128k',
      temperature: 0.3,
      max_tokens: 900,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You tailor a résumé to a specific job posting. You may ONLY:
1. "summary": rewrite the professional summary (2-3 sentences) angled at this job — using ONLY facts present in the profile below. Never claim skills/tools/domains not in the profile.
2. "orderedSkills": reorder the EXACT skill list so the most relevant to this job come first. Same items, no additions, no removals, no renames.
3. "roleDescriptions": for each numbered role, re-phrase its EXISTING description to emphasize whatever in it is most relevant to this job. Same facts, same numbers, no inventions. If a description has nothing relevant, return it unchanged. Return one string per role, same order.
Output JSON: {"summary": "...", "orderedSkills": [...], "roleDescriptions": ["...", ...]}. Nothing else.`,
        },
        {
          role: 'user',
          content: `=== JOB ===\nTitle: ${jobTitle}\nDescription: ${jobDescription.slice(0, 2000)}\n\n=== PROFILE (the only permitted source of facts) ===\nSummary: ${s(profile.summary)}\nSkills: ${skills.join(', ')}\nRoles:\n${rolesBlock || '(none)'}\n\nTailor now.`,
        },
      ],
    });
    const raw = resp.choices[0]?.message?.content || '';
    return JSON.parse(raw) as TailorResult;
  } catch {
    return null;
  }
}

/** Merge LLM suggestions into the profile with hard validation — facts always win. */
function mergeTailored(profile: CvProfile, t: TailorResult | null): CvProfile {
  if (!t) return profile;
  const origSkills = arr(profile.skills).map(s).filter(Boolean);
  // orderedSkills must be a permutation-subset of the originals (case-insensitive) — else ignore.
  let skills: string[] = origSkills;
  if (Array.isArray(t.orderedSkills) && t.orderedSkills.length) {
    const origSet = new Map(origSkills.map(x => [x.toLowerCase(), x]));
    const reordered = t.orderedSkills.map(x => origSet.get(s(x).toLowerCase())).filter((x): x is string => !!x);
    const seen = new Set(reordered.map(x => x.toLowerCase()));
    if (reordered.length >= Math.min(3, origSkills.length)) {
      skills = [...reordered, ...origSkills.filter(x => !seen.has(x.toLowerCase()))];
    }
  }
  const roles = arr(profile.experience) as Array<{ title?: string; company?: string; dates?: string; description?: string }>;
  const experience = roles.map((r, i) => ({
    ...r, // title/company/dates ALWAYS original
    description:
      Array.isArray(t.roleDescriptions) && typeof t.roleDescriptions[i] === 'string' && t.roleDescriptions[i].trim().length > 20
        ? t.roleDescriptions[i].trim()
        : r.description,
  }));
  return {
    ...profile,
    summary: typeof t.summary === 'string' && t.summary.trim().length > 30 ? t.summary.trim() : profile.summary,
    skills,
    experience,
  };
}

const styles = StyleSheet.create({
  page: { padding: 42, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a', lineHeight: 1.45 },
  name: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  headline: { fontSize: 11, color: '#444', marginBottom: 2 },
  contact: { fontSize: 9, color: '#666', marginBottom: 14 },
  section: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8, color: '#333', borderBottomWidth: 0.5, borderBottomColor: '#ccc', paddingBottom: 3 },
  roleTitle: { fontFamily: 'Helvetica-Bold', fontSize: 10.5 },
  roleMeta: { fontSize: 9, color: '#666', marginBottom: 3 },
  para: { marginBottom: 8 },
  skills: { fontSize: 10 },
});

function CvDoc({ p, name, links }: { p: CvProfile; name: string; links?: string[] }) {
  const roles = (arr(p.experience) as Array<{ title?: string; company?: string; dates?: string; description?: string }>)
    .filter(r => r.title || r.company || r.description);
  const edu = (arr(p.education) as Array<{ degree?: string; title?: string; institution?: string; school?: string; dates?: string; year?: string }>)
    .filter(e => e.degree || e.title || e.institution || e.school);
  const skills = arr(p.skills).map(s).filter(Boolean);
  const langs = arr(p.languages).map(s).filter(Boolean);
  const certs = arr(p.certifications).map(s).filter(Boolean);
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.name}>{name}</Text>
        {(p.current_title || p.field) ? <Text style={styles.headline}>{s(p.current_title) || s(p.field)}</Text> : null}
        <Text style={styles.contact}>
          {[s(p.email), s(p.location), p.experience_years ? `${p.experience_years}+ years experience` : ''].filter(Boolean).join('  ·  ')}
        </Text>
        {links && links.length ? <Text style={{ ...styles.contact, marginTop: -8 }}>{links.join('  ·  ')}</Text> : null}
        {p.summary ? (<><Text style={styles.section}>Summary</Text><Text style={styles.para}>{s(p.summary)}</Text></>) : null}
        {skills.length ? (<><Text style={styles.section}>Skills</Text><Text style={{ ...styles.skills, ...styles.para }}>{skills.join('  ·  ')}</Text></>) : null}
        {roles.length ? (
          <>
            <Text style={styles.section}>Experience</Text>
            {roles.map((r, i) => (
              <View key={i} style={styles.para} wrap={false}>
                <Text style={styles.roleTitle}>{[s(r.title), s(r.company)].filter(Boolean).join(' — ')}</Text>
                {r.dates ? <Text style={styles.roleMeta}>{s(r.dates)}</Text> : null}
                {r.description ? <Text>{s(r.description)}</Text> : null}
              </View>
            ))}
          </>
        ) : null}
        {edu.length ? (
          <>
            <Text style={styles.section}>Education</Text>
            {edu.map((e, i) => (
              <View key={i} style={{ marginBottom: 5 }}>
                <Text style={styles.roleTitle}>{[s(e.degree) || s(e.title), s(e.institution) || s(e.school)].filter(Boolean).join(' — ')}</Text>
                {(e.dates || e.year) ? <Text style={styles.roleMeta}>{s(e.dates) || s(e.year)}</Text> : null}
              </View>
            ))}
          </>
        ) : null}
        {certs.length ? (<><Text style={styles.section}>Certifications</Text><Text style={styles.para}>{certs.join('  ·  ')}</Text></>) : null}
        {langs.length ? (<><Text style={styles.section}>Languages</Text><Text style={styles.para}>{langs.join('  ·  ')}</Text></>) : null}
      </Page>
    </Document>
  );
}

/**
 * Render a STOCK CV PDF straight from the parsed profile (no LLM) — used by the "build my CV from
 * my links" signup path, where the profile comes from the LinkedIn/GitHub scrape and the user has
 * no r\u00e9sum\u00e9 file on their device. Facts render verbatim from the profile.
 */
export async function renderCvPdf(params: {
  profile: CvProfile;
  userName: string;
  links?: string[];
}): Promise<{ base64: string; buffer: Buffer; filename: string } | null> {
  try {
    const { profile, userName, links } = params;
    if (!profile || !(arr(profile.skills).length || arr(profile.experience).length || profile.summary)) return null;
    const name = userName || s(profile.name) || 'Candidate';
    const buf = await renderToBuffer(<CvDoc p={profile} name={name} links={links} />);
    const safe = (x: string) => x.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
    return { base64: Buffer.from(buf).toString('base64'), buffer: Buffer.from(buf), filename: `${safe(name) || 'CV'}_CV.pdf` };
  } catch (e) {
    console.error('[StockCV] render failed:', e);
    return null;
  }
}

/**
 * Generate a per-application tailored CV PDF. Returns { base64, filename } like fetchResumeAttachment,
 * or null on ANY failure — callers must fall back to the stock résumé (never block a send on this).
 */
export async function generateTailoredCv(params: {
  profile: CvProfile | null | undefined;
  userName: string;
  jobTitle: string;
  jobDescription: string;
  companyName?: string;
}): Promise<{ base64: string; filename: string } | null> {
  const { profile, userName, jobTitle, jobDescription, companyName } = params;
  try {
    if (!profile || !(arr(profile.skills).length || arr(profile.experience).length)) return null;
    const t = await tailorWithLlm(profile, jobTitle, jobDescription);
    if (!t) return null; // LLM unavailable → stock CV is fine, don't render an untailored duplicate
    const merged = mergeTailored(profile, t);
    const name = userName || s(profile.name) || 'Candidate';
    const buf = await renderToBuffer(<CvDoc p={merged} name={name} />);
    const safe = (x: string) => x.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
    const filename = `${safe(name) || 'CV'}${companyName ? `_${safe(companyName)}` : ''}.pdf`;
    return { base64: Buffer.from(buf).toString('base64'), filename };
  } catch (e) {
    console.error('[TailoredCV] generation failed, falling back to stock CV:', e);
    return null;
  }
}
