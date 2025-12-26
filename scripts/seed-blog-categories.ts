/**
 * Seed default blog categories
 * Run: npx tsx scripts/seed-blog-categories.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultCategories = [
  {
    slug: 'remote-job-hunting',
    name: 'Remote Job Hunting',
    description: 'Tips and strategies for finding and landing remote jobs.',
    icon: '🔍',
  },
  {
    slug: 'salary-guides',
    name: 'Salary Guides',
    description: 'Comprehensive salary guides for remote positions across industries.',
    icon: '💰',
  },
  {
    slug: 'remote-work-tips',
    name: 'Remote Work Tips',
    description: 'Best practices for working remotely and staying productive.',
    icon: '💡',
  },
  {
    slug: 'company-spotlights',
    name: 'Company Spotlights',
    description: 'In-depth looks at companies with great remote work cultures.',
    icon: '🏢',
  },
  {
    slug: 'digital-nomad',
    name: 'Digital Nomad',
    description: 'Guides for living and working as a digital nomad.',
    icon: '🌍',
  },
  {
    slug: 'industry-reports',
    name: 'Industry Reports',
    description: 'Data-driven reports on remote work trends and statistics.',
    icon: '📊',
  },
];

async function main() {
  console.log('Seeding blog categories...');

  for (const category of defaultCategories) {
    const existing = await prisma.blogCategory.findUnique({
      where: { slug: category.slug },
    });

    if (existing) {
      console.log(`  ✓ Category "${category.name}" already exists`);
    } else {
      await prisma.blogCategory.create({
        data: category,
      });
      console.log(`  + Created category "${category.name}"`);
    }
  }

  console.log('\nDone! Created blog categories.');
}

main()
  .catch((error) => {
    console.error('Error seeding categories:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
