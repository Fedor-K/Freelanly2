export const siteConfig = {
  name: 'Freelanly',
  description: 'Find remote jobs from LinkedIn posts and top companies. Apply directly via email. 1000+ remote positions updated daily.',
  url: 'https://freelanly.com',
  ogImage: 'https://freelanly.com/og.png',
  links: {
    twitter: 'https://twitter.com/freelanly',
    github: 'https://github.com/freelanly',
  },
  creator: 'Freelanly',
  keywords: [
    'remote jobs',
    'work from home',
    'remote work',
    'linkedin jobs',
    'developer jobs',
    'tech jobs',
    'remote developer jobs',
    'work from home jobs',
    'remote software engineer',
    'remote react developer',
    'remote python developer',
    'freelance jobs',
  ],
};

// Locations for programmatic SEO pages
export const locations = [
  { slug: 'usa', name: 'USA', country: 'US' },
  { slug: 'europe', name: 'Europe', country: null },
  { slug: 'uk', name: 'UK', country: 'GB' },
  { slug: 'germany', name: 'Germany', country: 'DE' },
  { slug: 'canada', name: 'Canada', country: 'CA' },
  { slug: 'australia', name: 'Australia', country: 'AU' },
  { slug: 'worldwide', name: 'Worldwide', country: null },
] as const;

export const categories = [
  { slug: 'engineering', name: 'Engineering', icon: '💻' },
  { slug: 'design', name: 'Design', icon: '🎨' },
  { slug: 'product', name: 'Product', icon: '📦' },
  { slug: 'marketing', name: 'Marketing', icon: '📣' },
  { slug: 'sales', name: 'Sales', icon: '💼' },
  { slug: 'data', name: 'Data', icon: '📊' },
  { slug: 'devops', name: 'DevOps', icon: '🔧' },
  { slug: 'support', name: 'Support', icon: '🎧' },
  { slug: 'hr', name: 'HR', icon: '👥' },
  { slug: 'finance', name: 'Finance', icon: '💰' },
] as const;

export const levels = [
  { value: 'INTERN', label: 'Intern' },
  { value: 'ENTRY', label: 'Entry Level' },
  { value: 'JUNIOR', label: 'Junior' },
  { value: 'MID', label: 'Mid Level' },
  { value: 'SENIOR', label: 'Senior' },
  { value: 'LEAD', label: 'Lead' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'DIRECTOR', label: 'Director' },
  { value: 'EXECUTIVE', label: 'Executive' },
] as const;

export const jobTypes = [
  { value: 'FULL_TIME', label: 'Full-time' },
  { value: 'PART_TIME', label: 'Part-time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'FREELANCE', label: 'Freelance' },
  { value: 'INTERNSHIP', label: 'Internship' },
] as const;

export const locationTypes = [
  { value: 'REMOTE', label: 'Remote (Worldwide)' },
  { value: 'REMOTE_US', label: 'Remote (US)' },
  { value: 'REMOTE_EU', label: 'Remote (Europe)' },
  { value: 'HYBRID', label: 'Hybrid' },
  { value: 'ONSITE', label: 'On-site' },
] as const;
