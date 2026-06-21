import { ProcessingScreen } from '@/components/ProcessingScreen';

// Shown automatically by Next.js while the (force-dynamic) Discovery page builds your feed on the
// server — the "we're scanning posts for you" moment.
const DISCOVERY_SCAN_STEPS = [
  { title: 'Scanning the feed…', sub: 'Reading the freshest gigs' },
  { title: 'Matching to your profile…', sub: 'Skills, role, languages, location' },
  { title: 'Ranking your matches…', sub: 'Strongest fits first' },
];

export default function DiscoveryLoading() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '62vh', padding: '20px' }}>
      <ProcessingScreen steps={DISCOVERY_SCAN_STEPS} emoji="🔍" note="Finding gigs that fit you…" />
    </div>
  );
}
