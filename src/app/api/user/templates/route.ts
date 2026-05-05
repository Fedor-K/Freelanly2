import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { TemplateType } from '@prisma/client';

// GET /api/user/templates — List user's cover letter templates
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templates = await prisma.coverLetterTemplate.findMany({
      where: { userId: session.user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error('[API] Error getting templates:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// POST /api/user/templates — Create a new cover letter template
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, subject, body: templateBody, type, isDefault } = body as {
      name?: string;
      subject?: string;
      body?: string;
      type?: string;
      isDefault?: boolean;
    };

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!subject || !subject.trim()) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }

    if (!templateBody || !templateBody.trim()) {
      return NextResponse.json({ error: 'Body is required' }, { status: 400 });
    }

    // Validate type
    const validTypes: TemplateType[] = ['APPLICATION', 'FOLLOWUP'];
    const templateType = (type as TemplateType) || 'APPLICATION';
    if (!validTypes.includes(templateType)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.coverLetterTemplate.updateMany({
        where: { userId: session.user.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await prisma.coverLetterTemplate.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        subject: subject.trim(),
        body: templateBody.trim(),
        type: templateType,
        isDefault: isDefault || false,
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error('[API] Error creating template:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// PATCH /api/user/templates — Update an existing template
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body as {
      id: string;
      name?: string;
      subject?: string;
      body?: string;
      type?: string;
      isDefault?: boolean;
    };

    if (!id) {
      return NextResponse.json({ error: 'Template id is required' }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.coverLetterTemplate.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // If setting as default, unset other defaults
    if (updates.isDefault) {
      await prisma.coverLetterTemplate.updateMany({
        where: { userId: session.user.id, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    // Build update data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (updates.name !== undefined) data.name = updates.name.trim();
    if (updates.subject !== undefined) data.subject = updates.subject.trim();
    if (updates.body !== undefined) data.body = updates.body.trim();
    if (updates.type !== undefined) data.type = updates.type;
    if (updates.isDefault !== undefined) data.isDefault = updates.isDefault;

    const template = await prisma.coverLetterTemplate.update({
      where: { id },
      data,
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error('[API] Error updating template:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// DELETE /api/user/templates — Delete a template
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Template id is required' }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.coverLetterTemplate.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    await prisma.coverLetterTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting template:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
