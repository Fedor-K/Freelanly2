/**
 * Import Lever sources from JSON files with deduplication
 *
 * Usage:
 *   npx tsx scripts/import-lever-sources.ts file1.json file2.json ...
 *   npx tsx scripts/import-lever-sources.ts discovered-companies.json
 *
 * JSON format: { "slugs": ["company1", "company2", ...] }
 * or array: ["company1", "company2", ...]
 */

import { prisma } from '../src/lib/db';
import * as fs from 'fs';

async function validateLeverCompany(slug: string): Promise<{ valid: boolean; jobCount?: number; error?: string }> {
  try {
    const response = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`);
    if (!response.ok) {
      return { valid: false, error: `HTTP ${response.status}` };
    }
    const jobs = await response.json();
    if (!Array.isArray(jobs)) {
      return { valid: false, error: 'Invalid response' };
    }
    // Skip companies with 0 jobs
    if (jobs.length === 0) {
      return { valid: false, error: 'No jobs' };
    }
    return { valid: true, jobCount: jobs.length };
  } catch (error) {
    return { valid: false, error: String(error) };
  }
}

function loadSlugsFromFile(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Support both formats: { slugs: [...] } and [...]
    if (Array.isArray(data)) {
      return data;
    }
    if (data.slugs && Array.isArray(data.slugs)) {
      return data.slugs;
    }

    console.log(`⚠️  Unknown format in ${filePath}`);
    return [];
  } catch (error) {
    console.log(`❌ Error reading ${filePath}: ${error}`);
    return [];
  }
}

async function main() {
  const files = process.argv.slice(2);

  if (files.length === 0) {
    console.log('Usage: npx tsx scripts/import-lever-sources.ts file1.json file2.json ...');
    process.exit(1);
  }

  console.log('🚀 Import Lever Sources');
  console.log('========================\n');

  // 1. Load all slugs from all files
  const allSlugs = new Set<string>();

  for (const file of files) {
    const slugs = loadSlugsFromFile(file);
    console.log(`📁 ${file}: ${slugs.length} companies`);
    slugs.forEach(s => allSlugs.add(s.toLowerCase().trim()));
  }

  // Filter out invalid slugs
  const slugsToProcess = Array.from(allSlugs).filter(s =>
    s.length > 0 &&
    !['careers', 'jobs', 'about', 'search', 'leverdemo-8'].includes(s)
  );

  console.log(`\n📊 Total unique: ${slugsToProcess.length} companies\n`);

  // 2. Check existing in DB
  const existing = await prisma.dataSource.findMany({
    where: {
      sourceType: 'LEVER',
      companySlug: { in: slugsToProcess },
    },
    select: { companySlug: true },
  });
  const existingSet = new Set(existing.map(e => e.companySlug));

  const newSlugs = slugsToProcess.filter(s => !existingSet.has(s));
  console.log(`✅ Already in DB: ${existingSet.size}`);
  console.log(`🆕 New to add: ${newSlugs.length}\n`);

  if (newSlugs.length === 0) {
    console.log('Nothing new to add!');
    return;
  }

  // 3. Validate and add new sources
  let added = 0;
  let failed = 0;

  for (let i = 0; i < newSlugs.length; i++) {
    const slug = newSlugs[i];
    process.stdout.write(`[${i + 1}/${newSlugs.length}] ${slug}... `);

    const validation = await validateLeverCompany(slug);

    if (!validation.valid) {
      console.log(`❌ ${validation.error}`);
      failed++;
      continue;
    }

    await prisma.dataSource.create({
      data: {
        name: slug,
        sourceType: 'LEVER',
        companySlug: slug,
        isActive: true,
      },
    });

    console.log(`✅ ${validation.jobCount} jobs`);
    added++;

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n========================');
  console.log(`✅ Added: ${added}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped (existing): ${existingSet.size}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
