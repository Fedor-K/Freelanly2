/**
 * SEO Content for Category Pages
 * Each category has unique intro text, skills, tools, and salary info
 */

export interface CategoryContent {
  slug: string;
  intro: string;
  whatYouDo: string;
  keySkills: string[];
  popularTools: string[];
  salaryRange: { entry: string; mid: string; senior: string };
  careerPath: string;
  whyRemote: string;
}

export const categoryContent: Record<string, CategoryContent> = {
  engineering: {
    slug: 'engineering',
    intro: `Remote software engineering jobs offer exceptional opportunities for developers worldwide. As a remote software engineer, you'll build applications, systems, and platforms while enjoying the flexibility of working from anywhere. Companies from startups to Fortune 500 enterprises are actively hiring remote engineers for roles in full-stack development, backend systems, frontend applications, mobile development, and cloud infrastructure.`,
    whatYouDo: `Software engineers design, develop, and maintain software applications and systems. Daily tasks include writing clean, efficient code, participating in code reviews, collaborating with cross-functional teams, debugging issues, and deploying applications. Remote engineers often work with distributed teams across time zones, using async communication and documentation-first approaches.`,
    keySkills: ['JavaScript/TypeScript', 'Python', 'React/Vue/Angular', 'Node.js', 'SQL/NoSQL databases', 'Git', 'Cloud platforms (AWS/GCP/Azure)', 'CI/CD pipelines', 'System design', 'API development'],
    popularTools: ['VS Code', 'GitHub', 'Docker', 'Kubernetes', 'Jira', 'Slack', 'Notion', 'Figma'],
    salaryRange: { entry: '$70,000 - $100,000', mid: '$100,000 - $150,000', senior: '$150,000 - $250,000+' },
    careerPath: `Junior Developer → Mid-Level Engineer → Senior Engineer → Staff Engineer → Principal Engineer → Engineering Manager → VP of Engineering → CTO`,
    whyRemote: `Remote engineering roles offer competitive salaries, flexible schedules, and the ability to work for top tech companies regardless of location. Many engineers report higher productivity and better work-life balance when working remotely.`,
  },

  design: {
    slug: 'design',
    intro: `Remote design jobs span UI/UX design, product design, graphic design, and brand design. As a remote designer, you'll create visual experiences, user interfaces, and brand identities for companies worldwide. The design industry has embraced remote work, with companies recognizing that creative talent can thrive from anywhere with the right tools and collaboration processes.`,
    whatYouDo: `Designers create visual solutions that solve user problems and achieve business goals. This includes conducting user research, creating wireframes and prototypes, designing user interfaces, developing brand guidelines, and collaborating with developers to bring designs to life. Remote designers typically work async, using design tools that support real-time collaboration.`,
    keySkills: ['UI/UX Design', 'Visual Design', 'Prototyping', 'User Research', 'Design Systems', 'Typography', 'Color Theory', 'Interaction Design', 'Accessibility', 'Design Thinking'],
    popularTools: ['Figma', 'Sketch', 'Adobe Creative Suite', 'Framer', 'Principle', 'Miro', 'Notion', 'Loom'],
    salaryRange: { entry: '$60,000 - $85,000', mid: '$85,000 - $130,000', senior: '$130,000 - $200,000+' },
    careerPath: `Junior Designer → Designer → Senior Designer → Lead Designer → Design Manager → Head of Design → VP of Design → Chief Design Officer`,
    whyRemote: `Remote design work offers creative freedom, flexible hours that align with your most creative times, and access to opportunities at top companies worldwide. Many designers find remote work enables deeper focus for creative projects.`,
  },

  data: {
    slug: 'data',
    intro: `Remote data and analytics jobs are in high demand as companies increasingly rely on data-driven decision making. As a remote data professional, you'll work with large datasets, build analytical models, create visualizations, and derive insights that drive business strategy. From data analysts to data scientists and data engineers, remote opportunities span the entire data ecosystem.`,
    whatYouDo: `Data professionals collect, process, analyze, and visualize data to extract actionable insights. Data analysts create reports and dashboards, data scientists build predictive models and machine learning solutions, and data engineers build the infrastructure that makes data accessible. Remote data teams often work across time zones, using documented processes and shared notebooks.`,
    keySkills: ['Python/R', 'SQL', 'Machine Learning', 'Statistical Analysis', 'Data Visualization', 'ETL/ELT', 'Big Data (Spark, Hadoop)', 'Cloud Data Platforms', 'A/B Testing', 'Business Intelligence'],
    popularTools: ['Python', 'Jupyter', 'Tableau/Looker', 'dbt', 'Snowflake', 'BigQuery', 'Airflow', 'Power BI'],
    salaryRange: { entry: '$65,000 - $90,000', mid: '$90,000 - $140,000', senior: '$140,000 - $220,000+' },
    careerPath: `Data Analyst → Senior Analyst → Data Scientist → Senior Data Scientist → Lead/Staff Data Scientist → Data Science Manager → Head of Data → Chief Data Officer`,
    whyRemote: `Remote data roles offer excellent compensation, the ability to work with cutting-edge tools, and opportunities at data-driven companies worldwide. Many data professionals appreciate the quiet, focused environment that remote work provides for complex analysis.`,
  },

  devops: {
    slug: 'devops',
    intro: `Remote DevOps and SRE jobs focus on building and maintaining the infrastructure that powers modern applications. As a remote DevOps engineer, you'll automate deployments, manage cloud infrastructure, ensure system reliability, and bridge the gap between development and operations. Companies rely on DevOps professionals to keep their systems running smoothly 24/7.`,
    whatYouDo: `DevOps engineers automate software deployment, manage cloud infrastructure, monitor system performance, and respond to incidents. Daily work includes writing infrastructure as code, configuring CI/CD pipelines, implementing security best practices, and optimizing system performance. Remote DevOps teams often use on-call rotations and async communication for incident management.`,
    keySkills: ['Linux/Unix', 'Cloud Platforms (AWS/GCP/Azure)', 'Kubernetes/Docker', 'Terraform/Ansible', 'CI/CD (Jenkins, GitLab, GitHub Actions)', 'Monitoring (Prometheus, Grafana)', 'Scripting (Bash, Python)', 'Networking', 'Security'],
    popularTools: ['Terraform', 'Kubernetes', 'Docker', 'AWS/GCP/Azure', 'Prometheus', 'Grafana', 'PagerDuty', 'Datadog'],
    salaryRange: { entry: '$80,000 - $110,000', mid: '$110,000 - $160,000', senior: '$160,000 - $240,000+' },
    careerPath: `Junior DevOps → DevOps Engineer → Senior DevOps → Staff/Principal SRE → DevOps Manager → Director of Platform Engineering → VP of Infrastructure`,
    whyRemote: `Remote DevOps roles are well-suited for distributed work since infrastructure management is inherently digital. On-call responsibilities can be handled from anywhere, and many DevOps professionals appreciate the flexibility to design their own productive work environment.`,
  },

  qa: {
    slug: 'qa',
    intro: `Remote QA and testing jobs ensure software quality through manual testing, test automation, and quality processes. As a remote QA engineer, you'll identify bugs, create test plans, build automation frameworks, and work with development teams to ship high-quality software. Quality assurance is critical to every software company, making QA professionals essential team members.`,
    whatYouDo: `QA engineers design and execute test plans, write automated tests, perform manual testing, report and track bugs, and collaborate with developers to resolve issues. Remote QA professionals often work across time zones with development teams, using async communication and detailed bug reports to ensure clear communication.`,
    keySkills: ['Test Automation', 'Manual Testing', 'Selenium/Cypress/Playwright', 'API Testing', 'Performance Testing', 'Mobile Testing', 'CI/CD Integration', 'Bug Tracking', 'Test Planning', 'Agile/Scrum'],
    popularTools: ['Selenium', 'Cypress', 'Playwright', 'Postman', 'Jira', 'TestRail', 'BrowserStack', 'Jest'],
    salaryRange: { entry: '$55,000 - $80,000', mid: '$80,000 - $120,000', senior: '$120,000 - $170,000+' },
    careerPath: `QA Analyst → QA Engineer → Senior QA Engineer → QA Lead → QA Manager → Director of Quality → VP of Quality Engineering`,
    whyRemote: `Remote QA work offers flexibility and the ability to test applications in real-world conditions from different locations and networks. Many QA professionals find remote work enables better focus for detailed testing work.`,
  },

  security: {
    slug: 'security',
    intro: `Remote security jobs protect organizations from cyber threats, data breaches, and vulnerabilities. As a remote security professional, you'll conduct security assessments, implement security controls, respond to incidents, and ensure compliance with security standards. With cyber threats increasing, security professionals are in extremely high demand across all industries.`,
    whatYouDo: `Security professionals identify vulnerabilities, implement security measures, monitor for threats, respond to incidents, and ensure regulatory compliance. Daily work includes security assessments, penetration testing, security code reviews, incident response, and security awareness training. Remote security teams use secure communication channels and follow strict protocols.`,
    keySkills: ['Network Security', 'Application Security', 'Penetration Testing', 'SIEM/SOC', 'Cloud Security', 'Cryptography', 'Compliance (SOC2, ISO27001)', 'Incident Response', 'Security Architecture', 'Threat Modeling'],
    popularTools: ['Burp Suite', 'Metasploit', 'Nessus', 'Splunk', 'CrowdStrike', 'Okta', 'HashiCorp Vault', 'Snyk'],
    salaryRange: { entry: '$80,000 - $110,000', mid: '$110,000 - $160,000', senior: '$160,000 - $250,000+' },
    careerPath: `Security Analyst → Security Engineer → Senior Security Engineer → Security Architect → Security Manager → Director of Security → CISO`,
    whyRemote: `Remote security work is well-suited for the digital nature of cybersecurity. Security professionals can protect organizations from anywhere, and many companies offer remote roles to access top security talent globally.`,
  },

  product: {
    slug: 'product',
    intro: `Remote product management jobs lead the strategy, development, and success of digital products. As a remote product manager, you'll define product vision, prioritize features, work with engineering and design teams, and drive product outcomes. Product managers are the bridge between business strategy and product execution, making them crucial to company success.`,
    whatYouDo: `Product managers define product strategy, gather requirements, prioritize roadmaps, coordinate with cross-functional teams, and measure product success. Daily work includes user research, feature prioritization, stakeholder communication, sprint planning, and data analysis. Remote PMs rely heavily on documentation, async communication, and video calls for alignment.`,
    keySkills: ['Product Strategy', 'User Research', 'Roadmap Planning', 'Agile/Scrum', 'Data Analysis', 'Stakeholder Management', 'A/B Testing', 'Technical Understanding', 'Go-to-Market', 'Metrics & KPIs'],
    popularTools: ['Jira', 'Confluence', 'Productboard', 'Amplitude', 'Mixpanel', 'Figma', 'Notion', 'Linear'],
    salaryRange: { entry: '$80,000 - $110,000', mid: '$110,000 - $160,000', senior: '$160,000 - $250,000+' },
    careerPath: `Associate PM → Product Manager → Senior PM → Group PM → Director of Product → VP of Product → Chief Product Officer`,
    whyRemote: `Remote product management enables PMs to work with global teams and access diverse user perspectives. Many product leaders find remote work provides focused time for strategic thinking alongside collaborative sessions.`,
  },

  marketing: {
    slug: 'marketing',
    intro: `Remote marketing jobs span digital marketing, content marketing, growth marketing, and brand marketing. As a remote marketer, you'll create campaigns, drive customer acquisition, build brand awareness, and analyze marketing performance. Digital marketing is inherently suited for remote work, with campaigns managed entirely through online platforms.`,
    whatYouDo: `Marketers create and execute marketing strategies, manage campaigns, produce content, analyze performance data, and optimize for conversions. Daily work includes content creation, SEO/SEM optimization, social media management, email marketing, and performance analysis. Remote marketing teams use digital tools for collaboration and campaign management.`,
    keySkills: ['Digital Marketing', 'Content Marketing', 'SEO/SEM', 'Social Media Marketing', 'Email Marketing', 'Marketing Analytics', 'Paid Advertising', 'Copywriting', 'Marketing Automation', 'Brand Strategy'],
    popularTools: ['HubSpot', 'Google Analytics', 'Semrush/Ahrefs', 'Mailchimp', 'Hootsuite', 'Google Ads', 'Meta Ads', 'Canva'],
    salaryRange: { entry: '$50,000 - $75,000', mid: '$75,000 - $120,000', senior: '$120,000 - $180,000+' },
    careerPath: `Marketing Coordinator → Marketing Manager → Senior Manager → Director of Marketing → VP of Marketing → CMO`,
    whyRemote: `Remote marketing roles are naturally suited for digital-first work. Marketers can manage campaigns, analyze data, and create content from anywhere, often finding remote work enables better focus and creativity.`,
  },

  sales: {
    slug: 'sales',
    intro: `Remote sales jobs include account executives, SDRs, sales managers, and revenue leaders. As a remote sales professional, you'll build relationships with prospects, close deals, and drive revenue growth. Modern sales is increasingly digital, with video calls, email, and social selling replacing in-person meetings for many transactions.`,
    whatYouDo: `Sales professionals prospect for new customers, conduct discovery calls, deliver presentations, negotiate deals, and maintain customer relationships. Daily work includes outbound prospecting, demo calls, proposal writing, pipeline management, and CRM updates. Remote sales teams use video conferencing and sales tools to engage prospects effectively.`,
    keySkills: ['B2B Sales', 'Prospecting', 'Negotiation', 'Relationship Building', 'CRM Management', 'Sales Presentations', 'Pipeline Management', 'Account Management', 'Social Selling', 'Closing'],
    popularTools: ['Salesforce', 'HubSpot', 'Outreach', 'LinkedIn Sales Navigator', 'Gong', 'ZoomInfo', 'Zoom', 'Slack'],
    salaryRange: { entry: '$50,000 - $80,000 + commission', mid: '$80,000 - $130,000 + commission', senior: '$130,000 - $200,000+ + commission' },
    careerPath: `SDR/BDR → Account Executive → Senior AE → Enterprise AE → Sales Manager → Director of Sales → VP of Sales → CRO`,
    whyRemote: `Remote sales has become standard for many companies, with video meetings proving just as effective as in-person for most sales cycles. Sales professionals enjoy flexibility while still building strong customer relationships.`,
  },

  finance: {
    slug: 'finance',
    intro: `Remote finance jobs include financial analysts, accountants, FP&A professionals, and finance managers. As a remote finance professional, you'll manage budgets, create financial models, ensure compliance, and provide strategic financial guidance. Finance teams have successfully transitioned to remote work, leveraging cloud-based accounting and collaboration tools.`,
    whatYouDo: `Finance professionals analyze financial data, create forecasts and budgets, manage accounts, ensure regulatory compliance, and provide strategic recommendations. Daily work includes financial modeling, variance analysis, month-end close processes, and stakeholder reporting. Remote finance teams use secure cloud tools and video conferencing for collaboration.`,
    keySkills: ['Financial Modeling', 'FP&A', 'Accounting (GAAP/IFRS)', 'Excel/Google Sheets', 'Budgeting & Forecasting', 'Financial Analysis', 'Audit', 'Tax', 'Treasury', 'Business Intelligence'],
    popularTools: ['Excel', 'NetSuite', 'QuickBooks', 'SAP', 'Tableau', 'Adaptive Insights', 'Expensify', 'Bill.com'],
    salaryRange: { entry: '$55,000 - $80,000', mid: '$80,000 - $130,000', senior: '$130,000 - $200,000+' },
    careerPath: `Financial Analyst → Senior Analyst → Finance Manager → Director of Finance → VP of Finance → CFO`,
    whyRemote: `Remote finance work is enabled by cloud-based accounting systems and secure data access. Many finance professionals appreciate the focused environment for detailed analysis and modeling work.`,
  },

  hr: {
    slug: 'hr',
    intro: `Remote HR and recruiting jobs help companies build and retain their workforce. As a remote HR professional, you'll recruit talent, manage employee relations, develop HR policies, and create positive workplace cultures. HR has embraced remote work, with virtual recruiting, onboarding, and employee engagement becoming standard practices.`,
    whatYouDo: `HR professionals recruit and onboard employees, manage benefits and compensation, handle employee relations, develop training programs, and ensure compliance with employment laws. Recruiters source candidates, conduct interviews, and manage the hiring process. Remote HR teams use video interviews, digital onboarding, and virtual collaboration tools.`,
    keySkills: ['Recruiting', 'Talent Acquisition', 'Employee Relations', 'HR Compliance', 'Compensation & Benefits', 'Performance Management', 'HRIS Systems', 'Employer Branding', 'Onboarding', 'Learning & Development'],
    popularTools: ['Greenhouse', 'Lever', 'Workday', 'BambooHR', 'LinkedIn Recruiter', 'Lattice', 'Culture Amp', 'Calendly'],
    salaryRange: { entry: '$50,000 - $70,000', mid: '$70,000 - $110,000', senior: '$110,000 - $170,000+' },
    careerPath: `HR Coordinator → HR Generalist → HR Manager → Director of HR → VP of People → Chief People Officer`,
    whyRemote: `Remote HR and recruiting roles are well-suited for virtual work, with video interviews and digital tools enabling effective talent acquisition and employee management from anywhere.`,
  },

  operations: {
    slug: 'operations',
    intro: `Remote operations jobs keep companies running efficiently. As a remote operations professional, you'll optimize processes, manage projects, coordinate teams, and drive operational excellence. Operations roles span business operations, revenue operations, and customer operations, all of which can be effectively performed remotely.`,
    whatYouDo: `Operations professionals streamline processes, manage vendor relationships, coordinate cross-functional projects, analyze operational metrics, and implement improvements. Daily work includes process documentation, performance tracking, project coordination, and problem-solving. Remote ops teams use project management and collaboration tools to stay aligned.`,
    keySkills: ['Process Optimization', 'Project Management', 'Data Analysis', 'Vendor Management', 'Documentation', 'Cross-functional Coordination', 'Metrics & KPIs', 'Problem Solving', 'Strategic Planning', 'Change Management'],
    popularTools: ['Asana', 'Monday.com', 'Airtable', 'Notion', 'Zapier', 'Slack', 'Google Workspace', 'Zoom'],
    salaryRange: { entry: '$50,000 - $75,000', mid: '$75,000 - $120,000', senior: '$120,000 - $180,000+' },
    careerPath: `Operations Coordinator → Operations Manager → Senior Ops Manager → Director of Operations → VP of Operations → COO`,
    whyRemote: `Remote operations roles leverage digital tools for process management and coordination. Many operations professionals find remote work enables better focus and the flexibility to work across time zones.`,
  },

  legal: {
    slug: 'legal',
    intro: `Remote legal jobs include corporate counsel, contract attorneys, legal operations, and compliance professionals. As a remote legal professional, you'll draft contracts, ensure regulatory compliance, manage legal risks, and provide legal guidance. The legal industry has increasingly embraced remote work, particularly for corporate and transactional work.`,
    whatYouDo: `Legal professionals draft and review contracts, advise on legal matters, ensure regulatory compliance, manage litigation, and protect company interests. Daily work includes contract negotiation, legal research, policy development, and stakeholder counseling. Remote legal teams use secure document management and video conferencing for client communication.`,
    keySkills: ['Contract Drafting & Review', 'Legal Research', 'Corporate Law', 'Compliance', 'Intellectual Property', 'Employment Law', 'Privacy & Data Protection', 'Negotiation', 'Risk Management', 'Regulatory Affairs'],
    popularTools: ['DocuSign', 'Ironclad', 'Westlaw', 'Lexis', 'ContractPodAi', 'Clio', 'NetDocuments', 'Zoom'],
    salaryRange: { entry: '$70,000 - $100,000', mid: '$100,000 - $160,000', senior: '$160,000 - $300,000+' },
    careerPath: `Legal Counsel → Senior Counsel → Director of Legal → VP of Legal → General Counsel → Chief Legal Officer`,
    whyRemote: `Remote legal work is enabled by digital document management and e-signature tools. Many legal professionals appreciate the focused environment for detailed contract work and legal research.`,
  },

  'project-management': {
    slug: 'project-management',
    intro: `Remote project management jobs coordinate teams and deliver projects on time and within budget. As a remote project manager, you'll plan projects, manage timelines, coordinate resources, and ensure successful project delivery. Project management is well-suited for remote work, with digital tools enabling effective coordination across distributed teams.`,
    whatYouDo: `Project managers plan and schedule projects, coordinate team activities, track progress and budgets, manage stakeholder expectations, and mitigate risks. Daily work includes standup meetings, status updates, resource allocation, and timeline management. Remote PMs use project management tools and video conferencing to keep teams aligned.`,
    keySkills: ['Project Planning', 'Agile/Scrum/Kanban', 'Risk Management', 'Resource Allocation', 'Stakeholder Management', 'Budget Management', 'Timeline Management', 'Communication', 'Problem Solving', 'Documentation'],
    popularTools: ['Jira', 'Asana', 'Monday.com', 'Trello', 'MS Project', 'Smartsheet', 'Slack', 'Confluence'],
    salaryRange: { entry: '$60,000 - $85,000', mid: '$85,000 - $130,000', senior: '$130,000 - $180,000+' },
    careerPath: `Project Coordinator → Project Manager → Senior PM → Program Manager → Director of PMO → VP of Program Management`,
    whyRemote: `Remote project management is highly effective with modern collaboration tools. PMs can coordinate global teams, manage projects across time zones, and deliver results from anywhere.`,
  },

  writing: {
    slug: 'writing',
    intro: `Remote writing and content jobs create the words that power businesses. As a remote writer, you'll craft blog posts, marketing copy, technical documentation, and more. Content is king in digital marketing, making skilled writers essential for companies looking to engage audiences and drive traffic.`,
    whatYouDo: `Writers create various content types including blog posts, website copy, email campaigns, social media content, white papers, and documentation. Daily work includes research, writing, editing, SEO optimization, and content strategy. Remote writers often work independently with async feedback from editors and stakeholders.`,
    keySkills: ['Copywriting', 'Content Writing', 'SEO Writing', 'Technical Writing', 'Editing', 'Research', 'Storytelling', 'Brand Voice', 'Content Strategy', 'Grammar & Style'],
    popularTools: ['Google Docs', 'Grammarly', 'Hemingway', 'WordPress', 'Notion', 'Airtable', 'Semrush', 'Canva'],
    salaryRange: { entry: '$45,000 - $65,000', mid: '$65,000 - $100,000', senior: '$100,000 - $150,000+' },
    careerPath: `Content Writer → Senior Writer → Content Manager → Content Director → Head of Content → VP of Content`,
    whyRemote: `Remote writing is ideal since writing is inherently independent work. Writers can produce their best work in their preferred environment, often finding remote work boosts creativity and productivity.`,
  },

  translation: {
    slug: 'translation',
    intro: `Remote translation and localization jobs bridge language barriers for global businesses. As a remote translator or interpreter, you'll convert content between languages while preserving meaning and cultural context. With businesses expanding globally, demand for skilled linguists continues to grow across industries.`,
    whatYouDo: `Translators convert written content between languages, while interpreters handle spoken communication. Work includes document translation, website localization, software localization, and real-time interpretation. Remote linguists often specialize in specific language pairs and industries such as legal, medical, or technical translation.`,
    keySkills: ['Language Fluency (Native-level)', 'Translation', 'Localization', 'CAT Tools', 'Terminology Management', 'Cultural Adaptation', 'Proofreading', 'Subject Matter Expertise', 'Quality Assurance', 'Project Management'],
    popularTools: ['SDL Trados', 'memoQ', 'Smartcat', 'Memsource', 'Wordfast', 'Lokalise', 'Crowdin', 'Phrase'],
    salaryRange: { entry: '$40,000 - $60,000', mid: '$60,000 - $90,000', senior: '$90,000 - $130,000+' },
    careerPath: `Translator → Senior Translator → Localization Specialist → Localization Manager → Director of Localization`,
    whyRemote: `Remote translation work is naturally suited for distributed work, with translators serving clients globally from anywhere. Many linguists appreciate the flexibility to work with clients across time zones.`,
  },

  creative: {
    slug: 'creative',
    intro: `Remote creative and media jobs produce visual content, video, animation, and multimedia experiences. As a remote creative professional, you'll create videos, animations, graphics, and multimedia content that engages audiences. Digital content creation is inherently remote-friendly, with powerful tools enabling collaboration from anywhere.`,
    whatYouDo: `Creative professionals produce video content, animations, motion graphics, photography, and multimedia experiences. Daily work includes concept development, production, editing, and post-production. Remote creatives often work on project-based assignments, collaborating with teams through cloud-based tools and file sharing.`,
    keySkills: ['Video Production', 'Motion Graphics', 'Animation', 'Video Editing', 'Photography', 'Audio Production', 'Storyboarding', 'Color Grading', '3D Modeling', 'Visual Effects'],
    popularTools: ['Adobe Premiere', 'After Effects', 'Final Cut Pro', 'DaVinci Resolve', 'Blender', 'Cinema 4D', 'Frame.io', 'Dropbox'],
    salaryRange: { entry: '$45,000 - $70,000', mid: '$70,000 - $110,000', senior: '$110,000 - $170,000+' },
    careerPath: `Junior Creative → Creative → Senior Creative → Lead Creative → Creative Director → VP of Creative`,
    whyRemote: `Remote creative work is enabled by cloud-based production tools and high-speed internet. Many creatives prefer remote work for the quiet, focused environment needed for detailed production work.`,
  },

  support: {
    slug: 'support',
    intro: `Remote customer support jobs help users solve problems and have positive experiences with products and services. As a remote support professional, you'll answer questions, troubleshoot issues, and ensure customer satisfaction. Customer support has been at the forefront of remote work, with many companies operating fully distributed support teams.`,
    whatYouDo: `Customer support professionals respond to inquiries, troubleshoot technical issues, process requests, and escalate complex problems. Daily work includes handling tickets, live chat, phone support, and email responses. Remote support teams use help desk software and communication tools to provide excellent service from anywhere.`,
    keySkills: ['Communication', 'Problem Solving', 'Product Knowledge', 'Empathy', 'Ticket Management', 'Technical Troubleshooting', 'Time Management', 'Documentation', 'De-escalation', 'Multitasking'],
    popularTools: ['Zendesk', 'Intercom', 'Freshdesk', 'Help Scout', 'Slack', 'Zoom', 'Loom', 'Notion'],
    salaryRange: { entry: '$35,000 - $50,000', mid: '$50,000 - $75,000', senior: '$75,000 - $110,000+' },
    careerPath: `Support Agent → Senior Support → Team Lead → Support Manager → Director of Support → VP of Customer Experience`,
    whyRemote: `Remote customer support is highly effective with modern help desk tools. Support professionals can assist customers globally, often finding remote work provides a better environment for focused customer interactions.`,
  },

  education: {
    slug: 'education',
    intro: `Remote education jobs include online teaching, curriculum development, instructional design, and EdTech roles. As a remote educator, you'll create learning experiences, teach students, develop educational content, and leverage technology for education. Online learning has exploded in popularity, creating abundant opportunities for education professionals.`,
    whatYouDo: `Education professionals teach online courses, develop curriculum, create instructional materials, and design learning experiences. Daily work includes lesson planning, content creation, student engagement, assessment, and feedback. Remote educators use learning management systems and video conferencing to deliver effective education.`,
    keySkills: ['Teaching', 'Curriculum Development', 'Instructional Design', 'Learning Management Systems', 'Student Engagement', 'Assessment', 'E-Learning Development', 'Subject Matter Expertise', 'Communication', 'Technology Integration'],
    popularTools: ['Canvas', 'Blackboard', 'Moodle', 'Teachable', 'Articulate', 'Zoom', 'Google Classroom', 'Loom'],
    salaryRange: { entry: '$45,000 - $65,000', mid: '$65,000 - $95,000', senior: '$95,000 - $140,000+' },
    careerPath: `Online Instructor → Senior Instructor → Curriculum Designer → Learning Manager → Director of Learning → VP of Education`,
    whyRemote: `Remote education has become mainstream, with online learning proving effective for students of all ages. Educators appreciate the flexibility to teach from anywhere while reaching students globally.`,
  },

  research: {
    slug: 'research',
    intro: `Remote research jobs span user research, market research, academic research, and R&D roles. As a remote researcher, you'll investigate questions, analyze data, and generate insights that inform decisions. Research work is well-suited for remote environments, with many research activities being inherently independent and data-focused.`,
    whatYouDo: `Researchers design studies, collect and analyze data, synthesize findings, and present recommendations. Daily work includes literature reviews, survey design, interviews, data analysis, and report writing. Remote researchers use digital tools for data collection, analysis, and collaboration with research teams.`,
    keySkills: ['Research Methods', 'Data Analysis', 'Survey Design', 'Interview Techniques', 'Statistical Analysis', 'Qualitative Analysis', 'Report Writing', 'Critical Thinking', 'Presentation', 'Academic Writing'],
    popularTools: ['Qualtrics', 'SurveyMonkey', 'SPSS/R/Python', 'NVivo', 'UserTesting', 'Dovetail', 'Notion', 'Miro'],
    salaryRange: { entry: '$55,000 - $80,000', mid: '$80,000 - $120,000', senior: '$120,000 - $170,000+' },
    careerPath: `Research Associate → Researcher → Senior Researcher → Research Lead → Research Manager → Director of Research → VP of Research`,
    whyRemote: `Remote research is highly effective since much research work is independent analysis and synthesis. Researchers often find the quiet of remote work ideal for deep thinking and focused analysis.`,
  },

  consulting: {
    slug: 'consulting',
    intro: `Remote consulting jobs provide expert advice to organizations across industries. As a remote consultant, you'll analyze business challenges, develop strategies, and guide implementations. Consulting has embraced remote work, with virtual workshops, video presentations, and digital collaboration replacing much in-person client work.`,
    whatYouDo: `Consultants analyze business problems, develop recommendations, present solutions, and support implementations. Daily work includes client meetings, research, analysis, presentation development, and project management. Remote consultants use video conferencing and collaboration tools to deliver high-impact client engagements virtually.`,
    keySkills: ['Business Analysis', 'Strategy Development', 'Problem Solving', 'Client Management', 'Presentation Skills', 'Project Management', 'Industry Expertise', 'Data Analysis', 'Change Management', 'Communication'],
    popularTools: ['PowerPoint', 'Excel', 'Miro', 'Notion', 'Zoom', 'Slack', 'Tableau', 'Airtable'],
    salaryRange: { entry: '$70,000 - $100,000', mid: '$100,000 - $160,000', senior: '$160,000 - $300,000+' },
    careerPath: `Analyst → Consultant → Senior Consultant → Manager → Principal → Director → Partner`,
    whyRemote: `Remote consulting has proven effective for many engagement types, with virtual workshops and digital collaboration enabling high-quality client delivery. Many consultants appreciate reduced travel while maintaining client impact.`,
  },
};

/**
 * Get content for a specific category
 */
export function getCategoryContent(slug: string): CategoryContent | null {
  return categoryContent[slug] || null;
}
