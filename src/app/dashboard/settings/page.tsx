import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SettingsForm } from './SettingsForm';
import { DeleteAccountSection } from './DeleteAccountSection';

export const metadata: Metadata = {
  title: 'Settings | Freelanly',
  description: 'Manage your profile settings',
};

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/dashboard/settings');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      resumeUrl: true,
      plan: true,
      createdAt: true,
    },
  });

  if (!user) {
    redirect('/auth/signin');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-8">Profile Settings</h1>

        <SettingsForm
          initialData={{
            name: user.name || '',
            email: user.email,
            resumeUrl: user.resumeUrl || '',
          }}
        />

        {/* Account info */}
        <div className="mt-8 bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Account</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Email</span>
              <span className="font-medium">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Plan</span>
              <span
                className={`font-medium ${
                  user.plan === 'PRO' ? 'text-purple-600' : ''
                }`}
              >
                {user.plan}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Member since</span>
              <span className="font-medium">
                {new Date(user.createdAt).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Delete account */}
        <DeleteAccountSection />
      </div>
    </div>
  );
}
