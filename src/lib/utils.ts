import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDistanceToNow(date: Date | string): string {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}w ago`;
  return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Job freshness: max age in days before a job is considered stale
// Google recommends 30 days for job postings
export const MAX_JOB_AGE_DAYS = 30;

export function getMaxJobAgeDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() - MAX_JOB_AGE_DAYS);
  return date;
}

// Free email providers - emails from these domains should not trigger company enrichment
export const FREE_EMAIL_PROVIDERS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'mail.ru',
  'yandex.ru',
  'yandex.com',
  'protonmail.com',
  'proton.me',
  'icloud.com',
  'aol.com',
  'zoho.com',
  'gmx.com',
  'gmx.net',
  'fastmail.com',
  'tutanota.com',
  'pm.me',
  'live.com',
  'msn.com',
  'qq.com',
  '163.com',
  '126.com',
  'rambler.ru',
  'inbox.ru',
  'list.ru',
  'bk.ru',
];

// Check if email is from a free provider
export function isFreeEmail(email: string): boolean {
  if (!email || !email.includes('@')) return true;
  // Clean email first - take only the email part (before any comma, space, etc.)
  const cleanEmail = email.split(/[,\s]/)[0].trim();
  const domain = cleanEmail.split('@')[1]?.toLowerCase();
  if (!domain) return true;
  return FREE_EMAIL_PROVIDERS.includes(domain);
}

// Extract domain from email (handles malformed emails like "user@domain.com, extra text")
export function extractDomainFromEmail(email: string): string | null {
  if (!email || !email.includes('@')) return null;
  // Clean email first - take only the email part (before any comma, space, etc.)
  const cleanEmail = email.split(/[,\s]/)[0].trim();
  const domain = cleanEmail.split('@')[1]?.toLowerCase();
  // Validate domain format (basic check)
  if (!domain || !domain.includes('.')) return null;
  return domain;
}

// Clean/validate email (handles AI-extracted emails with extra text)
export function cleanEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  // Take only the first email if multiple are present
  const firstPart = email.split(/[,\s]/)[0].trim();
  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(firstPart)) return null;
  return firstPart.toLowerCase();
}
