/**
 * Delete orphaned companies (companies with no jobs)
 *
 * Usage:
 *   dotenv -e .env.local -- npx tsx scripts/delete-orphaned-companies.ts
 */

import { prisma } from '../src/lib/db';

async function main() {
  console.log('🔍 Finding orphaned companies (no jobs left)...\n');

  const orphaned = await prisma.company.findMany({
    where: { jobs: { none: {} } },
    select: { id: true, name: true }
  });

  console.log(`Found ${orphaned.length} orphaned companies\n`);

  if (orphaned.length === 0) {
    console.log('✅ No orphaned companies to delete!');
    await prisma.$disconnect();
    return;
  }

  for (const c of orphaned.slice(0, 30)) {
    console.log(`  - ${c.name}`);
  }
  if (orphaned.length > 30) {
    console.log(`  ... and ${orphaned.length - 30} more`);
  }

  console.log('\n🗑️  Deleting...');

  await prisma.company.deleteMany({
    where: { id: { in: orphaned.map(c => c.id) } }
  });

  console.log(`✅ Deleted ${orphaned.length} orphaned companies!`);

  const remaining = await prisma.company.count();
  console.log(`📊 Companies remaining: ${remaining}`);

  await prisma.$disconnect();
}

main().catch(console.error);
