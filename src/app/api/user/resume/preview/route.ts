import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateTailoredResume, parseResumeToProfile } from '@/services/resume-pdf-generator';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';

/**
 * GET /api/user/resume/preview
 * Generate and return base resume PDF (no tailoring)
 *
 * GET /api/user/resume/preview?appId=xxx
 * Generate tailored resume for a specific application
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const appId = request.nextUrl.searchParams.get('appId');

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        resumeText: true,
        parsedProfile: true,
        name: true,
      },
    });

    if (!user?.resumeText) {
      return NextResponse.json({ error: 'No resume uploaded. Please upload your resume first.' }, { status: 400 });
    }

    // If appId provided, generate tailored version
    if (appId) {
      const app = await prisma.autoApplication.findFirst({
        where: { id: appId, userId: session.user.id },
        select: {
          jobTitle: true,
          jobId: true,
          opportunityId: true,
        },
      });

      if (!app) {
        return NextResponse.json({ error: 'Application not found' }, { status: 404 });
      }

      // Get job description
      let jobDescription = '';
      if (app.jobId) {
        const job = await prisma.job.findUnique({
          where: { id: app.jobId },
          select: { description: true },
        });
        jobDescription = job?.description || '';
      } else if (app.opportunityId) {
        const opp = await prisma.opportunity.findUnique({
          where: { id: app.opportunityId },
          select: { description: true },
        });
        jobDescription = opp?.description || '';
      }

      const result = await generateTailoredResume({
        resumeText: user.resumeText,
        parsedProfile: user.parsedProfile as Record<string, unknown> | null,
        jobTitle: app.jobTitle,
        jobDescription,
      });

      if (!result) {
        return NextResponse.json({ error: 'Failed to generate resume' }, { status: 500 });
      }

      const pdfBuffer = Buffer.from(result.base64, 'base64');
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${result.filename}"`,
        },
      });
    }

    // Base resume (no tailoring)
    const profile = await parseResumeToProfile(
      user.resumeText,
      user.parsedProfile as Record<string, unknown> | null,
    );

    // Dynamic import to avoid SSR issues
    const { Document, Page, Text, View, StyleSheet } = await import('@react-pdf/renderer');

    const styles = StyleSheet.create({
      page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#333', lineHeight: 1.4 },
      name: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#111', marginBottom: 4 },
      contactRow: { flexDirection: 'row', flexWrap: 'wrap', fontSize: 9, color: '#555', marginBottom: 16 },
      contactItem: { marginRight: 12 },
      sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#111', borderBottomWidth: 1, borderBottomColor: '#ddd', paddingBottom: 3, marginBottom: 8, marginTop: 14, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
      text: { fontSize: 10, color: '#444', lineHeight: 1.5 },
      skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
      skillTag: { fontSize: 9, backgroundColor: '#f3f4f6', padding: '3 8', borderRadius: 3, color: '#374151' },
      expEntry: { marginBottom: 10 },
      expHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
      expTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#111' },
      expPeriod: { fontSize: 9, color: '#888' },
      expCompany: { fontSize: 9, color: '#666', marginBottom: 3 },
      expDesc: { fontSize: 9, color: '#444', lineHeight: 1.5 },
      eduEntry: { marginBottom: 6 },
      eduDegree: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#111' },
      eduInst: { fontSize: 9, color: '#666' },
    });

    const doc = React.createElement(Document, null,
      React.createElement(Page, { size: 'A4', style: styles.page },
        React.createElement(Text, { style: styles.name }, profile.name),
        React.createElement(View, { style: styles.contactRow },
          profile.email ? React.createElement(Text, { style: styles.contactItem }, profile.email) : null,
          profile.phone ? React.createElement(Text, { style: styles.contactItem }, profile.phone) : null,
          profile.location ? React.createElement(Text, { style: styles.contactItem }, profile.location) : null,
        ),
        profile.summary ? React.createElement(Text, { style: styles.sectionTitle }, 'SUMMARY') : null,
        profile.summary ? React.createElement(Text, { style: styles.text }, profile.summary) : null,
        profile.skills.length > 0 ? React.createElement(Text, { style: styles.sectionTitle }, 'SKILLS') : null,
        profile.skills.length > 0 ? React.createElement(View, { style: styles.skillsRow },
          ...profile.skills.slice(0, 20).map((s, i) => React.createElement(Text, { key: i, style: styles.skillTag }, s))
        ) : null,
        profile.experience.length > 0 ? React.createElement(Text, { style: styles.sectionTitle }, 'EXPERIENCE') : null,
        ...profile.experience.map((exp, i) => React.createElement(View, { key: i, style: styles.expEntry },
          React.createElement(View, { style: styles.expHeader },
            React.createElement(Text, { style: styles.expTitle }, exp.title),
            React.createElement(Text, { style: styles.expPeriod }, exp.period),
          ),
          React.createElement(Text, { style: styles.expCompany }, exp.company),
          React.createElement(Text, { style: styles.expDesc }, exp.description),
        )),
        profile.education.length > 0 ? React.createElement(Text, { style: styles.sectionTitle }, 'EDUCATION') : null,
        ...profile.education.map((edu, i) => React.createElement(View, { key: i, style: styles.eduEntry },
          React.createElement(Text, { style: styles.eduDegree }, edu.degree),
          React.createElement(Text, { style: styles.eduInst }, `${edu.institution} | ${edu.period}`),
        )),
        profile.languages && profile.languages.length > 0 ? React.createElement(Text, { style: styles.sectionTitle }, 'LANGUAGES') : null,
        profile.languages && profile.languages.length > 0 ? React.createElement(Text, { style: styles.text }, profile.languages.join(' | ')) : null,
      )
    );

    const buffer = await renderToBuffer(doc);
    const safeName = profile.name.replace(/[^a-zA-Z0-9]/g, '_');

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeName}_Resume.pdf"`,
      },
    });
  } catch (error) {
    console.error('[API] Resume preview error:', error);
    return NextResponse.json({ error: 'Failed to generate resume preview' }, { status: 500 });
  }
}
