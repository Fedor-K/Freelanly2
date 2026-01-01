/**
 * Audit all jobs for relevance using Z.ai
 * Checks if jobs match target remote professions (tech, marketing, product, etc.)
 */

import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();

const zai = new OpenAI({
  apiKey: process.env.ZAI_API_KEY || '',
  baseURL: 'https://api.z.ai/api/paas/v4',
});

const RELEVANCE_PROMPT = `You are a job classifier for a REMOTE WORK job board focused on tech and digital professions.

Determine if this job is RELEVANT for our platform. We target:
✅ RELEVANT: Software engineers, developers, designers, product managers, data scientists, DevOps, QA, marketing managers, content writers, translators, project managers, sales (B2B/SaaS), HR/recruiters, customer support (tech companies), finance (tech), legal (tech)

❌ NOT RELEVANT: Drivers, nurses, teachers (K-12), warehouse workers, retail, food service, construction, manufacturing, physical labor, medical staff, accountants (non-tech), administrative assistants, receptionists

Respond with ONLY one word:
- "RELEVANT" if the job fits our platform
- "IRRELEVANT" if it doesn't belong

Be strict - if unsure, mark as IRRELEVANT.`;

interface AuditResult {
  jobId: string;
  title: string;
  company: string;
  category: string;
  verdict: 'RELEVANT' | 'IRRELEVANT' | 'ERROR';
  reason?: string;
}

async function checkRelevance(title: string, skills: string[]): Promise<'RELEVANT' | 'IRRELEVANT'> {
  const response = await zai.chat.completions.create({
    model: 'glm-4-32b-0414-128k',
    messages: [
      { role: 'system', content: RELEVANCE_PROMPT },
      { role: 'user', content: `Job Title: ${title}\nSkills: ${skills.join(', ') || 'none'}` }
    ],
    temperature: 0,
    max_tokens: 10,
  });

  const result = response.choices[0]?.message?.content?.trim().toUpperCase() || '';
  return result.includes('IRRELEVANT') ? 'IRRELEVANT' : 'RELEVANT';
}

async function main() {
  const limit = parseInt(process.argv[2]) || 100;
  const dryRun = process.argv.includes('--dry-run');

  console.log('🔍 Auditing jobs for relevance with Z.ai\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no deletions)' : '⚠️  WILL DELETE irrelevant jobs'}`);
  console.log('='.repeat(60));

  if (!process.env.ZAI_API_KEY) {
    console.error('❌ ZAI_API_KEY not set');
    process.exit(1);
  }

  // Get jobs to audit
  const jobs = await prisma.job.findMany({
    select: {
      id: true,
      title: true,
      skills: true,
      category: { select: { slug: true } },
      company: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  console.log(`\nAuditing ${jobs.length} jobs...\n`);

  const results: AuditResult[] = [];
  const irrelevant: AuditResult[] = [];
  let processed = 0;

  for (const job of jobs) {
    processed++;
    const cleanTitle = job.title.replace(/^\[.*?\]\s*/, '').replace(/^-\s*/, '').trim();

    try {
      const verdict = await checkRelevance(cleanTitle, job.skills);

      const result: AuditResult = {
        jobId: job.id,
        title: cleanTitle,
        company: job.company.name,
        category: job.category?.slug || 'unknown',
        verdict,
      };

      results.push(result);

      if (verdict === 'IRRELEVANT') {
        irrelevant.push(result);
        console.log(`❌ [${processed}/${jobs.length}] IRRELEVANT: ${cleanTitle}`);
        console.log(`   Company: ${job.company.name} | Category: ${result.category}`);
      } else {
        if (processed % 25 === 0) {
          console.log(`✅ [${processed}/${jobs.length}] Processing...`);
        }
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 150));
    } catch (error) {
      console.error(`⚠️  Error checking: ${cleanTitle}`, error);
      results.push({
        jobId: job.id,
        title: cleanTitle,
        company: job.company.name,
        category: job.category?.slug || 'unknown',
        verdict: 'ERROR',
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 AUDIT SUMMARY\n');

  const relevant = results.filter(r => r.verdict === 'RELEVANT').length;
  const errors = results.filter(r => r.verdict === 'ERROR').length;

  console.log(`Total audited: ${results.length}`);
  console.log(`✅ Relevant: ${relevant} (${((relevant/results.length)*100).toFixed(1)}%)`);
  console.log(`❌ Irrelevant: ${irrelevant.length} (${((irrelevant.length/results.length)*100).toFixed(1)}%)`);
  console.log(`⚠️  Errors: ${errors}`);

  if (irrelevant.length > 0) {
    console.log('\n❌ IRRELEVANT JOBS:');

    // Group by category
    const byCategory = new Map<string, AuditResult[]>();
    for (const r of irrelevant) {
      const cat = r.category;
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(r);
    }

    for (const [category, jobs] of byCategory) {
      console.log(`\n  ${category}:`);
      for (const job of jobs) {
        console.log(`    - ${job.title} (${job.company})`);
      }
    }

    // Delete if not dry run
    if (!dryRun && irrelevant.length > 0) {
      console.log('\n🗑️  Deleting irrelevant jobs...');

      for (const r of irrelevant) {
        await prisma.job.delete({ where: { id: r.jobId } });
        console.log(`   Deleted: ${r.title}`);
      }

      console.log(`\n✅ Deleted ${irrelevant.length} irrelevant jobs`);
    } else if (dryRun) {
      console.log('\n💡 Run without --dry-run to delete these jobs');
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
