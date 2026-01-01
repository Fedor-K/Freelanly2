/**
 * Test script: Test Z.ai for job categorization
 * Compares Z.ai results with current DB categories (set by DeepSeek previously)
 */

import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();

const zai = new OpenAI({
  apiKey: process.env.ZAI_API_KEY || '',
  baseURL: 'https://api.z.ai/api/paas/v4',
});

// Pricing per 1M tokens
const PRICING = {
  deepseek: { input: 0.28, output: 0.42 },  // For reference
  zai_glm4_32b: { input: 0.10, output: 0.10 },
};

const CATEGORY_PROMPT = `Classify this job into ONE category. Return ONLY the category slug, nothing else.

Categories (use exact slug):
- engineering: Software engineers, developers, programmers
- design: UI/UX designers, graphic designers, product designers
- data: Data scientists, analysts, ML engineers, BI analysts
- devops: DevOps, SRE, infrastructure, cloud engineers
- qa: QA engineers, testers, quality assurance
- security: Security engineers, cybersecurity, infosec
- product: Product managers, product owners
- marketing: Marketing, growth, SEO, content marketing
- sales: Sales, business development, account managers
- finance: Finance, accounting, payroll specialists
- hr: HR, recruiters, people operations
- operations: Operations, administration, office management
- legal: Legal, compliance, contracts
- project-management: Project managers, scrum masters, agile coaches
- writing: Copywriters, content writers, technical writers
- translation: Translators, interpreters, localization
- creative: Video producers, animators, photographers
- support: Customer support, customer success, tech support
- education: Trainers, teachers, instructional designers
- research: Researchers, user researchers, market researchers
- consulting: Consultants, advisors, strategists`;

interface TestResult {
  title: string;
  dbCategory: string;
  zaiCategory: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  timeMs: number;
  match: boolean;
}

async function classifyWithZai(title: string, skills: string[], model: string): Promise<{ category: string; inputTokens: number; outputTokens: number; timeMs: number; rawResponse: string }> {
  const start = Date.now();

  const response = await zai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: CATEGORY_PROMPT },
      { role: 'user', content: `Title: ${title}\nSkills: ${skills.join(', ') || 'none specified'}` }
    ],
    temperature: 0,
    max_tokens: 50,
  });

  const rawResponse = response.choices[0]?.message?.content?.trim() || '';
  const category = rawResponse.toLowerCase().replace(/[^a-z-]/g, '') || 'unknown';

  return {
    category,
    rawResponse,
    inputTokens: response.usage?.prompt_tokens || 0,
    outputTokens: response.usage?.completion_tokens || 0,
    timeMs: Date.now() - start,
  };
}

async function main() {
  console.log('🧪 Testing Z.ai GLM-4-32B for Job Categorization\n');
  console.log('Comparing against current DB categories (set by DeepSeek)\n');
  console.log('='.repeat(60));

  if (!process.env.ZAI_API_KEY) {
    console.error('❌ ZAI_API_KEY not set');
    process.exit(1);
  }

  // Get 10 jobs
  const jobs = await prisma.job.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: { category: true },
  });

  if (jobs.length === 0) {
    console.error('❌ No jobs found in database');
    process.exit(1);
  }

  console.log(`\nTesting ${jobs.length} jobs...\n`);

  const results: TestResult[] = [];
  const zaiModel = 'glm-4-32b-0414-128k'; // $0.10/$0.10 - cheapest paid

  for (const job of jobs) {
    const cleanTitle = job.title.replace(/^\[\d+\]\s*/, '').replace(/^-\s*/, '').trim();
    console.log(`📋 ${cleanTitle}`);

    try {
      const zaiResult = await classifyWithZai(cleanTitle, job.skills, zaiModel);
      const cost = (zaiResult.inputTokens / 1_000_000) * PRICING.zai_glm4_32b.input +
                   (zaiResult.outputTokens / 1_000_000) * PRICING.zai_glm4_32b.output;

      const dbCategory = job.category?.slug || 'unknown';
      const match = zaiResult.category === dbCategory;

      results.push({
        title: cleanTitle,
        dbCategory,
        zaiCategory: zaiResult.category,
        inputTokens: zaiResult.inputTokens,
        outputTokens: zaiResult.outputTokens,
        costUSD: cost,
        timeMs: zaiResult.timeMs,
        match,
      });

      console.log(`   DB:    ${dbCategory}`);
      console.log(`   Z.ai:  ${zaiResult.category} (raw: "${zaiResult.rawResponse}")`);
      console.log(`   Time:  ${zaiResult.timeMs}ms, Cost: $${cost.toFixed(6)}`);
      console.log(`   ${match ? '✅ Match' : '❌ Mismatch'}\n`);

      await new Promise(r => setTimeout(r, 1000)); // 1 sec delay to avoid rate limits
    } catch (error) {
      console.error(`   ❌ Error: ${error}\n`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY\n');

  if (results.length === 0) {
    console.log('No results to summarize');
    await prisma.$disconnect();
    return;
  }

  const matches = results.filter(r => r.match).length;
  const totalCost = results.reduce((sum, r) => sum + r.costUSD, 0);
  const avgTime = results.reduce((sum, r) => sum + r.timeMs, 0) / results.length;
  const totalInputTokens = results.reduce((sum, r) => sum + r.inputTokens, 0);
  const totalOutputTokens = results.reduce((sum, r) => sum + r.outputTokens, 0);

  console.log(`Model: ${zaiModel}`);
  console.log(`Accuracy vs DB: ${matches}/${results.length} (${((matches/results.length)*100).toFixed(0)}%)`);
  console.log(`\nTokens used:`);
  console.log(`   Input:  ${totalInputTokens}`);
  console.log(`   Output: ${totalOutputTokens}`);
  console.log(`\nZ.ai cost: $${totalCost.toFixed(6)}`);
  console.log(`Avg latency: ${avgTime.toFixed(0)}ms`);

  // Compare with DeepSeek pricing
  const deepseekCost = (totalInputTokens / 1_000_000) * PRICING.deepseek.input +
                       (totalOutputTokens / 1_000_000) * PRICING.deepseek.output;
  console.log(`\nEquivalent DeepSeek cost: $${deepseekCost.toFixed(6)}`);
  console.log(`Cost savings: ${((1 - totalCost/deepseekCost) * 100).toFixed(0)}%`);

  // Show mismatches
  const mismatches = results.filter(r => !r.match);
  if (mismatches.length > 0) {
    console.log('\n❌ Mismatches:');
    for (const m of mismatches) {
      console.log(`   "${m.title}"`);
      console.log(`      DB: ${m.dbCategory} → Z.ai: ${m.zaiCategory}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
