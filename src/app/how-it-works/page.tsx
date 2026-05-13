import { Metadata } from 'next';
import { MarketingNav, MarketingCTA, MarketingFooter } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'How It Works — Freelanly',
  description: 'Five-step pipeline from job post to client reply. Discovery, matching, AI cover letter, send, and follow-up — all automated.',
};

const steps = [
  {
    num: '01', id: 'discover', title: 'Discovery',
    h2: ['Catch ', 'hiring posts', ' before they hit the boards.'],
    desc: 'Every 3 hours, Freelanly scrapes LinkedIn for fresh "we\'re hiring" posts and crawls 3,500+ company career pages. We surface jobs 18–48 hours before they reach Indeed, Upwork, or LinkedIn Jobs.',
    bullets: ['3,500+ company pages crawled every 3 hours', 'LinkedIn signal extraction — hiring manager posts, not just "Open to work"', 'Direct contact — email or LinkedIn of the actual hiring manager'],
  },
  {
    num: '02', id: 'match', title: 'Smart matching',
    h2: ['Filter ', 'in', ' what you want. Filter ', 'out', ' the rest.'],
    desc: 'Set your stack, preferred engagement type, location, and exclude keywords. Freelanly scores every new gig against your profile and only queues the ones worth your time.',
    bullets: ['Positive & negative filters — keywords, tech stack, company type, location', 'Match score 0–100 on every gig — skip below your threshold', 'Saved feeds: "EU React contracts", "Brand design retainers"'],
  },
  {
    num: '03', id: 'write', title: 'AI cover letter',
    h2: ['A letter that sounds like ', 'you', ', not a template.'],
    desc: 'Our AI reads the job post, pulls specifics from your portfolio, and writes a 3–5 sentence opener that references what the hiring manager actually asked for. No "I hope this email finds you well."',
    bullets: ['Trained on what wins replies — short, specific, human', 'References your real projects and case studies', 'Voice training — paste 3 emails and it matches your tone'],
  },
  {
    num: '04', id: 'send', title: 'Send & inbox',
    h2: ['From ', 'your', ' inbox. Tracked end-to-end.'],
    desc: 'Applications send from your real email (Gmail OAuth) or via Freelanly\'s domain. Every message is tracked: sent, opened, replied. Replies route back to one unified inbox.',
    bullets: ['Send from your own Gmail — not a third-party domain', 'Open & reply tracking on every application', 'One inbox for all recruiter replies, tagged by sentiment'],
  },
  {
    num: '05', id: 'followup', title: 'Follow-up & tracking',
    h2: ['Most replies come from the ', 'follow-up', '.'],
    desc: 'If they go quiet for 5 days, Freelanly sends one polite nudge. Five days later, one more. Then it stops. The second they reply, the sequence pauses automatically.',
    bullets: ['3-touch sequence: opener → bump → breakup', 'Auto-pause on reply — no awkward double-sends', 'Pipeline view: Sent → Opened → Replied → Interview → Offer'],
  },
];

export default function HowItWorksPage() {
  return (
    <div style={{ background: '#0A0B0F', color: '#FAFAFA' }}>
      <MarketingNav />

      <header className="pt-28 pb-16">
        <div className="max-w-[1240px] mx-auto px-8">
          <span className="font-mono text-xs tracking-widest uppercase text-[#C7F94A]">— How it works</span>
          <h1 className="text-[clamp(40px,5.5vw,68px)] font-semibold tracking-tighter mt-4 mb-5 leading-none">
            The whole loop,<br />from <span className="text-[#C7F94A]">post</span> to <span className="text-[#C7F94A]">paycheck.</span>
          </h1>
          <p className="text-[19px] text-[#D4D4D8] leading-relaxed max-w-[60ch]">
            Freelanly is a five-step pipeline running 24/7. Here&apos;s what happens between &quot;new gig posted&quot; and &quot;client replies.&quot;
          </p>
        </div>
      </header>

      {steps.map((step, i) => (
        <section key={step.id} id={step.id} className="py-20" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="max-w-[1240px] mx-auto px-8">
            <div className="max-w-[720px]">
              <div className="font-mono text-xs tracking-widest uppercase text-[#C7F94A] mb-4 flex items-center gap-3">
                <span className="w-10 h-0.5 bg-[#C7F94A]" />
                Step {step.num} — {step.title}
              </div>
              <h2 className="text-[clamp(30px,3.5vw,44px)] font-semibold tracking-tighter leading-[1.05] mb-5">
                {step.h2.map((part, j) => j % 2 === 1 ? <span key={j} className="text-[#C7F94A]">{part}</span> : part)}
              </h2>
              <p className="text-[17px] text-[#D4D4D8] leading-relaxed mb-6">{step.desc}</p>
              <ul className="space-y-3">
                {step.bullets.map(b => (
                  <li key={b} className="flex items-start gap-3 text-[15px] text-[#D4D4D8]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C7F94A" strokeWidth="2.5" className="mt-1 flex-shrink-0"><path d="M20 6L9 17l-5-5" /></svg>
                    <span dangerouslySetInnerHTML={{ __html: b.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ))}

      <MarketingCTA />
      <MarketingFooter />
    </div>
  );
}
