'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics';
import { useTracker } from '@/hooks/useTracker';

interface JobViewTrackerProps {
  jobId: string;
  jobTitle: string;
  companyName: string;
  category: string;
}

export function JobViewTracker({ jobId, jobTitle, companyName, category }: JobViewTrackerProps) {
  const { track: trackDb } = useTracker();

  useEffect(() => {
    // External analytics (Yandex, GA, Vercel)
    track({
      name: 'job_view',
      params: {
        job_id: jobId,
        job_title: jobTitle,
        company: companyName,
        category,
      },
    });

    // Internal DB tracking
    trackDb('JOB_VIEW', { jobId, title: jobTitle, company: companyName, category });
  }, [jobId, jobTitle, companyName, category, trackDb]);

  return null;
}
