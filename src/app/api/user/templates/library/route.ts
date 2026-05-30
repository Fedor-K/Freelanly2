import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { CoverLetterTemplate } from '@prisma/client';

const TEMPLATE_LIBRARY = [
  {
    name: 'Short opener · portfolio-first',
    subject: 'Re: {{role}} — {{name}}',
    body: `Hi {{recruiter}},

Saw your post about the {{role}} position. I've done similar work recently — here's a quick look: {{experience}}.

My key skills: {{skills}}. Happy to share more details or hop on a quick call.

— {{name}}`,
    type: 'APPLICATION' as const,
  },
  {
    name: 'Professional · detailed',
    subject: 'Application for {{role}} — {{name}}',
    body: `Dear {{recruiter}},

I'm writing to express my interest in the {{role}} position at {{company}}. With my background in {{skills}}, I believe I can contribute meaningfully to your team.

{{experience}}

I would welcome the opportunity to discuss how my skills align with your needs. I'm available for a call at your convenience.

Best regards,
{{name}}`,
    type: 'APPLICATION' as const,
  },
  {
    name: 'Casual · human',
    subject: '{{role}} — quick note from {{name}}',
    body: `Hey {{recruiter}},

Spotted your {{role}} post — looks like a great fit. I've been working with {{skills}} for a while now and {{experience}}.

No pressure, but would love to chat if you're still looking. Flexible on timing.

Cheers,
{{name}}`,
    type: 'APPLICATION' as const,
  },
  {
    name: 'Follow-up · polite nudge',
    subject: 'Re: {{role}} — following up',
    body: `Hi {{recruiter}},

Just a quick follow-up on my application for the {{role}} position at {{company}}. I remain very interested and would love to discuss how I can contribute.

No worries if the timing isn't right — happy to circle back later.

Best,
{{name}}`,
    type: 'FOLLOWUP' as const,
  },
  {
    name: 'Cold outreach · value-first',
    subject: '{{role}} — I can help with {{company}}',
    body: `Hi {{recruiter}},

I noticed {{company}} might need help with {{role}}-related work. I specialize in {{skills}} and recently {{experience}}.

Would it make sense to chat for 15 minutes this week? If not, totally understand.

— {{name}}`,
    type: 'APPLICATION' as const,
  },
];

/**
 * GET /api/user/templates/library — list available templates to import
 * POST /api/user/templates/library — import selected templates
 */
export async function GET() {
  return NextResponse.json({ templates: TEMPLATE_LIBRARY });
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { indices } = await request.json();
    // indices: [0, 2, 3] — which templates to import

    const toImport = Array.isArray(indices)
      ? indices.filter((i: number) => i >= 0 && i < TEMPLATE_LIBRARY.length).map((i: number) => TEMPLATE_LIBRARY[i])
      : TEMPLATE_LIBRARY; // import all if no indices

    const created: CoverLetterTemplate[] = [];
    for (const tpl of toImport) {
      const existing = await prisma.coverLetterTemplate.findFirst({
        where: { userId: session.user.id, name: tpl.name },
      });
      if (!existing) {
        const t = await prisma.coverLetterTemplate.create({
          data: {
            userId: session.user.id,
            name: tpl.name,
            subject: tpl.subject,
            body: tpl.body,
            type: tpl.type,
            isDefault: created.length === 0,
          },
        });
        created.push(t);
      }
    }

    return NextResponse.json({ imported: created.length, templates: created });
  } catch (error) {
    console.error('[TemplateLibrary] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
