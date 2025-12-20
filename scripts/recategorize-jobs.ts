import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
});

const validCategories = [
  'engineering', 'design', 'data', 'devops', 'qa', 'security',
  'product', 'marketing', 'sales', 'finance', 'hr', 'operations',
  'legal', 'project-management', 'writing', 'translation', 'creative',
  'support', 'education', 'research', 'consulting'
];

// Local classification fallback
function classifyLocally(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('research') || t.includes('researcher')) return 'research';
  if (t.includes('analyst') && !t.includes('business')) return 'data';
  if (t.includes('business analyst')) return 'data';
  if (t.includes('product manager') || t.includes('product owner')) return 'product';
  if (t.includes('qa') || t.includes('quality') || t.includes('test') || t.includes('review') || t.includes('annotation')) return 'qa';
  if (t.includes('support') || t.includes('customer success')) return 'support';
  if (t.includes('marketing') || t.includes('growth') || t.includes('seo')) return 'marketing';
  if (t.includes('sales') || t.includes('account executive') || t.includes('bdr') || t.includes('sdr')) return 'sales';
  if (t.includes('design') || t.includes('ux') || t.includes('ui')) return 'design';
  if (t.includes('writer') || t.includes('content') || t.includes('copy')) return 'writing';
  if (t.includes('translat') || t.includes('locali') || t.includes('interpreter')) return 'translation';
  if (t.includes('project manager') || t.includes('scrum') || t.includes('agile')) return 'project-management';
  if (t.includes('hr') || t.includes('recruit') || t.includes('people') || t.includes('talent')) return 'hr';
  if (t.includes('finance') || t.includes('accountant') || t.includes('payroll') || t.includes('controller')) return 'finance';
  if (t.includes('legal') || t.includes('compliance') || t.includes('counsel')) return 'legal';
  if (t.includes('operations') || t.includes('admin') || t.includes('office manager')) return 'operations';
  if (t.includes('devops') || t.includes('sre') || t.includes('infrastructure') || t.includes('platform')) return 'devops';
  if (t.includes('security') || t.includes('infosec') || t.includes('cyber')) return 'security';
  if (t.includes('data scientist') || t.includes('machine learning') || t.includes('ml ') || t.includes('ai ')) return 'data';
  if (t.includes('engineer') || t.includes('develop') || t.includes('program') || t.includes('software')) return 'engineering';
  if (t.includes('consult') || t.includes('advisor')) return 'consulting';
  if (t.includes('train') || t.includes('teach') || t.includes('instruct')) return 'education';

  return 'support'; // Safe default
}

async function classifyWithAI(title: string, skills: string[]): Promise<string> {
  try {
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `Classify this job into ONE category. Return ONLY the slug.
Categories: ${validCategories.join(', ')}

Match the most specific category. Examples:
- "Research Manager" → research
- "Business Analyst" → data
- "Image Review Project" → qa
- "Software Engineer" → engineering`
        },
        { role: 'user', content: `Title: ${title}\nSkills: ${skills.join(', ') || 'none'}` }
      ],
      temperature: 0,
      max_tokens: 50,
    });

    const category = response.choices[0]?.message?.content?.trim().toLowerCase().replace(/[^a-z-]/g, '');
    return validCategories.includes(category || '') ? category! : classifyLocally(title);
  } catch {
    return classifyLocally(title);
  }
}

async function main() {
  console.log('Re-categorizing jobs...\n');

  // Get all jobs in engineering category that might be miscategorized
  const engineeringCategory = await prisma.category.findUnique({ where: { slug: 'engineering' } });

  if (!engineeringCategory) {
    console.log('Engineering category not found. Run seed first.');
    return;
  }

  const jobs = await prisma.job.findMany({
    where: { categoryId: engineeringCategory.id },
    select: { id: true, title: true, skills: true },
  });

  console.log(`Found ${jobs.length} jobs in engineering category to check.\n`);

  let recategorized = 0;
  const categoryChanges: Record<string, number> = {};

  for (const job of jobs) {
    // First try local classification (faster)
    let newCategory = classifyLocally(job.title);

    // If still engineering, try AI for edge cases
    if (newCategory === 'engineering' && !job.title.toLowerCase().includes('engineer') && !job.title.toLowerCase().includes('develop')) {
      newCategory = await classifyWithAI(job.title, job.skills);
      await new Promise(r => setTimeout(r, 200)); // Rate limiting
    }

    if (newCategory !== 'engineering') {
      // Find or create the new category
      let category = await prisma.category.findUnique({ where: { slug: newCategory } });

      if (!category) {
        // Create missing category
        const categoryNames: Record<string, string> = {
          'research': 'Research',
          'qa': 'QA & Testing',
          'consulting': 'Consulting',
          'education': 'Education',
          'writing': 'Writing & Content',
          'translation': 'Translation',
          'creative': 'Creative & Media',
          'security': 'Security',
          'operations': 'Operations',
          'legal': 'Legal',
          'project-management': 'Project Management',
        };

        category = await prisma.category.create({
          data: {
            slug: newCategory,
            name: categoryNames[newCategory] || newCategory,
          },
        });
      }

      await prisma.job.update({
        where: { id: job.id },
        data: { categoryId: category.id },
      });

      console.log(`"${job.title}" → ${newCategory}`);
      categoryChanges[newCategory] = (categoryChanges[newCategory] || 0) + 1;
      recategorized++;
    }
  }

  console.log(`\n✅ Done! Re-categorized ${recategorized} jobs.`);

  if (Object.keys(categoryChanges).length > 0) {
    console.log('\nChanges by category:');
    for (const [cat, count] of Object.entries(categoryChanges).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${cat}: ${count} jobs`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
