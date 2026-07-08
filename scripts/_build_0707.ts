import { buildAtsDayDrafts } from '@/services/sources/ats-day-drafts';
async function main() {
  console.log('[build] starting 2026-07-07 …');
  const r = await buildAtsDayDrafts({ day: '2026-07-07' });
  console.log('[build] DONE', JSON.stringify(r));
}
main().then(()=>process.exit(0)).catch(e=>{console.error('[build] ERR', e); process.exit(1)});
