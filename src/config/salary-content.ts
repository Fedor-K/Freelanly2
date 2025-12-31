/**
 * SEO content for salary range pages
 * Generates unique content for each category + salary range combination
 */

import { categories } from '@/config/site';

interface SalaryContent {
  slug: string;
  getTitle: (categoryName: string) => string;
  getIntro: (categoryName: string) => string;
  expectations: string[];
  skills: string[];
  negotiationTips: string[];
}

export const salaryContent: Record<string, SalaryContent> = {
  '0-50k': {
    slug: '0-50k',
    getTitle: (cat) => `Remote ${cat} Jobs Under $50K`,
    getIntro: (cat) => `
      Looking for entry-level remote ${cat.toLowerCase()} positions? Jobs in this salary range
      (under $50,000 per year) are ideal for those starting their career, transitioning into
      ${cat.toLowerCase()}, or seeking flexible remote work with reasonable pay. These positions
      often offer excellent learning opportunities, mentorship, and room for rapid salary growth
      as you gain experience.
    `.trim(),
    expectations: [
      '1-2 years of experience typically required',
      'Strong foundational skills and eagerness to learn',
      'May include junior, associate, or entry-level titles',
      'Often includes training and mentorship programs',
      'Potential for quick advancement to higher salary bands',
    ],
    skills: [
      'Core technical skills for the role',
      'Communication and collaboration',
      'Time management for remote work',
      'Basic tooling and software proficiency',
      'Problem-solving mindset',
    ],
    negotiationTips: [
      'Highlight relevant coursework, certifications, or bootcamps',
      'Emphasize transferable skills from other industries',
      'Ask about performance review cycles and raise potential',
      'Negotiate for learning budgets or training opportunities',
      'Consider total compensation including benefits and flexibility',
    ],
  },
  '50k-100k': {
    slug: '50k-100k',
    getTitle: (cat) => `Remote ${cat} Jobs $50K-$100K`,
    getIntro: (cat) => `
      Mid-level remote ${cat.toLowerCase()} positions in the $50,000-$100,000 salary range
      represent the sweet spot for many professionals. These roles typically require 2-5 years
      of experience and offer a balance of responsibility, autonomy, and competitive compensation.
      Remote positions in this range often come from established companies with strong remote
      work cultures.
    `.trim(),
    expectations: [
      '2-5 years of relevant experience',
      'Ability to work independently with minimal supervision',
      'Track record of delivering projects successfully',
      'Strong communication skills for remote collaboration',
      'May involve mentoring junior team members',
    ],
    skills: [
      'Deep expertise in core job functions',
      'Cross-functional collaboration',
      'Project management basics',
      'Remote work best practices',
      'Industry-specific tools and technologies',
    ],
    negotiationTips: [
      'Research market rates for your specific skill set',
      'Quantify your achievements with metrics and outcomes',
      'Leverage competing offers if available',
      'Negotiate for equity or bonuses on top of base salary',
      'Consider cost-of-living adjustments for your location',
    ],
  },
  '100k-150k': {
    slug: '100k-150k',
    getTitle: (cat) => `Remote ${cat} Jobs $100K-$150K`,
    getIntro: (cat) => `
      Senior remote ${cat.toLowerCase()} positions paying $100,000-$150,000 annually are highly
      sought after. These roles typically require 5-8 years of experience and involve significant
      responsibility, technical leadership, or specialized expertise. Companies offering these
      salaries are often well-funded startups, established tech companies, or enterprises with
      mature remote work policies.
    `.trim(),
    expectations: [
      '5-8 years of progressive experience',
      'Technical or domain expertise leadership',
      'Strategic thinking and business acumen',
      'Experience leading projects or small teams',
      'Strong stakeholder management skills',
    ],
    skills: [
      'Deep technical or domain expertise',
      'Leadership and mentoring abilities',
      'Strategic planning and execution',
      'Cross-team collaboration and influence',
      'Executive communication skills',
    ],
    negotiationTips: [
      'Position yourself as a senior individual contributor or lead',
      'Highlight impact on revenue, efficiency, or team growth',
      'Negotiate for stock options or RSUs',
      'Ask for signing bonuses, especially when relocating salary bands',
      'Discuss performance bonus structures and targets',
    ],
  },
  '150k-plus': {
    slug: '150k-plus',
    getTitle: (cat) => `Remote ${cat} Jobs $150K+`,
    getIntro: (cat) => `
      Elite remote ${cat.toLowerCase()} positions paying over $150,000 annually represent the
      top tier of the market. These roles are typically staff-level, principal, director, or
      executive positions requiring 8+ years of experience and demonstrated leadership. Companies
      offering these salaries include FAANG, well-funded scale-ups, and specialized consulting
      firms that compete globally for top talent.
    `.trim(),
    expectations: [
      '8+ years of progressive experience',
      'Recognized expertise in your domain',
      'Track record of high-impact contributions',
      'Ability to influence organizational direction',
      'Executive presence and communication',
    ],
    skills: [
      'World-class expertise in specialty area',
      'Organizational leadership and influence',
      'Strategic vision and execution',
      'Talent development and team building',
      'C-suite communication and presentation',
    ],
    negotiationTips: [
      'Leverage your unique expertise and market scarcity',
      'Negotiate comprehensive packages including equity',
      'Ask for guaranteed bonuses or signing packages',
      'Discuss title and scope, not just compensation',
      'Consider long-term equity vesting and acceleration clauses',
    ],
  },
};

/**
 * Get FAQs for a salary range page
 */
export function getSalaryFAQs(
  categoryName: string,
  salarySlug: string,
  jobCount: number
): Array<{ question: string; answer: string }> {
  const rangeLabel = {
    '0-50k': 'under $50K',
    '50k-100k': '$50K-$100K',
    '100k-150k': '$100K-$150K',
    '150k-plus': 'over $150K',
  }[salarySlug] || salarySlug;

  return [
    {
      question: `How many remote ${categoryName.toLowerCase()} jobs pay ${rangeLabel}?`,
      answer: `We currently have ${jobCount} remote ${categoryName.toLowerCase()} positions in the ${rangeLabel} salary range. This number updates daily as new opportunities are posted.`,
    },
    {
      question: `What experience is needed for ${rangeLabel} ${categoryName.toLowerCase()} jobs?`,
      answer: salarySlug === '0-50k'
        ? `Entry-level positions under $50K typically require 0-2 years of experience. Focus on building foundational skills and consider internships or bootcamps to get started.`
        : salarySlug === '50k-100k'
        ? `Mid-level positions in this range usually require 2-5 years of experience. Strong project delivery track record and independent work capability are key.`
        : salarySlug === '100k-150k'
        ? `Senior positions require 5-8 years of experience with demonstrated technical leadership or specialized expertise. Mentoring and strategic thinking are valued.`
        : `Executive and staff-level positions require 8+ years with proven impact. Domain expertise, leadership experience, and organizational influence are essential.`,
    },
    {
      question: `Are ${rangeLabel} salaries negotiable for remote positions?`,
      answer: `Yes, remote salaries are negotiable. Research market rates, quantify your achievements, and don't be afraid to negotiate. Remote roles often have more flexibility in compensation since companies aren't limited by local talent pools.`,
    },
    {
      question: `Do ${rangeLabel} remote jobs include benefits?`,
      answer: `Most professional remote positions include benefits packages. Common offerings include health insurance, 401(k) matching, paid time off, home office stipends, and professional development budgets. Higher salary ranges often include equity compensation.`,
    },
  ];
}

export function getSalaryContent(slug: string): SalaryContent | undefined {
  return salaryContent[slug];
}
