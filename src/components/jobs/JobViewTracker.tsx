'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics';

interface JobViewTrackerProps {
  jobId: string;
  jobTitle: string;
  companyName: string;
  category: string;
}

export function JobViewTracker({ jobId, jobTitle, companyName, category }: JobViewTrackerProps) {
  useEffect(() => {
    track({
      name: 'job_view',
      params: {
        job_id: jobId,
        job_title: jobTitle,
        company: companyName,
        category,
      },
    });
  }, [jobId, jobTitle, companyName, category]);

  return null;
}
