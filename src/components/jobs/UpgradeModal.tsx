'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Lock, Check, Zap, Mail, DollarSign, Star } from 'lucide-react';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  jobId?: string;
  jobTitle?: string;
  companyName?: string;
}

const TESTIMONIALS = [
  {
    text: "Got 3 interview calls in my first week as PRO!",
    author: "Michael R.",
    role: "Now at Shopify",
  },
  {
    text: "The direct contact info alone is worth it. Landed my dream remote job.",
    author: "Sarah K.",
    role: "Senior Developer",
  },
  {
    text: "Finally, a job board that actually helps you get hired, not just browse.",
    author: "Alex M.",
    role: "Product Manager",
  },
];

export function UpgradeModal({ open, onClose, jobId, jobTitle, companyName }: UpgradeModalProps) {
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const [upgradeCount, setUpgradeCount] = useState(847);
  const trackedRef = useRef(false);

  // Track apply attempt when modal opens
  useEffect(() => {
    if (open && jobId && !trackedRef.current) {
      trackedRef.current = true;
      fetch('/api/user/apply-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      }).catch(() => {});
    }
    if (!open) {
      trackedRef.current = false;
    }
  }, [open, jobId]);

  // Rotate testimonials
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      setTestimonialIndex((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [open]);

  // Simulate realistic upgrade count (increases slightly over time)
  useEffect(() => {
    const baseCount = 800;
    const dayOfMonth = new Date().getDate();
    const hourOfDay = new Date().getHours();
    // Grows ~30/day on average
    setUpgradeCount(baseCount + dayOfMonth * 30 + Math.floor(hourOfDay / 3));
  }, []);

  const testimonial = TESTIMONIALS[testimonialIndex];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">
            Unlock Job Applications
          </DialogTitle>
        </DialogHeader>

        {jobTitle && companyName && (
          <div className="rounded-lg bg-muted/50 p-3 text-center text-sm">
            You&apos;re trying to apply to{' '}
            <span className="font-medium">{jobTitle}</span> at{' '}
            <span className="font-medium">{companyName}</span>
          </div>
        )}

        <div className="space-y-3 py-2">
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100">
              <Check className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="font-medium">Apply to unlimited jobs</p>
              <p className="text-sm text-muted-foreground">
                Direct applications to companies
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100">
              <Mail className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="font-medium">See direct contact info</p>
              <p className="text-sm text-muted-foreground">
                Emails, phones, and social handles
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100">
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="font-medium">Full salary insights</p>
              <p className="text-sm text-muted-foreground">
                Range, percentiles, and market data
              </p>
            </div>
          </div>
        </div>

        {/* Social proof */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Zap className="h-4 w-4 text-yellow-500" />
          <span>
            <strong className="text-foreground">{upgradeCount}</strong> professionals
            upgraded this month
          </span>
        </div>

        {/* Testimonial */}
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="flex items-start gap-2">
            <Star className="h-4 w-4 shrink-0 text-yellow-500" />
            <div>
              <p className="text-sm italic">&quot;{testimonial.text}&quot;</p>
              <p className="mt-1 text-xs text-muted-foreground">
                — {testimonial.author}, {testimonial.role}
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-2 pt-2">
          <Button className="w-full" size="lg" asChild>
            <Link href="/pricing">
              Upgrade to Premium
            </Link>
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Starting at €0.39/day. Cancel anytime.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
