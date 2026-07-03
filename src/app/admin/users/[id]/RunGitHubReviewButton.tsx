'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function RunGitHubReviewButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/github-review`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'done' || data.status === 'cached') {
        router.refresh();
      } else {
        setNote(data.reason || data.error || 'failed');
      }
    } catch {
      setNote('network error');
    }
    setBusy(false);
  }

  return (
    <span className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={run} disabled={busy}>
        {busy ? 'Проверяю…' : 'Проверить GitHub'}
      </Button>
      {note && <span className="text-xs text-red-600">{note}</span>}
    </span>
  );
}
