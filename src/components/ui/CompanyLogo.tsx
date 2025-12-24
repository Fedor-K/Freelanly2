'use client';

import { useState } from 'react';
import Image from 'next/image';
import { getCompanyLogoUrl } from '@/lib/company-logo';
import { cn } from '@/lib/utils';

interface CompanyLogoProps {
  name: string;
  logo?: string | null;
  website?: string | null;
  email?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  priority?: boolean;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-12 h-12 text-lg',
  lg: 'w-16 h-16 text-2xl',
  xl: 'w-20 h-20 text-3xl',
};

const sizePx = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 80,
};

const faviconSizes = {
  sm: 64,
  md: 128,
  lg: 128,
  xl: 256,
};

export function CompanyLogo({
  name,
  logo,
  website,
  email,
  size = 'md',
  className,
  priority = false,
}: CompanyLogoProps) {
  const [imageError, setImageError] = useState(false);

  const faviconSize = faviconSizes[size];
  const logoUrl = getCompanyLogoUrl(logo, website, email, faviconSize);
  const dimensions = sizePx[size];

  // Show placeholder if no logo URL or if image failed to load
  if (!logoUrl || imageError) {
    return (
      <div
        className={cn(
          'rounded-lg bg-muted flex items-center justify-center font-semibold text-muted-foreground',
          sizeClasses[size],
          className
        )}
        aria-label={`Logo placeholder for ${name}`}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <Image
      src={logoUrl}
      alt={`${name} logo`}
      width={dimensions}
      height={dimensions}
      className={cn('rounded-lg object-cover', sizeClasses[size], className)}
      onError={() => setImageError(true)}
      loading={priority ? 'eager' : 'lazy'}
      priority={priority}
      unoptimized // External URLs from Logo.dev
    />
  );
}
