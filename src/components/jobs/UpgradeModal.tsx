'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Zap, Check, Calendar, DollarSign, Eye } from 'lucide-react';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  jobId?: string;
  jobTitle?: string;
  companyName?: string;
  postedAt?: Date | string;
  budget?: string | null;
  viewCount?: number;
  opportunityId?: string;
}

function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const posted = new Date(date);
  const diffMs = now.getTime() - posted.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 60) return `${diffMinutes} мин. назад`;
  if (diffHours < 24) return `${diffHours} ч. назад`;
  if (diffDays === 1) return 'вчера';
  if (diffDays < 7) return `${diffDays} дн. назад`;
  return posted.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function UpgradeModal({
  open,
  onClose,
  jobId,
  jobTitle,
  companyName,
  postedAt,
  budget,
  viewCount,
  opportunityId,
}: UpgradeModalProps) {
  const trackedRef = useRef(false);

  // Track apply attempt when modal opens
  useEffect(() => {
    if (open && (jobId || opportunityId) && !trackedRef.current) {
      trackedRef.current = true;
      fetch('/api/user/apply-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opportunityId ? { opportunityId } : { jobId }),
      }).catch(() => {});
    }
    if (!open) {
      trackedRef.current = false;
    }
  }, [open, jobId, opportunityId]);

  const pricingUrl = jobId
    ? `/pricing?utm_source=upgrade_modal&utm_medium=paywall&utm_campaign=project_now&jobId=${jobId}`
    : opportunityId
      ? `/pricing?utm_source=upgrade_modal&utm_medium=paywall&utm_campaign=project_now&opportunityId=${opportunityId}`
      : '/pricing?utm_source=upgrade_modal&utm_medium=paywall&utm_campaign=project_now';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Zap className="h-5 w-5 text-orange-500" />
            Проект доступен прямо сейчас
          </DialogTitle>
        </DialogHeader>

        {/* Project info */}
        {(jobTitle || companyName) && (
          <div className="rounded-lg bg-muted/50 p-4">
            {jobTitle && (
              <p className="font-semibold text-base">{jobTitle}</p>
            )}
            {companyName && (
              <p className="text-sm text-muted-foreground mt-0.5">{companyName}</p>
            )}

            {(postedAt || budget || (viewCount != null && viewCount > 0)) && (
              <div className="mt-3 space-y-1.5">
                {postedAt && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 shrink-0" />
                    <span>Опубликован: {formatTimeAgo(postedAt)}</span>
                  </div>
                )}
                {budget && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <DollarSign className="h-4 w-4 shrink-0" />
                    <span>Бюджет: {budget}</span>
                  </div>
                )}
                {viewCount != null && viewCount > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Eye className="h-4 w-4 shrink-0" />
                    <span>Уже просмотрели: {viewCount} чел.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Separator + explanation */}
        <p className="text-sm text-muted-foreground">
          Чтобы увидеть контакт и откликнуться напрямую — нужен PRO доступ.
        </p>

        {/* Benefits */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-green-600 shrink-0" />
            <span>Прямой контакт без посредников</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-green-600 shrink-0" />
            <span>Подай заявку раньше других</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-green-600 shrink-0" />
            <span>Алёрты о новых проектах</span>
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-2 pt-2">
          <Button className="w-full" size="lg" asChild>
            <Link href={pricingUrl}>
              Открыть контакт и откликнуться
            </Link>
          </Button>
          <Button variant="ghost" className="w-full text-sm" size="sm" asChild>
            <Link href="/pricing">
              Посмотреть все тарифы
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
