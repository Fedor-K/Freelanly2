/**
 * Cleanup non-remote jobs based on whitelist
 *
 * Usage:
 *   dotenv -e .env.local -- npx tsx scripts/cleanup-non-remote-jobs.ts --dry-run
 *   dotenv -e .env.local -- npx tsx scripts/cleanup-non-remote-jobs.ts
 */

import { prisma } from '../src/lib/db';

// ============================================================================
// WHITELIST - Remote-friendly профессии
// ============================================================================

const WHITELIST_KEYWORDS: string[] = [
  // Tech
  'software', 'developer', 'programmer', 'engineer', 'engineering',
  'frontend', 'backend', 'fullstack', 'full-stack', 'full stack',
  'mobile', 'ios', 'android', 'react native', 'flutter',
  'devops', 'sre', 'platform', 'cloud', 'infrastructure',
  'data scientist', 'data analyst', 'data engineer', 'machine learning', 'ml ', 'ai ',
  'qa', 'quality assurance', 'tester', 'sdet', 'automation',
  'security', 'cybersecurity', 'infosec',
  'architect', 'solutions architect', 'technical architect',
  'blockchain', 'web3', 'smart contract', 'solidity',

  // Product & Design
  'product manager', 'product owner',
  'ui designer', 'ux designer', 'product designer', 'ui/ux', 'ux/ui',
  'ux researcher', 'user researcher',
  'graphic designer',
  'brand designer',

  // Language & Localization
  'translator', 'translation',
  'interpreter', 'interpretation',
  'localization', 'localisation', 'l10n',
  'transcription', 'transcriptionist',
  'subtitl', 'caption',
  'voiceover', 'voice over', 'voice-over',
  'dubbing',
  'linguist',
  'language specialist',
  'terminolog',
  'mtpe', 'post-edit', 'post edit',
  'language lead',
  'linguistic qa',
  'transcreator', 'transcreation',

  // Content & Creative
  'writer', 'copywriter', 'technical writer', 'content writer',
  'content manager', 'content strategist',
  'editor', 'proofreader',
  'video editor', 'motion designer', 'animator', 'animation',
  'social media manager', 'social media specialist',

  // Marketing
  'marketing manager', 'marketing specialist',
  'growth manager', 'growth marketing',
  'seo specialist', 'seo manager', 'sem manager',
  'performance marketing', 'paid media',
  'email marketing',
  'content marketing',
  'community manager',
  'influencer',
  'digital marketing',

  // Sales & Business
  'sales representative', 'sales manager', 'inside sales',
  'sdr', 'bdr', 'account executive',
  'customer success',
  'account manager',
  'business development',
  'partnerships',

  // Support
  'customer support', 'customer service',
  'technical support', 'tech support',
  'help desk',
  'support specialist',

  // HR & People
  'recruiter', 'recruiting', 'talent acquisition',
  'hr manager', 'hr specialist', 'human resources',
  'people operations', 'people ops',
  'employer brand',

  // Finance & Legal
  'accountant', 'accounting',
  'financial analyst', 'finance manager',
  'controller', 'fp&a',
  'legal counsel', 'paralegal', 'lawyer', 'attorney',
  'compliance',
  'bookkeeper',

  // Operations
  'project manager', 'program manager',
  'scrum master', 'agile coach',
  'operations manager',
  'executive assistant', 'virtual assistant', 'administrative assistant',
];

// Blacklist - явно НЕ remote профессии (перевешивает whitelist)
const BLACKLIST_KEYWORDS: string[] = [
  'driver', 'driving',
  'warehouse',
  'forklift',
  'porter',
  'janitor', 'cleaner', 'cleaning',
  'security guard', 'security officer',
  'receptionist',
  'cashier',
  'barista', 'bartender',
  'chef', 'cook', 'kitchen',
  'waiter', 'waitress', 'server',
  'nurse', 'nursing', 'rn ', ' rn',
  'physician', 'doctor', 'md ',
  'dentist', 'dental',
  'pharmacist', 'pharmacy',
  'physical therapist', 'physiotherapist',
  'caregiver', 'care worker',
  'teacher', 'teaching', 'instructor', 'tutor',
  'mechanic',
  'electrician',
  'plumber',
  'carpenter',
  'welder',
  'machinist',
  'operator', 'machine operator',
  'assembler', 'assembly',
  'technician',
  'installer',
  'maintenance',
  'construction',
  'laborer', 'labourer',
  'delivery',
  'courier',
  'dispatcher',
  'retail',
  'store manager', 'store associate',
  'branch manager',
  'plant manager', 'plant supervisor',
  'factory',
  'production worker', 'production operator',
  'hvac',
  'landscap',
  'hgv', 'cdl', 'class 1', 'class 2',
  'van driver',
  'truck driver',
  'field service',
  'on-site', 'onsite',
];

