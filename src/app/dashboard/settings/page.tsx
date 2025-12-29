import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SettingsForm } from './SettingsForm';
import { CancelSubscriptionSection } from './CancelSubscriptionSection';
import { DeleteAccountSection } from './DeleteAccountSection';
import { ManageSubscriptionButton } from './ManageSubscriptionButton';

export const metadata: Metadata = {
  title: 'Settings',
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
      subscriptionEndsAt: true,
      stripeSubscriptionId: true,
      stripeId: true,
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

          {/* Subscription management */}
          <div className="mt-6 pt-4 border-t">
            {user.stripeId ? (
              <>
                <p className="text-sm text-gray-600 mb-3">
                  Update payment method, view invoices, or change your plan
                </p>
                <ManageSubscriptionButton />
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-3">
                  {user.plan === 'FREE'
                    ? 'Upgrade to PRO to unlock all features'
                    : 'Link your subscription to manage billing'}
                </p>
                <a
                  href="/pricing"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                  {user.plan === 'FREE' ? 'Upgrade to PRO' : 'View Plans'}
                </a>
              </>
            )}
          </div>
        </div>

        {/* Cancel subscription (only for PRO users with active subscription) */}
        {user.plan === 'PRO' && user.stripeSubscriptionId && (
          <CancelSubscriptionSection subscriptionEndsAt={user.subscriptionEndsAt} />
        )}

        {/* Delete account */}
        <DeleteAccountSection />
      </div>
    </div>
  );
}
