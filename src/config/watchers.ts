/**
 * Watcher factory config (owner decision 2026-07-24): hyper-niche standalone-feeling products on
 * separate domains, one shared engine. Each watcher domain is a MARKETING FRONT — landing + live
 * niche stream; signup/billing/app stay on freelanly.com (?watcher={slug} preserves the niche).
 * Adding a watcher = one entry here + DNS + (optionally) niche queries in the n8n rotation.
 *
 * Test aliases: {slug}.freelanly.com works before/without the real domain.
 */

export type WatcherConfig = {
  slug: string;                 // internal id + subdomain alias
  hosts: string[];              // production hosts (apex + www)
  name: string;                 // brand: "ReactWatcher"
  roleShort: string;            // "React", used in copy: "React hiring posts"
  rolePlural: string;           // "React developers"
  /** Same shape the SEO-niche matcher uses: match on title/skills, case-insensitive. */
  titleRe: RegExp;
  skillHints: string[];         // shown as chips + used as secondary match on skills
  heroTagline: string;          // one-liner under the H1
};

export const WATCHERS: WatcherConfig[] = [
  {
    slug: 'react',
    hosts: ['reactwatcher.net', 'www.reactwatcher.net'],
    name: 'ReactWatcher',
    roleShort: 'React',
    rolePlural: 'React & frontend developers',
    titleRe: /react|front.?end|frontend|next\.?js|vue|angular/i,
    skillHints: ['React', 'TypeScript', 'Next.js', 'Frontend'],
    heroTagline: 'Fresh remote React & frontend roles, caught in LinkedIn hiring posts hours before they reach the job boards — with your application already drafted.',
  },
  {
    slug: 'qa',
    hosts: ['qawatcher.net', 'www.qawatcher.net'],
    name: 'QAWatcher',
    roleShort: 'QA',
    rolePlural: 'QA & automation engineers',
    titleRe: /\bqa\b|quality assurance|test(er|ing)?\b|sdet|automation engineer|playwright|cypress/i,
    skillHints: ['Automation', 'Playwright', 'Cypress', 'SDET'],
    heroTagline: 'Fresh remote QA & test-automation roles, caught in LinkedIn hiring posts hours before they reach the job boards — with your application already drafted.',
  },
  {
    slug: 'python',
    hosts: ['pythonwatcher.net', 'www.pythonwatcher.net'],
    name: 'PythonWatcher',
    roleShort: 'Python',
    rolePlural: 'Python developers',
    titleRe: /python|django|fastapi|flask/i,
    skillHints: ['Python', 'Django', 'FastAPI', 'Backend'],
    heroTagline: 'Fresh remote Python roles, caught in LinkedIn hiring posts hours before they reach the job boards — with your application already drafted.',
  },
];

const byHost = new Map<string, WatcherConfig>();
for (const w of WATCHERS) {
  for (const h of w.hosts) byHost.set(h, w);
  byHost.set(`${w.slug}.freelanly.com`, w); // test alias
}

export function watcherForHost(host: string | null | undefined): WatcherConfig | null {
  if (!host) return null;
  return byHost.get(host.toLowerCase().split(':')[0]) ?? null;
}

export function watcherBySlug(slug: string): WatcherConfig | null {
  return WATCHERS.find((w) => w.slug === slug) ?? null;
}