function matchesWhitelist(title: string, department?: string | null): boolean {
  const searchText = `${title} ${department || ''}`.toLowerCase();

  // First check blacklist - if matches, reject
  for (const keyword of BLACKLIST_KEYWORDS) {
    if (searchText.includes(keyword.toLowerCase())) {
      return false;
    }
  }

  // Then check whitelist
  for (const keyword of WHITELIST_KEYWORDS) {
    if (searchText.includes(keyword.toLowerCase())) {
      return true;
    }
  }

  return false;
}

async function cleanupNonRemoteJobs(dryRun: boolean) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('         Cleanup Non-Remote Jobs                            ');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (dryRun) {
    console.log('🔸 DRY RUN MODE - No changes will be made\n');
  }

  // Get all jobs
  const jobs = await prisma.job.findMany({
    select: {
      id: true,
      title: true,
      source: true,
      category: { select: { slug: true } },
    },
  });

  console.log(`📊 Total jobs in database: ${jobs.length}\n`);

  const toDelete: string[] = [];

  for (const job of jobs) {
    const department = job.category?.slug || null;
    if (!matchesWhitelist(job.title, department)) {
      toDelete.push(job.id);
    }
  }

  console.log(`❌ Jobs to delete: ${toDelete.length}`);
  console.log(`✅ Jobs to keep: ${jobs.length - toDelete.length}\n`);

  if (toDelete.length === 0) {
    console.log('✅ No jobs to delete!');
    return;
  }

  if (dryRun) {
    console.log('🔸 DRY RUN - Would delete these jobs. Run without --dry-run to delete.');
    return;
  }

  // Delete in batches
  const BATCH_SIZE = 100;
  let deleted = 0;

  console.log(`🗑️  Deleting ${toDelete.length} jobs in batches of ${BATCH_SIZE}...\n`);

  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = toDelete.slice(i, i + BATCH_SIZE);

    await prisma.job.deleteMany({
      where: {
        id: { in: batch }
      }
    });

    deleted += batch.length;
    const progress = ((deleted / toDelete.length) * 100).toFixed(1);
    console.log(`   Deleted ${deleted}/${toDelete.length} (${progress}%)`);
  }

  console.log(`\n✅ Successfully deleted ${deleted} non-remote jobs!`);

  // Show final count
  const remaining = await prisma.job.count();
  console.log(`📊 Jobs remaining in database: ${remaining}`);

  // Delete orphaned companies (companies with no jobs)
  console.log('\n🔍 Finding orphaned companies (no jobs left)...');

  const orphanedCompanies = await prisma.company.findMany({
    where: {
      jobs: {
        none: {}
      }
    },
    select: {
      id: true,
      name: true,
    }
  });

  if (orphanedCompanies.length === 0) {
    console.log('✅ No orphaned companies found!');
    return;
  }

  console.log(`🗑️  Found ${orphanedCompanies.length} orphaned companies to delete:\n`);

  for (const company of orphanedCompanies.slice(0, 20)) {
    console.log(`   - ${company.name}`);
  }
  if (orphanedCompanies.length > 20) {
    console.log(`   ... and ${orphanedCompanies.length - 20} more`);
  }

  // Delete orphaned companies
  const companyIds = orphanedCompanies.map(c => c.id);

  await prisma.company.deleteMany({
    where: {
      id: { in: companyIds }
    }
  });

  console.log(`\n✅ Deleted ${orphanedCompanies.length} orphaned companies!`);

  // Final stats
  const remainingCompanies = await prisma.company.count();
  console.log(`📊 Companies remaining in database: ${remainingCompanies}`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  try {
    await cleanupNonRemoteJobs(dryRun);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
