import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import OpenAI from 'openai';

// AI Provider — same pattern as cover-letter-generator
function getAIClient(): { client: OpenAI; model: string } {
  const provider = process.env.AI_PROVIDER?.toLowerCase();
  if (provider === 'zai') {
    return {
      client: new OpenAI({
        apiKey: process.env.ZAI_API_KEY || '',
        baseURL: 'https://api.z.ai/api/paas/v4',
        timeout: 30000,
        maxRetries: 1,
      }),
      model: 'glm-4-32b-0414-128k',
    };
  }
  return {
    client: new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      baseURL: 'https://api.deepseek.com/v1',
      timeout: 30000,
      maxRetries: 2,
    }),
    model: 'deepseek-chat',
  };
}

// ==================== Types ====================

export interface ResumeProfile {
  name: string;
  email: string;
  phone?: string | null;
  location?: string | null;
  linkedin?: string | null;
  github?: string | null;
  summary: string;
  skills: string[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  certifications?: string[];
  languages?: string[];
}

interface ExperienceEntry {
  title: string;
  company: string;
  period: string;
  description: string;
}

interface EducationEntry {
  degree: string;
  institution: string;
  period: string;
}

interface TailoredResume {
  summary: string;
  skills: string[]; // reordered, top relevant first
  experienceHighlights: string[]; // tailored bullet points per experience
}

// ==================== Styles ====================

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#333',
    lineHeight: 1.4,
  },
  name: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#111',
    marginBottom: 4,
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    fontSize: 9,
    color: '#555',
    marginBottom: 16,
  },
  contactItem: {
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingBottom: 3,
    marginBottom: 8,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryText: {
    fontSize: 10,
    color: '#444',
    lineHeight: 1.5,
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  skillTag: {
    fontSize: 9,
    backgroundColor: '#f3f4f6',
    padding: '3 8',
    borderRadius: 3,
    color: '#374151',
  },
  expEntry: {
    marginBottom: 10,
  },
  expHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  expTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#111',
  },
  expPeriod: {
    fontSize: 9,
    color: '#888',
  },
  expCompany: {
    fontSize: 9,
    color: '#666',
    marginBottom: 3,
  },
  expDesc: {
    fontSize: 9,
    color: '#444',
    lineHeight: 1.5,
  },
  eduEntry: {
    marginBottom: 6,
  },
  eduDegree: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#111',
  },
  eduInstitution: {
    fontSize: 9,
    color: '#666',
  },
  langRow: {
    fontSize: 9,
    color: '#444',
  },
});

// ==================== PDF Component ====================

