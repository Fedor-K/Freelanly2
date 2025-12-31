/**
 * SEO content for skill pages
 * Generates unique content for each skill
 */

import { Skill, skills } from './skills';

interface SkillContent {
  intro: string;
  whyRemote: string;
  careerPath: string[];
  avgSalary: { entry: string; mid: string; senior: string };
  learningResources: string[];
  relatedSkills: string[];
}

// Content templates by category
const categoryContent: Record<Skill['category'], Omit<SkillContent, 'intro' | 'relatedSkills'>> = {
  language: {
    whyRemote: 'Programming languages are the foundation of remote work in tech. Companies worldwide need developers who can write clean, maintainable code regardless of location.',
    careerPath: ['Junior Developer', 'Mid-level Developer', 'Senior Developer', 'Staff Engineer', 'Principal Engineer'],
    avgSalary: { entry: '$50K-$80K', mid: '$80K-$120K', senior: '$120K-$180K+' },
    learningResources: ['Official documentation', 'Online courses (Udemy, Coursera)', 'Coding bootcamps', 'Open source contributions', 'Technical blogs'],
  },
  framework: {
    whyRemote: 'Framework expertise is highly sought after in remote positions. Companies need developers who can build and maintain applications using modern tools and best practices.',
    careerPath: ['Junior Developer', 'Frontend/Backend Developer', 'Full-stack Developer', 'Tech Lead', 'Architect'],
    avgSalary: { entry: '$55K-$85K', mid: '$85K-$130K', senior: '$130K-$200K+' },
    learningResources: ['Framework documentation', 'YouTube tutorials', 'GitHub example projects', 'Community Discord/Slack', 'Conference talks'],
  },
  database: {
    whyRemote: 'Database skills are essential for any data-driven company. Remote database experts help organizations manage, optimize, and scale their data infrastructure.',
    careerPath: ['Junior DBA', 'Database Developer', 'Senior DBA', 'Data Architect', 'Principal Data Engineer'],
    avgSalary: { entry: '$60K-$90K', mid: '$90K-$140K', senior: '$140K-$200K+' },
    learningResources: ['Official documentation', 'Database certification programs', 'SQL practice platforms', 'Performance tuning guides', 'Cloud provider tutorials'],
  },
  devops: {
    whyRemote: 'DevOps and SRE roles are inherently suited for remote work. Infrastructure automation and monitoring can be managed from anywhere with proper tooling.',
    careerPath: ['Junior DevOps Engineer', 'DevOps Engineer', 'Senior DevOps Engineer', 'Platform Engineer', 'Director of Engineering'],
    avgSalary: { entry: '$70K-$100K', mid: '$100K-$150K', senior: '$150K-$220K+' },
    learningResources: ['Cloud provider certifications', 'Hands-on labs', 'Infrastructure as Code tutorials', 'SRE books (Google)', 'DevOps communities'],
  },
  cloud: {
    whyRemote: 'Cloud expertise is perfect for remote work as all major cloud platforms are designed for distributed access. Companies increasingly need cloud architects who can work from anywhere.',
    careerPath: ['Cloud Engineer', 'Senior Cloud Engineer', 'Solutions Architect', 'Principal Architect', 'VP of Cloud'],
    avgSalary: { entry: '$75K-$110K', mid: '$110K-$160K', senior: '$160K-$250K+' },
    learningResources: ['AWS/GCP/Azure certifications', 'Cloud provider free tiers', 'Architecture whitepapers', 'Well-Architected Framework', 'Cloud community forums'],
  },
  data: {
    whyRemote: 'Data professionals work with distributed datasets and cloud-based tools, making remote work natural. Companies worldwide need data experts to drive decisions.',
    careerPath: ['Data Analyst', 'Data Scientist', 'Senior Data Scientist', 'ML Engineer', 'Head of Data'],
    avgSalary: { entry: '$65K-$95K', mid: '$95K-$150K', senior: '$150K-$250K+' },
    learningResources: ['Kaggle competitions', 'Data science bootcamps', 'Academic courses (Coursera, edX)', 'Research papers', 'ML community blogs'],
  },
  mobile: {
    whyRemote: 'Mobile development is well-suited for remote work. App stores and development tools work globally, and mobile developers can ship updates from anywhere.',
    careerPath: ['Junior Mobile Developer', 'Mobile Developer', 'Senior Mobile Developer', 'Mobile Lead', 'Mobile Architect'],
    avgSalary: { entry: '$55K-$85K', mid: '$85K-$130K', senior: '$130K-$190K+' },
    learningResources: ['Apple/Google developer docs', 'Mobile dev courses', 'App Store guidelines', 'Design pattern tutorials', 'Mobile dev conferences'],
  },
  other: {
    whyRemote: 'Specialized tech skills are in high demand for remote positions. Companies often search globally to find experts in niche technologies.',
    careerPath: ['Specialist', 'Senior Specialist', 'Principal', 'Director', 'VP'],
    avgSalary: { entry: '$60K-$90K', mid: '$90K-$140K', senior: '$140K-$200K+' },
    learningResources: ['Specialized certifications', 'Industry conferences', 'Professional communities', 'Technical documentation', 'Hands-on projects'],
  },
};

