// Content source for /apply-guides/* — hand-written, honest, no invented statistics.
// Each guide targets "how to fill out / apply on <ATS>" queries and walks the actual form.

export interface GuideFaq {
  q: string;
  a: string;
}

export interface GuideStep {
  name: string; // short step name (used in HowTo schema)
  text: string; // the practical instruction
}

export interface AtsGuide {
  slug: string;
  ats: string; // display name
  title: string; // SEO title (≤60 chars target)
  metaDescription: string;
  urlPatterns: string[]; // how to recognize the ATS from the address bar
  intro: string;
  steps: GuideStep[]; // field-by-field walkthrough (HowTo schema)
  mistakes: string[]; // common auto-reject mistakes
  faqs: GuideFaq[];
}

export const ATS_GUIDES: AtsGuide[] = [
  {
    slug: 'lever',
    ats: 'Lever',
    title: 'How to Fill Out a Lever Job Application (Field-by-Field Guide)',
    metaDescription:
      'A practical walkthrough of the Lever application form (jobs.lever.co): every field explained, common auto-reject mistakes, and how to stand out.',
    urlPatterns: ['jobs.lever.co/<company>/<job-id>/apply', 'jobs.eu.lever.co/<company>/...'],
    intro:
      "Lever is one of the most common applicant tracking systems at startups and scale-ups. Its application form is a single page — short compared to Workday or Taleo — which means every field you do fill carries weight. Here's what each field is for and how to fill it without hurting your chances.",
    steps: [
      { name: 'Confirm you are on the apply page', text: 'Lever job pages live at jobs.lever.co/<company>. The description page has an "Apply for this job" button; the actual form is at the same URL ending in /apply.' },
      { name: 'Full name', text: 'Use your real, consistent professional name — the same one that appears on your resume and LinkedIn. Mismatched names across documents create needless doubt.' },
      { name: 'Email', text: 'Use the address you actually check daily. Replies to Lever applications come by email, often from an @hire.lever.co or company address that can land in Promotions — check all tabs after applying.' },
      { name: 'Phone', text: 'Include country code if you are applying internationally (e.g. +52, +55, +91). Recruiters do call, especially for later stages.' },
      { name: 'Current company (Org)', text: 'One line, current or most recent employer. Freelancers: your own studio name or "Independent / Freelance" is perfectly fine — leaving it blank looks like an oversight.' },
      { name: 'Links: LinkedIn, GitHub, Portfolio', text: 'Lever has dedicated URL fields. Fill every one that applies to your profession — for engineers GitHub matters, for designers the portfolio link is often the first thing opened. Test each link in an incognito window first.' },
      { name: 'Resume upload', text: 'Upload a PDF. Lever parses it, but the recruiter sees the original file — so clean single-column formatting beats clever design. Name the file professionally: firstname-lastname-resume.pdf.' },
      { name: 'Cover letter / additional information', text: "This textarea is where most applications win or lose. Reference the specific role and something concrete from the job post; lead with your most relevant shipped work. Three short paragraphs beat a page of boilerplate." },
      { name: 'Custom questions', text: 'Companies add role-specific questions (salary expectations, timezone, start date, visa status). Answer every one — skipped questions are visible to the recruiter as blanks. Be direct; these are usually used as structured filters.' },
      { name: 'Review and submit', text: 'Lever does not let you edit an application after submission. Re-read everything — especially links and the cover letter — before clicking Submit application.' },
    ],
    mistakes: [
      'Submitting a Word document with broken formatting instead of a PDF.',
      'Leaving the cover-letter field empty on roles that clearly expect one.',
      'Pasting a generic letter that never mentions the company or the role.',
      'Broken or private portfolio/LinkedIn links (always test in incognito).',
      'Skipping "optional" custom questions — recruiters see the blanks.',
      'Salary-expectation answers wildly out of the posted range without explanation.',
    ],
    faqs: [
      { q: 'Can I edit my Lever application after submitting?', a: 'No. Lever has no candidate portal for edits. If you made a significant mistake, the practical fix is emailing the recruiter or applying again with a note — but avoid duplicate applications for minor typos.' },
      { q: 'Does Lever automatically reject applications?', a: 'Lever itself does not auto-reject, but companies use its structured custom questions (visa status, salary, location) as knock-out filters. Honest, direct answers to those questions matter more than keyword-stuffing.' },
      { q: 'Should I write the cover letter field in Lever?', a: 'Yes, when present. Lever forms are short, so the free-text field is one of the few places you can differentiate. Two or three specific sentences about why you fit this role beat a full page of generic prose.' },
      { q: 'What resume format works best with Lever?', a: 'A single-column PDF with standard fonts. Lever shows recruiters the original file, so visual clarity matters as much as parseability.' },
    ],
  },
  {
    slug: 'greenhouse',
    ats: 'Greenhouse',
    title: 'How to Fill Out a Greenhouse Application (Field-by-Field Guide)',
    metaDescription:
      'Everything on the Greenhouse job application form (boards.greenhouse.io) explained: resume parsing, custom questions, EEO section, and mistakes to avoid.',
    urlPatterns: ['boards.greenhouse.io/<company>/jobs/<id>', 'job-boards.greenhouse.io/<company>/...', '<company>.greenhouse.io'],
    intro:
      "Greenhouse powers hiring at thousands of tech companies. Its application form is modular — companies choose which fields to include — but the core structure is consistent. Understanding what happens to each field after you hit Submit helps you fill it strategically.",
    steps: [
      { name: 'Recognize the form', text: 'Greenhouse boards live at boards.greenhouse.io/<company> or job-boards.greenhouse.io. Some companies embed the same form into their own careers page — the field structure gives it away.' },
      { name: 'First name / last name', text: 'Greenhouse splits the name into two fields. Put middle names in neither — keep it identical to your resume header.' },
      { name: 'Email and phone', text: 'Standard contact fields. Greenhouse sends confirmation and scheduling emails from no-reply@greenhouse.io or the company domain — whitelist both so interview invitations never land in spam.' },
      { name: 'Resume / CV upload', text: 'Greenhouse parses your resume and may pre-fill education and work history. ALWAYS scroll through and verify the parsed fields — a mis-parsed date or title stays wrong in the recruiter view even though your PDF is correct.' },
      { name: 'Cover letter', text: 'Often a separate upload or textarea. When it is optional, a short tailored note still differentiates you — recruiters see at a glance who bothered.' },
      { name: 'LinkedIn / website fields', text: 'Fill them when present. Some Greenhouse setups feed these links directly into the recruiter scorecard view.' },
      { name: 'Custom application questions', text: 'These are set per-role and often structured (dropdowns, yes/no). Companies use them as knock-out filters: work authorization, location, seniority. Answer honestly — a false yes here surfaces at the offer stage and wastes everyone\'s time, including yours.' },
      { name: 'Demographic / EEO section (US roles)', text: 'The "Equal Employment Opportunity" questions (gender, race, veteran, disability) are voluntary, go to a separate compliance report, and are NOT shown alongside your application. "Decline to self-identify" is always an option and does not hurt your application.' },
      { name: 'Submit and confirmation', text: 'You should receive a confirmation email within minutes. No email usually means a typo in your address — worth re-applying carefully, since Greenhouse flags exact duplicates.' },
    ],
    mistakes: [
      'Not reviewing auto-parsed education/work history after the resume upload.',
      'Treating knock-out questions (visa, location, seniority) as formalities and answering inaccurately.',
      'Uploading a resume as .docx when the posting or form hints at PDF.',
      'Skipping the optional cover letter on senior or writing-heavy roles.',
      'Using a decorative two-column resume that scrambles the parser.',
      'Applying to many roles at the same company at once — recruiters see all of them in one profile view.',
    ],
    faqs: [
      { q: 'Do the EEO questions in Greenhouse affect my application?', a: 'No. The demographic section is voluntary, stored separately for compliance reporting, and is not shown to the hiring team with your application. Declining to answer is a standard choice.' },
      { q: 'Does Greenhouse auto-reject candidates?', a: 'Greenhouse itself does not score you, but companies configure knock-out questions (work authorization, location, salary) that filter applications before a human reads them. Those custom questions deserve your most careful answers.' },
      { q: 'Why did my Greenhouse application fields fill in wrong?', a: 'Greenhouse parses your uploaded resume to pre-fill fields, and parsing is imperfect — especially with multi-column layouts, tables, or graphics. Always verify pre-filled fields before submitting, and use a simple single-column resume.' },
      { q: 'Can I apply to multiple jobs at one company through Greenhouse?', a: 'Yes, and recruiters will see all your applications grouped in one candidate profile. Two targeted applications look focused; six scattered ones look indiscriminate.' },
    ],
  },
  {
    slug: 'ashby',
    ats: 'Ashby',
    title: 'How to Apply on Ashby: the Application Form Explained',
    metaDescription:
      'A practical guide to Ashby job applications (jobs.ashbyhq.com): what the minimal form hides, how screening questions are used, and mistakes to avoid.',
    urlPatterns: ['jobs.ashbyhq.com/<company>/<job-id>', 'jobs.ashbyhq.com/<company>/<job-id>/application'],
    intro:
      "Ashby is the ATS of choice for many newer startups — you'll recognize it by the clean, fast, minimal form at jobs.ashbyhq.com. The form is usually short: a handful of contact fields plus role-specific screening questions. That brevity is deceptive — with fewer fields, each answer gets more recruiter attention.",
    steps: [
      { name: 'Recognize the form', text: 'Ashby applications live at jobs.ashbyhq.com/<company>. The Apply tab (or /application suffix) opens the form — a modern single-column layout that saves nothing until you submit.' },
      { name: 'Name, email, phone', text: 'Standard fields at the top. Same rule as everywhere: consistent with your resume, an email you check, country code on the phone.' },
      { name: 'Resume upload', text: 'PDF, single column. Ashby renders your resume inline for the recruiter, so what you upload is exactly what gets read — typography and clarity matter.' },
      { name: 'LinkedIn and links', text: 'Ashby setups often include a LinkedIn or website field; some let you add multiple links. Prioritize the one or two links that prove your fit for this specific role.' },
      { name: 'Screening questions', text: 'This is the heart of most Ashby forms: role-specific free-text and select questions chosen by the hiring team. Short, concrete, specific answers win — two or three sentences with a real example beat a paragraph of adjectives.' },
      { name: 'Compensation and logistics questions', text: 'Ashby forms frequently ask for salary expectations, notice period, or timezone directly. Give a number or range when asked — "negotiable" reads as a non-answer in a structured field.' },
      { name: 'Review before submitting', text: 'The form does not save drafts, and there is no post-submit editing. If the form is long, draft screening answers elsewhere first, then paste and submit in one sitting.' },
    ],
    mistakes: [
      'Writing essay-length screening answers — concise and concrete reads better.',
      'Dodging the salary/timezone questions with "flexible" when a number is asked for.',
      'Letting the browser tab die mid-form: Ashby does not save drafts.',
      'Uploading a resume that relies on graphics — it is rendered inline, but recruiters skim.',
      'Reusing another company\'s screening answers with the wrong company name left in.',
    ],
    faqs: [
      { q: 'Does Ashby save my application as a draft?', a: 'No. The form holds your input only while the tab is open. For long screening questions, write your answers in a separate document first, then paste and submit in one go.' },
      { q: 'How important are the screening questions on Ashby?', a: 'Very. Ashby forms tend to have few fields, so hiring teams put their real filters into the screening questions. Specific, honest, example-backed answers are the main differentiator.' },
      { q: 'Can I edit an Ashby application after submitting?', a: 'No — there is no candidate portal for edits. For a material error, a short follow-up email to the recruiter is the practical fix.' },
      { q: 'Why do Ashby forms ask for salary expectations up front?', a: 'Structured comp questions let teams filter mismatches early, saving both sides interview time. Answer with your researched range for the role and market rather than skipping it.' },
    ],
  },
  {
    slug: 'workable',
    ats: 'Workable',
    title: 'How to Apply on Workable: the Application Form Explained',
    metaDescription:
      'How the Workable application (apply.workable.com) really works: resume parsing into a profile, the summary field, screening questions, and common mistakes.',
    urlPatterns: ['apply.workable.com/<company>/j/<id>', 'jobs.workable.com — the public job board'],
    intro:
      "Workable is popular with small and mid-size companies worldwide. Its form is a hybrid: you upload a resume, Workable parses it into a structured candidate profile (experience, education, skills), and you fill whatever extra questions the company added. The parsing step is where most applications quietly go wrong.",
    steps: [
      { name: 'Recognize the form', text: 'Direct applications run at apply.workable.com/<company>/j/<job-id>. The same form is often embedded in company careers pages; jobs.workable.com is the public aggregate board.' },
      { name: 'Contact details', text: 'Name, email, phone — the standard trio. Workable sends confirmations and interview scheduling from workable.com domains or the company address; check spam if nothing arrives.' },
      { name: 'Resume upload and parsing', text: 'After upload, Workable extracts your experience, education, and skills into profile fields. Expand and verify each parsed section — recruiters filter and search on these structured fields, not just the PDF.' },
      { name: 'Summary / headline field', text: 'Many Workable forms include a short summary box. Treat it as your elevator pitch for this role: one or two sentences connecting your strongest relevant experience to what the post asks for.' },
      { name: 'Work experience and education blocks', text: 'If the company requires structured entries, keep titles and dates consistent with the resume. Contradictions between the parsed profile and the PDF read as carelessness.' },
      { name: 'Screening questions', text: 'Companies add custom questions — often yes/no plus a few free-text ones. The yes/no ones typically act as filters; the free-text ones get read by humans. Budget your effort accordingly, but answer everything.' },
      { name: 'Submit and confirmation email', text: 'A confirmation email arrives on success. Workable also lets some companies send bulk status updates — a rejection email from Workable is usually a considered decision, not an auto-bounce.' },
    ],
    mistakes: [
      'Skipping the parsed-profile review after the resume upload — wrong dates and titles stick.',
      'Leaving the summary field blank when present: it is prime pitch real estate.',
      'Answering structured yes/no filters inaccurately to "get through" — it surfaces later.',
      'Uploading an image-heavy resume that parses into an empty profile.',
      'Inconsistent job titles between the form fields and the attached PDF.',
    ],
    faqs: [
      { q: 'Why does Workable rewrite my resume into a profile?', a: 'Workable structures your experience so recruiters can search and filter candidates by fields (title, skills, education) rather than reading every PDF. That is why verifying the parsed fields matters as much as the file itself.' },
      { q: 'Do I need a Workable account to apply?', a: 'No — applications go through without registration. An email confirmation serves as your receipt; there is no candidate dashboard for most postings.' },
      { q: 'Can I update my application on Workable?', a: 'Not through the form. If something material changed (new portfolio, corrected contact), reply to the confirmation email or contact the company directly.' },
      { q: 'What resume format parses best in Workable?', a: 'A text-based, single-column PDF with clear section headings (Experience, Education, Skills). Graphics-heavy or multi-column resumes often parse into incomplete profiles.' },
    ],
  },
];

export function getGuide(slug: string): AtsGuide | undefined {
  return ATS_GUIDES.find((g) => g.slug === slug);
}