function ResumePDF({
  profile,
  tailored,
}: {
  profile: ResumeProfile;
  tailored?: TailoredResume | null;
}) {
  const summary = tailored?.summary || profile.summary;
  const skills = tailored?.skills || profile.skills;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Name */}
        <Text style={styles.name}>{profile.name}</Text>

        {/* Contact */}
        <View style={styles.contactRow}>
          {profile.email && <Text style={styles.contactItem}>{profile.email}</Text>}
          {profile.phone && <Text style={styles.contactItem}>{profile.phone}</Text>}
          {profile.location && <Text style={styles.contactItem}>{profile.location}</Text>}
          {profile.linkedin && <Text style={styles.contactItem}>{profile.linkedin}</Text>}
          {profile.github && <Text style={styles.contactItem}>{profile.github}</Text>}
        </View>

        {/* Summary */}
        {summary && (
          <>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.summaryText}>{summary}</Text>
          </>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.skillsRow}>
              {skills.slice(0, 20).map((skill, i) => (
                <Text key={i} style={styles.skillTag}>{skill}</Text>
              ))}
            </View>
          </>
        )}

        {/* Experience */}
        {profile.experience.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Experience</Text>
            {profile.experience.map((exp, i) => (
              <View key={i} style={styles.expEntry}>
                <View style={styles.expHeader}>
                  <Text style={styles.expTitle}>{exp.title}</Text>
                  <Text style={styles.expPeriod}>{exp.period}</Text>
                </View>
                <Text style={styles.expCompany}>{exp.company}</Text>
                <Text style={styles.expDesc}>
                  {tailored?.experienceHighlights?.[i] || exp.description}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Education */}
        {profile.education.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Education</Text>
            {profile.education.map((edu, i) => (
              <View key={i} style={styles.eduEntry}>
                <Text style={styles.eduDegree}>{edu.degree}</Text>
                <Text style={styles.eduInstitution}>
                  {edu.institution} | {edu.period}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Certifications */}
        {profile.certifications && profile.certifications.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Certifications</Text>
            {profile.certifications.map((cert, i) => (
              <Text key={i} style={styles.expDesc}>{cert}</Text>
            ))}
          </>
        )}

        {/* Languages */}
        {profile.languages && profile.languages.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Languages</Text>
            <Text style={styles.langRow}>{profile.languages.join(' | ')}</Text>
          </>
        )}
      </Page>
    </Document>
  );
}

// ==================== Parse resume text into structured profile ====================

export async function parseResumeToProfile(
  resumeText: string,
  parsedProfile: Record<string, unknown> | null,
): Promise<ResumeProfile> {
  const { client, model } = getAIClient();

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.1,
      max_tokens: 1500,
      messages: [
        {
          role: 'system',
          content: `Extract structured resume data. Return ONLY valid JSON:
{
  "name": "string",
  "email": "string",
  "phone": "string or null",
  "location": "string or null",
  "linkedin": "string or null",
  "github": "string or null",
  "summary": "2-3 sentence professional summary",
  "skills": ["skill1", "skill2"],
  "experience": [{"title":"Job Title","company":"Company","period":"Mon YYYY - Mon YYYY","description":"2-3 sentences about role"}],
  "education": [{"degree":"Degree Name","institution":"University","period":"YYYY - YYYY"}],
  "certifications": ["cert1"],
  "languages": ["English", "Spanish"]
}`,
        },
        {
          role: 'user',
          content: resumeText.substring(0, 6000),
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim() || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        name: parsed.name || parsedProfile?.name || 'Applicant',
        email: parsed.email || (parsedProfile?.email as string) || '',
        phone: parsed.phone,
        location: parsed.location,
        linkedin: parsed.linkedin,
        github: parsed.github,
        summary: parsed.summary || '',
        skills: parsed.skills || (parsedProfile?.skills as string[]) || [],
        experience: parsed.experience || [],
        education: parsed.education || [],
        certifications: parsed.certifications,
        languages: parsed.languages || (parsedProfile?.languages as string[]),
      };
    }
  } catch (error) {
    console.error('[ResumePDF] AI parsing failed:', error);
  }

  // Fallback from existing parsedProfile
  return {
    name: (parsedProfile?.name as string) || 'Applicant',
    email: (parsedProfile?.email as string) || '',
    phone: parsedProfile?.phone as string || null,
    location: null,
    summary: (parsedProfile?.summary as string) || '',
    skills: (parsedProfile?.skills as string[]) || [],
    experience: [],
    education: [],
    languages: parsedProfile?.languages as string[],
  };
}

// ==================== Tailor resume for a specific job ====================

async function tailorResumeForJob(
  profile: ResumeProfile,
  jobTitle: string,
  jobDescription: string,
): Promise<TailoredResume | null> {
  const { client, model } = getAIClient();

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.5,
      max_tokens: 800,
      messages: [
        {
          role: 'system',
          content: `You tailor resumes for specific jobs. Given a candidate profile and job posting, return JSON:
{
  "summary": "2-3 sentence summary highlighting relevance to THIS specific role",
  "skills": ["reordered skills array — most relevant to the job first, keep all skills"],
  "experienceHighlights": ["tailored description for each experience entry emphasizing relevant aspects"]
}
Keep it truthful — only reframe existing experience, never invent new skills or experience.`,
        },
        {
          role: 'user',
          content: `JOB: ${jobTitle}
DESCRIPTION: ${jobDescription.substring(0, 800)}

CANDIDATE:
Name: ${profile.name}
Summary: ${profile.summary}
Skills: ${profile.skills.join(', ')}
Experience: ${profile.experience.map(e => `${e.title} at ${e.company}: ${e.description}`).join('\n')}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim() || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('[ResumePDF] Tailoring failed, using original:', error);
  }

  return null;
}

// ==================== Main: generate tailored PDF ====================

/**
 * Generate a tailored PDF resume for a specific job application.
 * Returns base64-encoded PDF string.
 */
export async function generateTailoredResume(params: {
  resumeText: string;
  parsedProfile: Record<string, unknown> | null;
  jobTitle: string;
  jobDescription: string;
}): Promise<{ base64: string; filename: string } | null> {
  try {
    // 1. Parse resume into structured profile
    const profile = await parseResumeToProfile(params.resumeText, params.parsedProfile);

    if (!profile.name || profile.skills.length === 0) {
      console.warn('[ResumePDF] Profile too sparse, skipping PDF generation');
      return null;
    }

    // 2. Tailor for job
    const tailored = await tailorResumeForJob(
      profile,
      params.jobTitle,
      params.jobDescription,
    );

    // 3. Render PDF
    const buffer = await renderToBuffer(
      <ResumePDF profile={profile} tailored={tailored} />
    );

    const base64 = Buffer.from(buffer).toString('base64');
    const safeName = profile.name.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${safeName}_Resume.pdf`;

    console.log(`[ResumePDF] Generated ${filename} (${Math.round(base64.length / 1024)}KB)`);

    return { base64, filename };
  } catch (error) {
    console.error('[ResumePDF] Generation failed:', error);
    return null;
  }
}