// Skill-specific intros
const skillIntros: Record<string, string> = {
  react: 'React is the most popular JavaScript library for building user interfaces, developed by Meta. Its component-based architecture and virtual DOM make it ideal for creating fast, interactive web applications.',
  typescript: 'TypeScript adds static typing to JavaScript, catching errors at compile time and enabling better tooling. It has become the standard for large-scale web applications.',
  python: 'Python is known for its readability and versatility, excelling in web development, data science, AI/ML, and automation. Its rich ecosystem makes it a top choice for many domains.',
  javascript: 'JavaScript is the language of the web, running in every browser and on servers via Node.js. It powers interactive websites, mobile apps, and even desktop applications.',
  golang: 'Go (Golang) is Google\'s language designed for simplicity, performance, and concurrency. It\'s perfect for cloud services, APIs, and system programming.',
  rust: 'Rust combines low-level performance with memory safety, making it ideal for systems programming, WebAssembly, and performance-critical applications.',
  nodejs: 'Node.js enables JavaScript on the server, powering millions of backend applications. Its non-blocking I/O model makes it excellent for real-time applications.',
  aws: 'Amazon Web Services is the leading cloud platform with 200+ services. AWS skills are essential for building scalable, reliable cloud infrastructure.',
  kubernetes: 'Kubernetes (K8s) is the industry standard for container orchestration, enabling automated deployment, scaling, and management of containerized applications.',
  docker: 'Docker revolutionized software deployment with containerization. It ensures applications run consistently across development, testing, and production environments.',
  'machine-learning': 'Machine Learning enables systems to learn from data and make predictions. ML engineers build models that power recommendations, fraud detection, and automation.',
  'data-science': 'Data Science combines statistics, programming, and domain expertise to extract insights from data. Data scientists drive business decisions with data-driven analysis.',
  java: 'Java is an enterprise-grade language powering backend systems, Android apps, and big data processing. Its "write once, run anywhere" philosophy ensures cross-platform compatibility.',
  vue: 'Vue.js is a progressive framework for building web interfaces. Its gentle learning curve and flexibility make it popular for projects of all sizes.',
  angular: 'Angular is Google\'s enterprise framework for building complex web applications. It provides a complete solution with built-in routing, forms, and HTTP handling.',
  postgresql: 'PostgreSQL is the world\'s most advanced open-source relational database, known for reliability, data integrity, and extensibility.',
  mongodb: 'MongoDB is the leading NoSQL document database, offering flexibility and scalability for modern applications with unstructured or semi-structured data.',
  graphql: 'GraphQL is a query language for APIs that lets clients request exactly the data they need. It reduces over-fetching and improves API efficiency.',
  terraform: 'Terraform is the leading Infrastructure as Code tool, enabling teams to define, provision, and manage cloud resources through code.',
  swift: 'Swift is Apple\'s modern language for iOS, macOS, and cross-platform development. It combines safety, speed, and expressiveness.',
  kotlin: 'Kotlin is the preferred language for Android development, offering modern features, null safety, and full Java interoperability.',
  flutter: 'Flutter is Google\'s UI toolkit for building natively compiled mobile, web, and desktop applications from a single codebase.',
};

export function getSkillContent(skill: Skill): SkillContent {
  const baseContent = categoryContent[skill.category];

  // Find related skills (same category, excluding self)
  const relatedSkills = skills
    .filter((s) => s.category === skill.category && s.slug !== skill.slug)
    .slice(0, 5)
    .map((s) => s.name);

  return {
    intro: skillIntros[skill.slug] || `${skill.name} is a key technology in modern software development. ${skill.description}`,
    whyRemote: baseContent.whyRemote,
    careerPath: baseContent.careerPath,
    avgSalary: baseContent.avgSalary,
    learningResources: baseContent.learningResources,
    relatedSkills,
  };
}

export function getSkillFAQs(skill: Skill, jobCount: number): Array<{ question: string; answer: string }> {
  const content = getSkillContent(skill);

  return [
    {
      question: `How many remote ${skill.name} jobs are available?`,
      answer: `We currently have ${jobCount} remote ${skill.name} positions available. New jobs are added daily as companies worldwide look for ${skill.name} talent.`,
    },
    {
      question: `What is the average salary for remote ${skill.name} jobs?`,
      answer: `Remote ${skill.name} salaries vary by experience: Entry-level positions typically pay ${content.avgSalary.entry}, mid-level roles pay ${content.avgSalary.mid}, and senior positions can reach ${content.avgSalary.senior}.`,
    },
    {
      question: `What experience do I need for remote ${skill.name} jobs?`,
      answer: `Entry-level positions typically require 1-2 years of experience or a strong portfolio. Mid-level roles need 3-5 years, and senior positions require 5+ years along with leadership or specialized expertise.`,
    },
    {
      question: `Is ${skill.name} good for remote work?`,
      answer: content.whyRemote,
    },
    {
      question: `What skills complement ${skill.name}?`,
      answer: content.relatedSkills.length > 0
        ? `Skills that pair well with ${skill.name} include ${content.relatedSkills.join(', ')}. Having complementary skills can increase your job opportunities and salary potential.`
        : `${skill.name} pairs well with many technologies in the ${skill.category} space. Expanding your skillset can increase your job opportunities.`,
    },
  ];
}
