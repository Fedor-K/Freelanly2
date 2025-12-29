/**
 * ============================================================================
 * JOB IMPORT RULE — ЕДИНСТВЕННОЕ ПРАВИЛО ФИЛЬТРАЦИИ
 * ============================================================================
 *
 * Вакансия импортируется ТОЛЬКО если title соответствует whitelist профессий.
 *
 * ПРАВИЛО:
 * 1. Blacklist (приоритет) → запрещённые слова в title → НЕ импортировать
 * 2. Whitelist → целевые профессии в title → импортировать
 * 3. Ни то, ни другое → НЕ импортировать
 *
 * ЧТО НЕ ФИЛЬТРУЕТСЯ:
 * - Тип локации (REMOTE/HYBRID/ONSITE) — все импортируются
 * - Страна
 * - Уровень (Junior/Senior)
 *
 * Фильтрация по локации происходит на ФРОНТЕНДЕ, не при импорте.
 *
 * ЕДИНСТВЕННЫЙ ИСТОЧНИК ПРАВДЫ: src/config/target-professions.ts
 * ============================================================================
 */

import { shouldImportByProfession } from '@/config/target-professions';

/**
 * Check if location string looks like a physical address
 * Used for extracting country code, NOT for filtering
 */
export function isPhysicalLocation(location: string): boolean {
  if (!location || location.trim() === '') return false;

  const loc = location.trim();
  const lowerLoc = loc.toLowerCase();

  // Skip if contains remote indicators
  if (
    lowerLoc.includes('remote') ||
    lowerLoc.includes('anywhere') ||
    lowerLoc.includes('worldwide') ||
    lowerLoc.includes('wfh') ||
    lowerLoc.includes('work from home')
  ) {
    return false;
  }

  // Common US state abbreviations pattern: "City, ST"
  const usStates =
    /,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)$/i;
  if (usStates.test(loc)) return true;

  // Known major cities
  const knownCities = [
    // US
    'new york',
    'los angeles',
    'chicago',
    'houston',
    'phoenix',
    'philadelphia',
    'san antonio',
    'san diego',
    'dallas',
    'san jose',
    'austin',
    'san francisco',
    'seattle',
    'denver',
    'boston',
    'atlanta',
    'miami',
    'portland',
    'las vegas',
    'detroit',
    'minneapolis',
    'tampa',
    'orlando',
    'charlotte',
    'pittsburgh',
    // Europe
    'london',
    'paris',
    'berlin',
    'madrid',
    'rome',
    'amsterdam',
    'barcelona',
    'munich',
    'milan',
    'vienna',
    'prague',
    'warsaw',
    'budapest',
    'dublin',
    'lisbon',
    'stockholm',
    'copenhagen',
    'oslo',
    'helsinki',
    'zurich',
    'geneva',
    'brussels',
    'vilnius',
    'kaunas',
    'riga',
    'tallinn',
    'minsk',
    'tbilisi',
    'kyiv',
    'kharkiv',
    // Asia
    'tokyo',
    'singapore',
    'hong kong',
    'shanghai',
    'beijing',
    'seoul',
    'mumbai',
    'bangalore',
    'delhi',
    'pune',
    'hyderabad',
    'chennai',
    'noida',
    'gurgaon',
    // Other
    'sydney',
    'melbourne',
    'toronto',
    'vancouver',
    'montreal',
    'dubai',
    'tel aviv',
    'cape town',
    'johannesburg',
    'sao paulo',
    'mexico city',
    'buenos aires',
  ];

  if (knownCities.includes(lowerLoc)) return true;

  // Pattern: "City, Country" or "City, State"
  const cityCountryPattern = /^[A-Za-z\s]+,\s*[A-Za-z\s]+$/;
  if (cityCountryPattern.test(loc)) return true;

  return false;
}

/**
 * Legacy function - kept for backwards compatibility
 * @deprecated Use shouldImportByProfession instead
 */
export function isNonTargetJob(title: string): boolean {
  return !shouldImportByProfession(title);
}

/**
 * Legacy function - no longer used for filtering
 * Location type is now informational only
 */
export function isNonRemoteLocationType(locationType: string | null | undefined): boolean {
  if (!locationType) return false;
  return locationType === 'ONSITE' || locationType === 'HYBRID';
}

/**
 * ============================================================================
 * shouldSkipJob — ГЛАВНАЯ ФУНКЦИЯ ФИЛЬТРАЦИИ
 * ============================================================================
 *
 * Возвращает { skip: true } если вакансию НЕ нужно импортировать.
 *
 * Проверяет ТОЛЬКО title по whitelist/blacklist профессий.
 * НЕ проверяет: locationType, location, country, level.
 *
 * @see src/config/target-professions.ts — единственный источник правды
 */
export function shouldSkipJob(params: {
  title: string;
  location?: string | null;
  locationType?: string | null;
}): { skip: boolean; reason?: string } {
  const { title } = params;

  // Единственная проверка: соответствует ли title whitelist профессий
  if (!shouldImportByProfession(title)) {
    return { skip: true, reason: 'non-target profession' };
  }

  // locationType НЕ является фильтром — все типы импортируются

  return { skip: false };
}
