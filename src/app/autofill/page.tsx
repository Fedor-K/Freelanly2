import type { Metadata } from 'next';
import AutofillBetaClient from './AutofillBetaClient';

export const metadata: Metadata = {
  title: 'Freelanly Autofill — 1-click apply (beta)',
  robots: { index: false, follow: false },
};

// Fake-door lander for the browser-extension autofill test. The feed's ATS cards point here; we
// measure views + "Get early access" clicks (FUNNEL_STEP events) before building the extension.
export default async function AutofillPage({ searchParams }: { searchParams: Promise<{ opp?: string }> }) {
  const { opp } = await searchParams;
  return <AutofillBetaClient opp={opp || null} />;
}
