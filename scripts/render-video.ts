/**
 * Video rendering script for Remotion
 * Run on VPS: npx tsx scripts/render-video.ts
 *
 * Usage:
 *   npx tsx scripts/render-video.ts JobAlert '{"jobTitle":"Senior React Developer","companyName":"Stripe"}'
 *   npx tsx scripts/render-video.ts SalaryReveal '{"categoryName":"Software Engineers","entryLevel":"$60K-$80K"}'
 */

import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import fs from 'fs';

async function main() {
  const [compositionId, propsJson] = process.argv.slice(2);

  if (!compositionId) {
    console.log('Usage: npx tsx scripts/render-video.ts <CompositionId> [props]');
    console.log('\nAvailable compositions:');
    console.log('  - JobAlert');
    console.log('  - SalaryReveal');
    console.log('  - TopJobs');
    console.log('\nExample:');
    console.log('  npx tsx scripts/render-video.ts JobAlert \'{"jobTitle":"Developer","companyName":"Acme"}\'');
    process.exit(1);
  }

  const inputProps = propsJson ? JSON.parse(propsJson) : getDefaultProps(compositionId);

  console.log(`\n🎬 Rendering ${compositionId}...`);
  console.log('Props:', JSON.stringify(inputProps, null, 2));

  const startTime = Date.now();

  // Bundle the project
  console.log('\n📦 Bundling...');
  const bundleLocation = await bundle({
    entryPoint: path.join(process.cwd(), 'src/remotion/index.ts'),
    webpackOverride: (config) => config,
  });

  // Select composition
  console.log('🎯 Selecting composition...');
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: compositionId,
    inputProps,
  });

  // Output path
  const outputDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `${compositionId}-${Date.now()}.mp4`);

  // Render
  console.log('🎥 Rendering video...');
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n✅ Done in ${elapsed}s`);
  console.log(`📁 Output: ${outputPath}`);
}

function getDefaultProps(compositionId: string): Record<string, unknown> {
  switch (compositionId) {
    case 'JobAlert':
      return {
        jobTitle: 'Senior React Developer',
        companyName: 'Acme Inc',
        companyLogo: null,
        salary: '$120K - $180K/year',
        location: 'Remote - USA',
        jobType: 'Full-time',
      };
    case 'SalaryReveal':
      return {
        categoryName: 'Software Engineers',
        entryLevel: '$60K - $80K',
        midLevel: '$90K - $130K',
        seniorLevel: '$140K - $200K',
      };
    case 'TopJobs':
      return {
        jobs: [
          { title: 'Staff Engineer', company: 'Stripe', salary: '$250K' },
          { title: 'Engineering Manager', company: 'Notion', salary: '$220K' },
          { title: 'Principal Developer', company: 'Figma', salary: '$200K' },
        ],
      };
    default:
      return {};
  }
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
