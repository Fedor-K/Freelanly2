import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { TemplatesClient } from '@/components/app/TemplatesClient';
import './templates-design.css';

export const metadata: Metadata = {
  title: 'Templates — Freelanly',
};

export const revalidate = 60;

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const templates = await prisma.coverLetterTemplate.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: 'desc' }, { replyCount: 'desc' }],
    select: {
      id: true, name: true, subject: true, body: true,
      isDefault: true, sentCount: true, replyCount: true,
    },
  });

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h1>Templates</h1>
          <p>Reusable opener structures. Edit once, personalize per role with variables.</p>
        </div>
      </div>

      <TemplatesClient templates={templates} />
    </div>
  );
}
