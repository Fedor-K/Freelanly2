import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminLayoutClient from './layout-client';

const ADMIN_EMAILS = ['fedor.hatla@gmail.com'];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect('/auth/signin?callbackUrl=/admin');
  }

  if (!ADMIN_EMAILS.includes(session.user.email)) {
    redirect('/');
  }

  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
