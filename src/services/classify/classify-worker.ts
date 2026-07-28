// Background role-family classifier — runs on the Hetzner worker (cron), NEVER on Vercel.
// Fills Opportunity.roleFamily + User.roleFamily (one of the 21 category slugs) via the LOCAL
// qwen2.5:3b chat model, so the discovery feed can gate by profession (a translator stops seeing
// dev roles). Mirrors the ensureEmbedSchema raw-DDL + fail-soft pattern in embed-worker.ts.
// roleFamily is OUT of the worker prisma schema — read/written only via $queryRawUnsafe.
// OOM-safe: OLLAMA_MAX_LOADED_MODELS=1 makes qwen EVICT the embedding model rather than coexist
// (box has no swap + runs Postal).
import { prisma } from '@/lib/db';

const QWEN_URL = process.env.QWEN_BASE_URL || 'http://127.0.0.1:11434';
const QWEN_MODEL = process.env.QWEN_MODEL || 'qwen2.5:3b';
const KEEP_ALIVE = process.env.QWEN_KEEP_ALIVE || '20s';
const BATCH = Number(process.env.CLASSIFY_BATCH || 40);
const OPP_WINDOW_DAYS = Number(process.env.CLASSIFY_OPP_WINDOW_DAYS || 14);
const USER_WINDOW_DAYS = Number(process.env.CLASSIFY_USER_WINDOW_DAYS || 45);

export const ROLE_FAMILIES = [
  'engineering', 'design', 'data', 'devops', 'qa', 'security', 'product', 'marketing', 'sales',
  'finance', 'hr', 'operations', 'legal', 'project-management', 'writing', 'translation', 'creative',
  'support', 'education', 'research', 'consulting',
];
const VALID = new Set(ROLE_FAMILIES);

const PROMPT = `Classify this job into ONE category. Return ONLY the category slug, nothing else.

Categories (use exact slug):
- engineering: Software engineers, developers, programmers
- design: UI/UX designers, graphic designers, product designers
- data: Data scientists, analysts, ML engineers, BI analysts
- devops: DevOps, SRE, infrastructure, cloud engineers
- qa: QA engineers, testers, quality assurance, SDET
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
- consulting: Consultants, advisors, strategists

Match based on job title and skills. Choose the MOST specific category that fits.`;

// Keyword fallback (ported from src/lib/ai.ts localClassifyJob) — used only when qwen returns a
// non-slug, so a classified row always gets a valid value (a qwen OUTAGE instead breaks the loop and
// leaves the row NULL → the feed shows it unfiltered / retries next tick).
function keywordFallback(title: string): string {
  const t = (title || '').toLowerCase();
  if (t.includes('research')) return 'research';
  if (t.includes('analyst') || t.includes('data') || t.includes('bi ')) return 'data';
  if (t.includes('product manager') || t.includes('product owner')) return 'product';
  if (t.includes('qa') || t.includes('quality') || t.includes('test') || t.includes('sdet')) return 'qa';
  if (t.includes('support') || t.includes('customer success')) return 'support';
  if (t.includes('marketing') || t.includes('growth')) return 'marketing';
  if (t.includes('sales')) return 'sales';
  if (t.includes('design') || t.includes('ux') || t.includes('ui')) return 'design';
  if (t.includes('writer') || t.includes('content') || t.includes('copy')) return 'writing';
  if (t.includes('translat') || t.includes('locali') || t.includes('linguist') || t.includes('interpret')) return 'translation';
  if (t.includes('devops') || t.includes('sre') || t.includes('cloud') || t.includes('infra')) return 'devops';
  if (t.includes('security') || t.includes('infosec')) return 'security';
  if (t.includes('project manager') || t.includes('scrum') || t.includes('program manager')) return 'project-management';
  if (t.includes('hr') || t.includes('recruit') || t.includes('people')) return 'hr';
  if (t.includes('finance') || t.includes('account') || t.includes('payroll')) return 'finance';
  if (t.includes('legal') || t.includes('compliance')) return 'legal';
  if (t.includes('operations') || t.includes('admin')) return 'operations';
  if (t.includes('engineer') || t.includes('develop') || t.includes('program')) return 'engineering';
  return 'support';
}

async function classifyOne(title: string, skills: string[]): Promise<string> {
  const job = `Title: ${title || 'unknown'} | Skills: ${(skills || []).join(', ') || 'none'}`;
  const res = await fetch(`${QWEN_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: QWEN_MODEL,
      prompt: `${PROMPT}\n\nJob:\n${job}\n\nslug:`,
      stream: false,
      keep_alive: KEEP_ALIVE,
      options: { temperature: 0, num_predict: 8 },
    }),
  });
  if (!res.ok) throw new Error(`qwen ${res.status}`);
  const data = (await res.json()) as { response?: string };
  const slug = (data.response || '').trim().toLowerCase().replace(/[^a-z-]/g, '');
  return VALID.has(slug) ? slug : keywordFallback(title);
}

let schemaReady = false;
export async function ensureClassifySchema(): Promise<void> {
  if (schemaReady) return;
  for (const t of ['Opportunity', 'User']) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "roleFamily" text`);
  }
  schemaReady = true;
}

export async function classifyOpportunities(limit = BATCH): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ id: string; title: string; skills: string[] }[]>(
    `SELECT id, title, skills FROM "Opportunity"
     WHERE "roleFamily" IS NULL AND "isActive" = true AND "createdAt" >= now() - ($1 || ' days')::interval
     ORDER BY "createdAt" DESC LIMIT $2`, String(OPP_WINDOW_DAYS), limit);
  let done = 0;
  for (const r of rows) {
    let fam: string;
    try { fam = await classifyOne(r.title, r.skills); }
    catch (e) { console.error('[classify] opp batch failed (qwen down?) — leaving NULL:', (e as Error)?.message); break; }
    await prisma.$executeRawUnsafe(`UPDATE "Opportunity" SET "roleFamily" = $1 WHERE id = $2`, fam, r.id);
    done++;
  }
  return done;
}

export async function classifyUsers(limit = BATCH): Promise<number> {
  // Only users with a real current_title — no title => can't classify => leave NULL (feed stays
  // unfiltered for them, fail-open) rather than mis-tag them and over-filter their feed.
  const rows = await prisma.$queryRawUnsafe<{ id: string; parsedProfile: Record<string, unknown> }[]>(
    `SELECT id, "parsedProfile" FROM "User"
     WHERE "roleFamily" IS NULL AND "parsedProfile" IS NOT NULL
       AND coalesce("parsedProfile"->>'current_title','') <> ''
       AND "createdAt" >= now() - ($1 || ' days')::interval
     ORDER BY "createdAt" DESC LIMIT $2`, String(USER_WINDOW_DAYS), limit);
  let done = 0;
  for (const r of rows) {
    const p = (r.parsedProfile || {}) as Record<string, unknown>;
    const title = String(p.current_title || p.field || '');
    const skills = Array.isArray(p.skills) ? (p.skills as string[]) : [];
    let fam: string;
    try { fam = await classifyOne(title, skills); }
    catch (e) { console.error('[classify] user batch failed (qwen down?) — leaving NULL:', (e as Error)?.message); break; }
    await prisma.$executeRawUnsafe(`UPDATE "User" SET "roleFamily" = $1 WHERE id = $2`, fam, r.id);
    done++;
  }
  return done;
}

export async function fillMissingRoleFamily(): Promise<{ opps: number; users: number }> {
  const opps = await classifyOpportunities();
  const users = await classifyUsers();
  return { opps, users };
}
