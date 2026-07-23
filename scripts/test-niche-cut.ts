import { shouldImportByProfession } from '../src/config/target-professions';
const CUT = ['Freelance Translator EN-ES','Localization Specialist','SEO Specialist','Social Media Manager','Content Writer','Copywriter','Video Editor','Graphic Designer','UX/UI Designer','Product Designer','3D Artist','Voice Over Artist','Management Consultant','SAP FICO Consultant','Oracle Techno-Functional Consultant','Workday Certified HCM Consultant','Virtual Assistant','Data Entry Clerk','Community Manager','Media Buyer','Growth Marketer','Transcriptionist','Subtitle Editor','Proofreader'];
const KEEP = ['Senior React Developer','Python Developer','Java Backend Engineer','DevOps Engineer','Site Reliability Engineer','QA Automation Engineer','SDET','Data Engineer','Data Scientist','Machine Learning Engineer','Full Stack Developer','iOS Developer','Cloud Engineer','Platform Engineer','SAP ABAP Developer','Guidewire Developer','Salesforce Developer','UI Developer','Product Manager','Technical Project Manager','Security Engineer','Solution Architect','Desarrollador Full Stack','Engenheiro de Dados'];
let bad=0;
for (const t of CUT) if (shouldImportByProfession(t)) { console.log('LEAK (should cut):', t); bad++; }
for (const t of KEEP) if (!shouldImportByProfession(t)) { console.log('OVERCUT (should keep):', t); bad++; }
console.log(bad===0 ? 'ALL 48 CASES PASS' : bad+' FAILURES');
