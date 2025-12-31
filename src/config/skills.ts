/**
 * Skills configuration for programmatic SEO pages
 * URL pattern: /jobs/skills/[skill]
 */

export interface Skill {
  slug: string;           // URL slug
  name: string;           // Display name
  aliases: string[];      // Search aliases (for job matching)
  category: 'language' | 'framework' | 'database' | 'devops' | 'cloud' | 'data' | 'mobile' | 'other';
  icon?: string;          // Emoji or icon
  description: string;    // Short description
}

export const skills: Skill[] = [
  // Programming Languages
  {
    slug: 'javascript',
    name: 'JavaScript',
    aliases: ['js', 'ecmascript', 'es6', 'es2015'],
    category: 'language',
    icon: '🟨',
    description: 'The language of the web, used for frontend and backend development',
  },
  {
    slug: 'typescript',
    name: 'TypeScript',
    aliases: ['ts', 'typed javascript'],
    category: 'language',
    icon: '🔷',
    description: 'JavaScript with static typing for large-scale applications',
  },
  {
    slug: 'python',
    name: 'Python',
    aliases: ['py', 'python3'],
    category: 'language',
    icon: '🐍',
    description: 'Versatile language for web, data science, AI, and automation',
  },
  {
    slug: 'java',
    name: 'Java',
    aliases: ['jvm', 'j2ee', 'jdk'],
    category: 'language',
    icon: '☕',
    description: 'Enterprise-grade language for backend and Android development',
  },
  {
    slug: 'golang',
    name: 'Go',
    aliases: ['go', 'golang', 'go lang'],
    category: 'language',
    icon: '🐹',
    description: 'Fast, efficient language for cloud and systems programming',
  },
  {
    slug: 'rust',
    name: 'Rust',
    aliases: ['rustlang'],
    category: 'language',
    icon: '🦀',
    description: 'Systems language focused on safety, speed, and concurrency',
  },
  {
    slug: 'ruby',
    name: 'Ruby',
    aliases: ['rb'],
    category: 'language',
    icon: '💎',
    description: 'Dynamic language known for developer happiness and Rails',
  },
  {
    slug: 'php',
    name: 'PHP',
    aliases: ['php8', 'php7'],
    category: 'language',
    icon: '🐘',
    description: 'Server-side scripting language powering most of the web',
  },
  {
    slug: 'csharp',
    name: 'C#',
    aliases: ['c#', 'csharp', 'dotnet', '.net', 'asp.net'],
    category: 'language',
    icon: '🟪',
    description: 'Microsoft language for enterprise, games, and web apps',
  },
  {
    slug: 'swift',
    name: 'Swift',
    aliases: ['swiftui', 'ios'],
    category: 'mobile',
    icon: '🍎',
    description: 'Apple language for iOS, macOS, and cross-platform apps',
  },
  {
    slug: 'kotlin',
    name: 'Kotlin',
    aliases: ['android', 'kt'],
    category: 'mobile',
    icon: '🤖',
    description: 'Modern language for Android and multiplatform development',
  },
  {
    slug: 'scala',
    name: 'Scala',
    aliases: ['scala3'],
    category: 'language',
    icon: '🔴',
    description: 'Functional and object-oriented language for the JVM',
  },

  // Frontend Frameworks
  {
    slug: 'react',
    name: 'React',
    aliases: ['reactjs', 'react.js', 'jsx'],
    category: 'framework',
    icon: '⚛️',
    description: 'Popular library for building user interfaces',
  },
  {
    slug: 'nextjs',
    name: 'Next.js',
    aliases: ['next', 'next.js', 'vercel'],
    category: 'framework',
    icon: '▲',
    description: 'React framework for production with SSR and static generation',
  },
  {
    slug: 'vue',
    name: 'Vue.js',
    aliases: ['vuejs', 'vue3', 'nuxt'],
    category: 'framework',
    icon: '💚',
    description: 'Progressive framework for building web interfaces',
  },
  {
    slug: 'angular',
    name: 'Angular',
    aliases: ['angularjs', 'ng'],
    category: 'framework',
    icon: '🅰️',
    description: 'Enterprise framework for building web applications',
  },
  {
    slug: 'svelte',
    name: 'Svelte',
    aliases: ['sveltekit'],
    category: 'framework',
    icon: '🧡',
    description: 'Compiler-based framework with no virtual DOM',
  },

  // Backend Frameworks
  {
    slug: 'nodejs',
    name: 'Node.js',
    aliases: ['node', 'express', 'expressjs', 'npm'],
    category: 'framework',
    icon: '💚',
    description: 'JavaScript runtime for server-side development',
  },
  {
    slug: 'rails',
    name: 'Ruby on Rails',
    aliases: ['ruby on rails', 'ror'],
    category: 'framework',
    icon: '🛤️',
    description: 'Full-stack framework for rapid web development',
  },
  {
    slug: 'django',
    name: 'Django',
    aliases: ['django rest', 'drf'],
    category: 'framework',
    icon: '🎸',
    description: 'Python framework for rapid, secure web development',
  },
  {
    slug: 'laravel',
    name: 'Laravel',
    aliases: ['php laravel'],
    category: 'framework',
    icon: '🔶',
    description: 'PHP framework with elegant syntax and powerful features',
  },
  {
    slug: 'spring',
    name: 'Spring',
    aliases: ['spring boot', 'springboot', 'spring framework'],
    category: 'framework',
    icon: '🌱',
    description: 'Java framework for enterprise application development',
  },
  {
    slug: 'fastapi',
    name: 'FastAPI',
    aliases: ['fast api'],
    category: 'framework',
    icon: '⚡',
    description: 'Modern Python framework for building APIs',
  },

  // Mobile
  {
    slug: 'flutter',
    name: 'Flutter',
    aliases: ['dart', 'flutter sdk'],
    category: 'mobile',
    icon: '🦋',
    description: 'Google framework for cross-platform mobile apps',
  },
  {
    slug: 'react-native',
    name: 'React Native',
    aliases: ['reactnative', 'rn'],
    category: 'mobile',
    icon: '📱',
    description: 'React framework for native mobile development',
  },

  // Databases
  {
    slug: 'postgresql',
    name: 'PostgreSQL',
    aliases: ['postgres', 'pg', 'psql'],
    category: 'database',
    icon: '🐘',
    description: 'Advanced open-source relational database',
  },
  {
    slug: 'mysql',
    name: 'MySQL',
    aliases: ['mariadb'],
    category: 'database',
    icon: '🐬',
    description: 'Popular open-source relational database',
  },
  {
    slug: 'mongodb',
    name: 'MongoDB',
    aliases: ['mongo', 'nosql'],
    category: 'database',
    icon: '🍃',
    description: 'Document-based NoSQL database',
  },
  {
    slug: 'redis',
    name: 'Redis',
    aliases: ['cache', 'in-memory'],
    category: 'database',
    icon: '🔴',
    description: 'In-memory data store for caching and real-time apps',
  },
  {
    slug: 'elasticsearch',
    name: 'Elasticsearch',
    aliases: ['elastic', 'elk', 'opensearch'],
    category: 'database',
    icon: '🔍',
    description: 'Distributed search and analytics engine',
  },

  // DevOps & Cloud
  {
    slug: 'aws',
    name: 'AWS',
    aliases: ['amazon web services', 'ec2', 's3', 'lambda'],
    category: 'cloud',
    icon: '☁️',
    description: 'Amazon cloud platform with 200+ services',
  },
  {
    slug: 'gcp',
    name: 'Google Cloud',
    aliases: ['google cloud platform', 'gcloud'],
    category: 'cloud',
    icon: '🌐',
    description: 'Google cloud platform for computing and data',
  },
  {
    slug: 'azure',
    name: 'Azure',
    aliases: ['microsoft azure', 'ms azure'],
    category: 'cloud',
    icon: '🔵',
    description: 'Microsoft cloud platform for enterprise solutions',
  },
  {
    slug: 'docker',
    name: 'Docker',
    aliases: ['containers', 'containerization'],
    category: 'devops',
    icon: '🐳',
    description: 'Container platform for application deployment',
  },
  {
    slug: 'kubernetes',
    name: 'Kubernetes',
    aliases: ['k8s', 'k8', 'container orchestration'],
    category: 'devops',
    icon: '☸️',
    description: 'Container orchestration platform for scaling apps',
  },
  {
    slug: 'terraform',
    name: 'Terraform',
    aliases: ['iac', 'infrastructure as code', 'hashicorp'],
    category: 'devops',
    icon: '🏗️',
    description: 'Infrastructure as code tool for cloud provisioning',
  },
  {
    slug: 'ansible',
    name: 'Ansible',
    aliases: ['configuration management'],
    category: 'devops',
    icon: '🔧',
    description: 'Automation tool for configuration and deployment',
  },
  {
    slug: 'jenkins',
    name: 'Jenkins',
    aliases: ['ci', 'continuous integration'],
    category: 'devops',
    icon: '🔨',
    description: 'Open-source automation server for CI/CD',
  },
  {
    slug: 'github-actions',
    name: 'GitHub Actions',
    aliases: ['gha', 'github ci'],
    category: 'devops',
    icon: '🐙',
    description: 'CI/CD platform integrated with GitHub',
  },

  // Data & ML
  {
    slug: 'machine-learning',
    name: 'Machine Learning',
    aliases: ['ml', 'ai', 'artificial intelligence', 'deep learning'],
    category: 'data',
    icon: '🤖',
    description: 'AI techniques for pattern recognition and prediction',
  },
  {
    slug: 'data-science',
    name: 'Data Science',
    aliases: ['data analysis', 'analytics', 'data analyst'],
    category: 'data',
    icon: '📊',
    description: 'Extracting insights from structured and unstructured data',
  },
  {
    slug: 'spark',
    name: 'Apache Spark',
    aliases: ['pyspark', 'spark sql'],
    category: 'data',
    icon: '⚡',
    description: 'Distributed computing framework for big data',
  },
  {
    slug: 'kafka',
    name: 'Apache Kafka',
    aliases: ['event streaming', 'message queue'],
    category: 'data',
    icon: '📨',
    description: 'Distributed event streaming platform',
  },
  {
    slug: 'pandas',
    name: 'Pandas',
    aliases: ['numpy', 'data manipulation'],
    category: 'data',
    icon: '🐼',
    description: 'Python library for data manipulation and analysis',
  },
  {
    slug: 'tensorflow',
    name: 'TensorFlow',
    aliases: ['tf', 'keras'],
    category: 'data',
    icon: '🧠',
    description: 'Open-source platform for machine learning',
  },
  {
    slug: 'pytorch',
    name: 'PyTorch',
    aliases: ['torch'],
    category: 'data',
    icon: '🔥',
    description: 'Deep learning framework for research and production',
  },

  // APIs & Other
  {
    slug: 'graphql',
    name: 'GraphQL',
    aliases: ['apollo', 'gql'],
    category: 'other',
    icon: '◈',
    description: 'Query language for APIs with flexible data fetching',
  },
  {
    slug: 'rest-api',
    name: 'REST API',
    aliases: ['restful', 'api design', 'openapi'],
    category: 'other',
    icon: '🔗',
    description: 'Architectural style for web service APIs',
  },
  {
    slug: 'devops',
    name: 'DevOps',
    aliases: ['sre', 'site reliability', 'platform engineering'],
    category: 'devops',
    icon: '🔄',
    description: 'Practices combining development and operations',
  },
  {
    slug: 'security',
    name: 'Security',
    aliases: ['cybersecurity', 'infosec', 'appsec', 'devsecops'],
    category: 'other',
    icon: '🔒',
    description: 'Protecting systems and data from threats',
  },
  {
    slug: 'blockchain',
    name: 'Blockchain',
    aliases: ['web3', 'solidity', 'smart contracts', 'crypto'],
    category: 'other',
    icon: '⛓️',
    description: 'Distributed ledger technology for decentralized apps',
  },
];

export function getSkillBySlug(slug: string): Skill | undefined {
  return skills.find((s) => s.slug === slug);
}

export function searchSkillByAlias(query: string): Skill | undefined {
  const normalized = query.toLowerCase().trim();
  return skills.find(
    (s) => s.slug === normalized || s.name.toLowerCase() === normalized || s.aliases.some((a) => a.toLowerCase() === normalized)
  );
}

export function getSkillsByCategory(category: Skill['category']): Skill[] {
  return skills.filter((s) => s.category === category);
}

// High-demand skills for homepage/featured sections
export const featuredSkills = [
  'react', 'typescript', 'python', 'nodejs', 'aws',
  'kubernetes', 'golang', 'rust', 'machine-learning', 'data-science'
];
