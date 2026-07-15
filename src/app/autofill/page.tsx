import type { Metadata } from 'next';
import AutofillBetaClient from './AutofillBetaClient';

export const metadata: Metadata = {
  title: 'Freelanly Autofill — 1-click apply',
  robots: { index: false, follow: false },
};

// REAL lander (fake-door until 2026-07-15 — the extension shipped): download zip + load-unpacked
// instructions + the user's connect token inline. Feed ATS cards point here.
export default async function AutofillPage({ searchParams }: { searchParams: Promise<{ opp?: string }> }) {
  const { opp } = await searchParams;
  return <AutofillBetaClient opp={opp || null} />;
}
