/**
 * Analyze jobs against whitelist filter
 *
 * Usage:
 *   dotenv -e .env.local -- npx tsx scripts/analyze-job-whitelist.ts
 *   dotenv -e .env.local -- npx tsx scripts/analyze-job-whitelist.ts --show-removed
 *   dotenv -e .env.local -- npx tsx scripts/analyze-job-whitelist.ts --show-kept
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
  'teacher', 'teaching', 'instructor', 'tutor', // unless online
  'mechanic',
  'electrician',
  'plumber',
  'carpenter',
  'welder',
  'machinist',
  'operator', 'machine operator',
  'assembler', 'assembly',
  'technician', // often on-site (field technician, etc.)
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

interface JobForAnalysis {
  id: string;
  title: string;
  slug: string;
  source: string;
  company: { name: string };
  category: { slug: string } | null;
  createdAt: Date;
}

async function analyzeJobs(options: { showRemoved?: boolean; showKept?: boolean }) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('        Job Whitelist Analysis - Remote-Friendly Filter     ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Get all jobs
  const jobs = await prisma.job.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      source: true,
      company: { select: { name: true } },
      category: { select: { slug: true } },
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`📊 Total jobs in database: ${jobs.length}\n`);

  const kept: JobForAnalysis[] = [];
  const removed: JobForAnalysis[] = [];

  for (const job of jobs) {
    // Get department from category slug as proxy
    const department = job.category?.slug || null;

    if (matchesWhitelist(job.title, department)) {
      kept.push(job);
    } else {
      removed.push(job);
    }
  }

  // Stats by source
  const statsBySource = (list: JobForAnalysis[]) => {
    const counts: Record<string, number> = {};
    for (const job of list) {
      counts[job.source] = (counts[job.source] || 0) + 1;
    }
    return counts;
  };

  console.log('═══════════════════════════════════════════════════════════');
  console.log('                         SUMMARY                           ');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`✅ KEPT (match whitelist):    ${kept.length} jobs (${(kept.length / jobs.length * 100).toFixed(1)}%)`);
  const keptBySource = statsBySource(kept);
  for (const [source, count] of Object.entries(keptBySource)) {
    console.log(`   - ${source}: ${count}`);
  }

  console.log(`\n❌ REMOVED (no match):        ${removed.length} jobs (${(removed.length / jobs.length * 100).toFixed(1)}%)`);
  const removedBySource = statsBySource(removed);
  for (const [source, count] of Object.entries(removedBySource)) {
    console.log(`   - ${source}: ${count}`);
  }

  // Show removed jobs if requested
  if (options.showRemoved && removed.length > 0) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('                    JOBS TO BE REMOVED                      ');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Group by company for readability
    const byCompany: Record<string, JobForAnalysis[]> = {};
    for (const job of removed) {
      const company = job.company.name;
      if (!byCompany[company]) byCompany[company] = [];
      byCompany[company].push(job);
    }

    for (const [company, companyJobs] of Object.entries(byCompany).sort((a, b) => b[1].length - a[1].length)) {
      console.log(`\n📦 ${company} (${companyJobs.length} jobs):`);
      for (const job of companyJobs) {
        console.log(`   - ${job.title}`);
      }
    }
  }

  // Show kept jobs if requested
  if (options.showKept && kept.length > 0) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('                     JOBS TO BE KEPT                        ');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Group by category
    const byCategory: Record<string, JobForAnalysis[]> = {};
    for (const job of kept) {
      const cat = job.category?.slug || 'uncategorized';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(job);
    }

    for (const [category, catJobs] of Object.entries(byCategory).sort((a, b) => b[1].length - a[1].length)) {
      console.log(`\n📁 ${category} (${catJobs.length} jobs):`);
      for (const job of catJobs.slice(0, 20)) { // Show max 20 per category
        console.log(`   - ${job.title} at ${job.company.name}`);
      }
      if (catJobs.length > 20) {
        console.log(`   ... and ${catJobs.length - 20} more`);
      }
    }
  }

  // Show sample of removed jobs (first 50)
  if (!options.showRemoved && removed.length > 0) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('              SAMPLE OF JOBS TO BE REMOVED (first 50)       ');
    console.log('═══════════════════════════════════════════════════════════\n');

    for (const job of removed.slice(0, 50)) {
      console.log(`   ❌ ${job.title} at ${job.company.name} [${job.source}]`);
    }

    if (removed.length > 50) {
      console.log(`\n   ... and ${removed.length - 50} more`);
      console.log(`\n   Run with --show-removed to see all`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                      NEXT STEPS                            ');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('If the numbers look good, run the cleanup script:');
  console.log('  dotenv -e .env.local -- npx tsx scripts/cleanup-non-remote-jobs.ts');
  console.log('');
}

async function main() {
  const args = process.argv.slice(2);
  const showRemoved = args.includes('--show-removed');
  const showKept = args.includes('--show-kept');

  try {
    await analyzeJobs({ showRemoved, showKept });
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
