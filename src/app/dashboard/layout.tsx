import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { PendingRegistrationHandler } from '@/components/auth/PendingRegistrationHandler';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PendingRegistrationHandler />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
