'use client';

import { useEffect } from 'react';
import { useTracker } from '@/hooks/useTracker';

interface OpportunityViewTrackerProps {
  opportunityId: string;
  title: string;
  clientName?: string;
  category?: string;
}

export function OpportunityViewTracker({ opportunityId, title, clientName, category }: OpportunityViewTrackerProps) {
  const { track } = useTracker();

  useEffect(() => {
    track('OPPORTUNITY_VIEW', { opportunityId, title, client: clientName, category });
  }, [opportunityId, title, clientName, category, track]);

  return null;
}
