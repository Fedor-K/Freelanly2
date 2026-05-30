'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { X, Briefcase, Zap } from 'lucide-react';
import { useExitIntent } from '@/hooks/useExitIntent';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { track } from '@/lib/analytics';

interface CrossSellItem {
  id: string;
  slug: string;
  title: string;
  type: 'job' | 'opportunity';
  // For jobs
  companyName?: string;
  companySlug?: string;
  companyLogo?: string | null;
  // For opportunities
  clientName?: string;
  clientAvatar?: string | null;
  // Common
  location?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
}

interface CrossSellExitPopupProps {
  currentType: 'job' | 'opportunity';
  categorySlug: string;
  categoryName: string;
}

export function CrossSellExitPopup({
  currentType,
  categorySlug,
  categoryName,
}: CrossSellExitPopupProps) {
  const { showPopup, closePopup } = useExitIntent({
    threshold: 50,
    delay: 5000, // Wait 5 seconds before enabling
    cookieName: `cross_sell_${currentType}_shown`,
    cookieDays: 1, // Show again after 1 day
  });

  const [items, setItems] = useState<CrossSellItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch cross-sell items when popup opens
  useEffect(() => {
    if (!showPopup || items.length > 0) return;

    const fetchItems = async () => {
      setLoading(true);
      try {
        // Fetch opposite type items from same category
        const targetType = currentType === 'job' ? 'opportunity' : 'job';
        const response = await fetch(
          `/api/cross-sell?type=${targetType}&category=${categorySlug}&limit=3`
        );
        if (response.ok) {
          const data = await response.json();
          setItems(data.items || []);
        }
      } catch (error) {
        console.error('Failed to fetch cross-sell items:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [showPopup, currentType, categorySlug, items.length]);

  const handleClose = () => {
    track({
      name: 'cross_sell_dismissed',
      params: { currentType, categorySlug }
    });
    closePopup();
  };

  const handleItemClick = (item: CrossSellItem) => {
    track({
      name: 'cross_sell_click',
      params: {
        currentType,
        targetType: item.type,
        itemId: item.id,
        categorySlug,
      }
    });
  };

  if (!showPopup) return null;

  const isShowingOpportunities = currentType === 'job';
  const title = isShowingOpportunities
    ? '🔥 Urgent Freelance Projects'
    : 'Full-Time Opportunities';
  const subtitle = isShowingOpportunities
    ? `Clients in ${categoryName} need help NOW! Apply before others do.`
    : `Stable positions in ${categoryName} from top companies`;
  const Icon = isShowingOpportunities ? Zap : Briefcase;
  const accentColor = isShowingOpportunities ? 'orange' : 'blue';

  return (
    <Dialog open={showPopup} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-full ${isShowingOpportunities ? 'bg-orange-100' : 'bg-blue-100'}`}>
              <Icon className={`h-6 w-6 ${isShowingOpportunities ? 'text-orange-600' : 'text-blue-600'}`} />
            </div>
            <div>
              <h2 className="text-lg font-bold">{title}</h2>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
          </div>

          {/* Items */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-16 bg-gray-100 rounded-lg" />
                </div>
              ))}
            </div>
          ) : items.length > 0 ? (
            <div className="space-y-3">
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={
                    item.type === 'job'
                      ? `/company/${item.companySlug}/jobs/${item.slug}`
                      : `/freelance/${item.slug}`
                  }
                  onClick={() => handleItemClick(item)}
                  className={`block p-3 rounded-lg border hover:border-${accentColor}-300 hover:bg-${accentColor}-50/30 transition-colors`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar/Logo */}
                    <div className="flex-shrink-0">
                      {item.type === 'job' ? (
                        item.companyLogo ? (
                          <Image
                            src={item.companyLogo}
                            alt={item.companyName || ''}
                            width={40}
                            height={40}
                            className="rounded-lg object-contain"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-semibold">
                            {item.companyName?.charAt(0).toUpperCase()}
                          </div>
                        )
                      ) : (
                        item.clientAvatar ? (
                          <Image
                            src={item.clientAvatar}
                            alt={item.clientName || ''}
                            width={40}
                            height={40}
                            className="rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-semibold">
                            {item.clientName?.charAt(0).toUpperCase()}
                          </div>
                        )
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-1">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.type === 'job' ? item.companyName : item.clientName}
                        {item.location && ` · ${item.location}`}
                      </p>
                      {item.salaryMin && (
                        <p className="text-xs text-green-600 font-medium mt-0.5">
                          {formatSalary(item.salaryMin, item.salaryMax ?? null, item.salaryCurrency ?? null)}
                        </p>
                      )}
                    </div>

                    {/* Badge */}
                    <Badge
                      variant="outline"
                      className={`flex-shrink-0 text-xs ${
                        item.type === 'opportunity'
                          ? 'bg-orange-100 text-orange-700 border-orange-200'
                          : 'bg-blue-100 text-blue-700 border-blue-200'
                      }`}
                    >
                      {item.type === 'opportunity' ? '🔥 Urgent' : 'Full-time'}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              No {isShowingOpportunities ? 'freelance projects' : 'full-time jobs'} found in this category.
            </p>
          )}

          {/* CTA */}
          {items.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <Link
                href={`/jobs/${categorySlug}`}
                onClick={handleClose}
                className={`text-sm font-medium ${isShowingOpportunities ? 'text-orange-600 hover:text-orange-700' : 'text-blue-600 hover:text-blue-700'}`}
              >
                View all {categoryName} {isShowingOpportunities ? 'freelance projects' : 'jobs'} →
              </Link>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatSalary(
  min: number | null,
  max: number | null,
  currency: string | null
): string {
  if (!min) return '';
  const curr = currency || 'USD';

  try {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: 0,
    });

    if (min && max) {
      return `${formatter.format(min)} - ${formatter.format(max)}`;
    }
    return `${formatter.format(min)}+`;
  } catch {
    return `$${min.toLocaleString()}+`;
  }
}
