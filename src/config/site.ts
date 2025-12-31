export const siteConfig = {
  name: 'Freelanly',
  description: 'Find remote jobs from LinkedIn posts and top companies. Apply directly via email. 1000+ positions in engineering, design, marketing. Updated daily.',
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

// Main categories shown in navigation
export const mainCategories = [
  { slug: 'engineering', name: 'Engineering', icon: '💻' },
  { slug: 'design', name: 'Design', icon: '🎨' },
  { slug: 'product', name: 'Product', icon: '📦' },
  { slug: 'marketing', name: 'Marketing', icon: '📣' },
  { slug: 'sales', name: 'Sales', icon: '💼' },
] as const;

// All categories for the platform with SOC codes for Google Jobs
export const categories = [
  // Tech
  { slug: 'engineering', name: 'Engineering', icon: '💻', group: 'tech', socCode: '15-1252.00', socTitle: 'Software Developers' },
  { slug: 'design', name: 'Design', icon: '🎨', group: 'tech', socCode: '27-1024.00', socTitle: 'Graphic Designers' },
  { slug: 'data', name: 'Data & Analytics', icon: '📊', group: 'tech', socCode: '15-2051.00', socTitle: 'Data Scientists' },
  { slug: 'devops', name: 'DevOps', icon: '🔧', group: 'tech', socCode: '15-1244.00', socTitle: 'Network and Computer Systems Administrators' },
  { slug: 'qa', name: 'QA & Testing', icon: '🧪', group: 'tech', socCode: '15-1253.00', socTitle: 'Software Quality Assurance Analysts and Testers' },
  { slug: 'security', name: 'Security', icon: '🔒', group: 'tech', socCode: '15-1212.00', socTitle: 'Information Security Analysts' },
  // Business
  { slug: 'product', name: 'Product', icon: '📦', group: 'business', socCode: '11-2021.00', socTitle: 'Marketing Managers' },
  { slug: 'marketing', name: 'Marketing', icon: '📣', group: 'business', socCode: '11-2021.00', socTitle: 'Marketing Managers' },
  { slug: 'sales', name: 'Sales', icon: '💼', group: 'business', socCode: '41-3091.00', socTitle: 'Sales Representatives' },
  { slug: 'finance', name: 'Finance', icon: '💰', group: 'business', socCode: '13-2011.00', socTitle: 'Accountants and Auditors' },
  { slug: 'hr', name: 'HR & Recruiting', icon: '👥', group: 'business', socCode: '13-1071.00', socTitle: 'Human Resources Specialists' },
  { slug: 'operations', name: 'Operations', icon: '⚙️', group: 'business', socCode: '11-1021.00', socTitle: 'General and Operations Managers' },
  { slug: 'legal', name: 'Legal', icon: '⚖️', group: 'business', socCode: '23-1011.00', socTitle: 'Lawyers' },
  { slug: 'project-management', name: 'Project Management', icon: '📋', group: 'business', socCode: '11-9199.00', socTitle: 'Project Management Specialists' },
  // Content & Creative
  { slug: 'writing', name: 'Writing & Content', icon: '✍️', group: 'content', socCode: '27-3043.00', socTitle: 'Writers and Authors' },
  { slug: 'translation', name: 'Translation', icon: '🌐', group: 'content', socCode: '27-3091.00', socTitle: 'Interpreters and Translators' },
  { slug: 'creative', name: 'Creative & Media', icon: '🎬', group: 'content', socCode: '27-1014.00', socTitle: 'Multimedia Artists and Animators' },
  // Other
  { slug: 'support', name: 'Customer Support', icon: '🎧', group: 'other', socCode: '43-4051.00', socTitle: 'Customer Service Representatives' },
  { slug: 'education', name: 'Education', icon: '📚', group: 'other', socCode: '25-1011.00', socTitle: 'Business Teachers, Postsecondary' },
  { slug: 'research', name: 'Research', icon: '🔬', group: 'other', socCode: '19-1042.00', socTitle: 'Medical Scientists' },
  { slug: 'consulting', name: 'Consulting', icon: '💡', group: 'other', socCode: '13-1111.00', socTitle: 'Management Analysts' },
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

// Countries for /country/[country] SEO pages
export const countries = [
  { slug: 'united-states', name: 'United States', code: 'US', flag: '🇺🇸' },
  { slug: 'united-kingdom', name: 'United Kingdom', code: 'GB', flag: '🇬🇧' },
  { slug: 'canada', name: 'Canada', code: 'CA', flag: '🇨🇦' },
  { slug: 'germany', name: 'Germany', code: 'DE', flag: '🇩🇪' },
  { slug: 'netherlands', name: 'Netherlands', code: 'NL', flag: '🇳🇱' },
  { slug: 'france', name: 'France', code: 'FR', flag: '🇫🇷' },
  { slug: 'australia', name: 'Australia', code: 'AU', flag: '🇦🇺' },
  { slug: 'spain', name: 'Spain', code: 'ES', flag: '🇪🇸' },
  { slug: 'italy', name: 'Italy', code: 'IT', flag: '🇮🇹' },
  { slug: 'poland', name: 'Poland', code: 'PL', flag: '🇵🇱' },
  { slug: 'portugal', name: 'Portugal', code: 'PT', flag: '🇵🇹' },
  { slug: 'ireland', name: 'Ireland', code: 'IE', flag: '🇮🇪' },
  { slug: 'sweden', name: 'Sweden', code: 'SE', flag: '🇸🇪' },
  { slug: 'switzerland', name: 'Switzerland', code: 'CH', flag: '🇨🇭' },
  { slug: 'india', name: 'India', code: 'IN', flag: '🇮🇳' },
  { slug: 'brazil', name: 'Brazil', code: 'BR', flag: '🇧🇷' },
  { slug: 'mexico', name: 'Mexico', code: 'MX', flag: '🇲🇽' },
  { slug: 'worldwide', name: 'Worldwide', code: null, flag: '🌍' },
] as const;

// Tech stacks for filtering
export const techStacks = [
  { slug: 'react', name: 'React', keywords: ['React', 'React.js', 'ReactJS'] },
  { slug: 'typescript', name: 'TypeScript', keywords: ['TypeScript', 'TS'] },
  { slug: 'python', name: 'Python', keywords: ['Python', 'Python3'] },
  { slug: 'javascript', name: 'JavaScript', keywords: ['JavaScript', 'JS', 'ES6'] },
  { slug: 'nodejs', name: 'Node.js', keywords: ['Node.js', 'NodeJS', 'Node'] },
  { slug: 'java', name: 'Java', keywords: ['Java'] },
  { slug: 'golang', name: 'Golang', keywords: ['Go', 'Golang'] },
  { slug: 'rust', name: 'Rust', keywords: ['Rust'] },
  { slug: 'aws', name: 'AWS', keywords: ['AWS', 'Amazon Web Services'] },
  { slug: 'kubernetes', name: 'Kubernetes', keywords: ['Kubernetes', 'K8s'] },
  { slug: 'docker', name: 'Docker', keywords: ['Docker'] },
  { slug: 'nextjs', name: 'Next.js', keywords: ['Next.js', 'NextJS'] },
  { slug: 'vue', name: 'Vue.js', keywords: ['Vue', 'Vue.js', 'VueJS'] },
  { slug: 'angular', name: 'Angular', keywords: ['Angular'] },
  { slug: 'postgresql', name: 'PostgreSQL', keywords: ['PostgreSQL', 'Postgres'] },
  { slug: 'mongodb', name: 'MongoDB', keywords: ['MongoDB', 'Mongo'] },
  { slug: 'graphql', name: 'GraphQL', keywords: ['GraphQL'] },
  { slug: 'terraform', name: 'Terraform', keywords: ['Terraform'] },
  { slug: 'ruby', name: 'Ruby', keywords: ['Ruby', 'Ruby on Rails', 'Rails'] },
  { slug: 'php', name: 'PHP', keywords: ['PHP', 'Laravel'] },
  { slug: 'csharp', name: 'C#', keywords: ['C#', '.NET', 'dotnet'] },
  { slug: 'swift', name: 'Swift', keywords: ['Swift', 'iOS'] },
  { slug: 'kotlin', name: 'Kotlin', keywords: ['Kotlin', 'Android'] },
  { slug: 'flutter', name: 'Flutter', keywords: ['Flutter', 'Dart'] },
] as const;

// Company sizes
export const companySizes = [
  { value: 'STARTUP', label: '1-10 employees', range: '1-10' },
  { value: 'SMALL', label: '11-50 employees', range: '11-50' },
  { value: 'MEDIUM', label: '51-200 employees', range: '51-200' },
  { value: 'LARGE', label: '201-1000 employees', range: '201-1000' },
  { value: 'ENTERPRISE', label: '1000+ employees', range: '1000+' },
] as const;

// Salary ranges for filtering
export const salaryRanges = [
  { value: '0-50000', label: 'Up to $50K', min: 0, max: 50000 },
  { value: '50000-80000', label: '$50K - $80K', min: 50000, max: 80000 },
  { value: '80000-100000', label: '$80K - $100K', min: 80000, max: 100000 },
  { value: '100000-130000', label: '$100K - $130K', min: 100000, max: 130000 },
  { value: '130000-160000', label: '$130K - $160K', min: 130000, max: 160000 },
  { value: '160000-200000', label: '$160K - $200K', min: 160000, max: 200000 },
  { value: '200000+', label: '$200K+', min: 200000, max: null },
] as const;

// Job roles for /country/[country]/jobs/[role] pages
export const jobRoles = [
  { slug: 'software-engineer', name: 'Software Engineer', keywords: ['Software Engineer', 'Developer'] },
  { slug: 'frontend-developer', name: 'Frontend Developer', keywords: ['Frontend', 'Front-end', 'React', 'Vue'] },
  { slug: 'backend-developer', name: 'Backend Developer', keywords: ['Backend', 'Back-end', 'API'] },
  { slug: 'fullstack-developer', name: 'Full Stack Developer', keywords: ['Full Stack', 'Fullstack'] },
  { slug: 'data-engineer', name: 'Data Engineer', keywords: ['Data Engineer'] },
  { slug: 'data-scientist', name: 'Data Scientist', keywords: ['Data Scientist', 'Data Science'] },
  { slug: 'devops-engineer', name: 'DevOps Engineer', keywords: ['DevOps', 'SRE'] },
  { slug: 'product-manager', name: 'Product Manager', keywords: ['Product Manager', 'PM'] },
  { slug: 'product-designer', name: 'Product Designer', keywords: ['Product Designer', 'UX Designer'] },
  { slug: 'ui-ux-designer', name: 'UI/UX Designer', keywords: ['UI', 'UX', 'UI/UX'] },
  { slug: 'mobile-developer', name: 'Mobile Developer', keywords: ['Mobile', 'iOS', 'Android'] },
  { slug: 'qa-engineer', name: 'QA Engineer', keywords: ['QA', 'Quality Assurance', 'Test'] },
  { slug: 'security-engineer', name: 'Security Engineer', keywords: ['Security', 'InfoSec'] },
  { slug: 'machine-learning-engineer', name: 'ML Engineer', keywords: ['Machine Learning', 'ML', 'AI'] },
] as const;

// Languages for translation job SEO pages
export const languages = [
  { code: 'EN', name: 'English', slug: 'english' },
  { code: 'ES', name: 'Spanish', slug: 'spanish' },
  { code: 'FR', name: 'French', slug: 'french' },
  { code: 'DE', name: 'German', slug: 'german' },
  { code: 'IT', name: 'Italian', slug: 'italian' },
  { code: 'PT', name: 'Portuguese', slug: 'portuguese' },
  { code: 'RU', name: 'Russian', slug: 'russian' },
  { code: 'ZH', name: 'Chinese', slug: 'chinese' },
  { code: 'JA', name: 'Japanese', slug: 'japanese' },
  { code: 'KO', name: 'Korean', slug: 'korean' },
  { code: 'AR', name: 'Arabic', slug: 'arabic' },
  { code: 'NL', name: 'Dutch', slug: 'dutch' },
  { code: 'PL', name: 'Polish', slug: 'polish' },
  { code: 'TR', name: 'Turkish', slug: 'turkish' },
  { code: 'UK', name: 'Ukrainian', slug: 'ukrainian' },
  { code: 'VI', name: 'Vietnamese', slug: 'vietnamese' },
  { code: 'TH', name: 'Thai', slug: 'thai' },
  { code: 'HI', name: 'Hindi', slug: 'hindi' },
  { code: 'HE', name: 'Hebrew', slug: 'hebrew' },
  { code: 'SV', name: 'Swedish', slug: 'swedish' },
] as const;

// Popular translation language pairs for SEO pages
export const languagePairs = [
  { source: 'english', target: 'spanish', slug: 'english-spanish' },
  { source: 'english', target: 'french', slug: 'english-french' },
  { source: 'english', target: 'german', slug: 'english-german' },
  { source: 'english', target: 'russian', slug: 'english-russian' },
  { source: 'english', target: 'chinese', slug: 'english-chinese' },
  { source: 'english', target: 'japanese', slug: 'english-japanese' },
  { source: 'english', target: 'korean', slug: 'english-korean' },
  { source: 'english', target: 'portuguese', slug: 'english-portuguese' },
  { source: 'english', target: 'italian', slug: 'english-italian' },
  { source: 'english', target: 'arabic', slug: 'english-arabic' },
  { source: 'spanish', target: 'english', slug: 'spanish-english' },
  { source: 'french', target: 'english', slug: 'french-english' },
  { source: 'german', target: 'english', slug: 'german-english' },
  { source: 'russian', target: 'english', slug: 'russian-english' },
  { source: 'chinese', target: 'english', slug: 'chinese-english' },
  { source: 'japanese', target: 'english', slug: 'japanese-english' },
  { source: 'korean', target: 'english', slug: 'korean-english' },
  { source: 'portuguese', target: 'english', slug: 'portuguese-english' },
  { source: 'italian', target: 'english', slug: 'italian-english' },
  { source: 'arabic', target: 'english', slug: 'arabic-english' },
  { source: 'german', target: 'french', slug: 'german-french' },
  { source: 'french', target: 'german', slug: 'french-german' },
  { source: 'spanish', target: 'french', slug: 'spanish-french' },
  { source: 'french', target: 'spanish', slug: 'french-spanish' },
  { source: 'german', target: 'russian', slug: 'german-russian' },
  { source: 'russian', target: 'german', slug: 'russian-german' },
  { source: 'dutch', target: 'english', slug: 'dutch-english' },
  { source: 'english', target: 'dutch', slug: 'english-dutch' },
  { source: 'polish', target: 'english', slug: 'polish-english' },
  { source: 'english', target: 'polish', slug: 'english-polish' },
] as const;
