/**
 * Compare two databases and show differences
 * Run: npx tsx scripts/compare-databases.ts
 */

import { PrismaClient } from '@prisma/client';

const OLD_DB_URL = 'postgresql://neondb_owner:npg_4yrSlM1RVCEi@ep-falling-mouse-a48a4w6b-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';
const NEW_DB_URL = 'postgresql://neondb_owner:npg_P4kEWCj6RdIa@ep-noisy-tooth-ahj8gt6v-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function getTableInfo(prisma: PrismaClient, dbName: string) {
  console.log(`\n📊 Analyzing ${dbName}...\n`);

  // Get all tables
  const tables = await prisma.$queryRaw<{table_name: string}[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;

  console.log(`Tables (${tables.length}):`);

  const tableStats: Record<string, number> = {};

  for (const { table_name } of tables) {
    try {
      const count = await prisma.$queryRawUnsafe<{count: bigint}[]>(
        `SELECT COUNT(*) as count FROM "${table_name}"`
      );
      const rowCount = Number(count[0]?.count || 0);
      tableStats[table_name] = rowCount;
      console.log(`  - ${table_name}: ${rowCount} rows`);
    } catch (e) {
      console.log(`  - ${table_name}: (error reading)`);
    }
  }

  return { tables: tables.map(t => t.table_name), stats: tableStats };
}

async function getColumnInfo(prisma: PrismaClient, tableName: string) {
  const columns = await prisma.$queryRaw<{column_name: string, data_type: string, is_nullable: string}[]>`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${tableName}
    ORDER BY ordinal_position
  `;
  return columns;
}

async function main() {
  console.log('🔄 Database Comparison Tool\n');
  console.log('OLD DB:', OLD_DB_URL.replace(/:[^:@]+@/, ':***@'));
  console.log('NEW DB:', NEW_DB_URL.replace(/:[^:@]+@/, ':***@'));

  // Connect to old DB
  const oldPrisma = new PrismaClient({
    datasources: { db: { url: OLD_DB_URL } }
  });

  // Connect to new DB
  const newPrisma = new PrismaClient({
    datasources: { db: { url: NEW_DB_URL } }
  });

  try {
    // Get info from both DBs
    const oldInfo = await getTableInfo(oldPrisma, 'OLD DB (freelanly.com)');
    const newInfo = await getTableInfo(newPrisma, 'NEW DB (VPS)');

    // Compare tables
    console.log('\n' + '='.repeat(60));
    console.log('📋 COMPARISON SUMMARY');
    console.log('='.repeat(60));

    const allTables = new Set([...oldInfo.tables, ...newInfo.tables]);

    const onlyInOld: string[] = [];
    const onlyInNew: string[] = [];
    const inBoth: string[] = [];

    for (const table of allTables) {
      const inOld = oldInfo.tables.includes(table);
      const inNew = newInfo.tables.includes(table);

      if (inOld && !inNew) onlyInOld.push(table);
      else if (!inOld && inNew) onlyInNew.push(table);
      else inBoth.push(table);
    }

    if (onlyInOld.length > 0) {
      console.log('\n⚠️  Tables ONLY in OLD DB (need to migrate):');
      for (const t of onlyInOld) {
        console.log(`   - ${t} (${oldInfo.stats[t]} rows)`);
      }
    }

    if (onlyInNew.length > 0) {
      console.log('\n✨ Tables ONLY in NEW DB (new features):');
      for (const t of onlyInNew) {
        console.log(`   - ${t}`);
      }
    }

    if (inBoth.length > 0) {
      console.log('\n📊 Tables in BOTH (compare row counts):');
      for (const t of inBoth) {
        const oldCount = oldInfo.stats[t] || 0;
        const newCount = newInfo.stats[t] || 0;
        const status = oldCount > newCount ? '← MIGRATE' : (oldCount === newCount ? '✓' : '');
        console.log(`   - ${t}: OLD=${oldCount}, NEW=${newCount} ${status}`);
      }
    }

    // Key tables to migrate
    console.log('\n' + '='.repeat(60));
    console.log('🎯 KEY DATA TO MIGRATE FROM OLD TO NEW:');
    console.log('='.repeat(60));

    const keyTables = ['User', 'Company', 'Job', 'Category', 'JobAlert', 'Application'];
    for (const table of keyTables) {
      const oldCount = oldInfo.stats[table] || 0;
      const newCount = newInfo.stats[table] || 0;
      if (oldCount > 0) {
        console.log(`   ${table}: ${oldCount} records to migrate`);
      }
    }

    // Compare columns for key tables
    console.log('\n' + '='.repeat(60));
    console.log('🔍 COLUMN COMPARISON FOR KEY TABLES:');
    console.log('='.repeat(60));

    for (const table of ['User', 'Job', 'Company']) {
      if (oldInfo.tables.includes(table) && newInfo.tables.includes(table)) {
        console.log(`\n${table}:`);
        const oldCols = await getColumnInfo(oldPrisma, table);
        const newCols = await getColumnInfo(newPrisma, table);

        const oldColNames = new Set(oldCols.map(c => c.column_name));
        const newColNames = new Set(newCols.map(c => c.column_name));

        const onlyOld = [...oldColNames].filter(c => !newColNames.has(c));
        const onlyNew = [...newColNames].filter(c => !oldColNames.has(c));

        if (onlyOld.length > 0) {
          console.log(`   Columns only in OLD: ${onlyOld.join(', ')}`);
        }
        if (onlyNew.length > 0) {
          console.log(`   Columns only in NEW: ${onlyNew.join(', ')}`);
        }
        if (onlyOld.length === 0 && onlyNew.length === 0) {
          console.log(`   ✓ Same columns`);
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await oldPrisma.$disconnect();
    await newPrisma.$disconnect();
  }
}

main();
