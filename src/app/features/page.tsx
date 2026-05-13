import { Metadata } from 'next';
import { MarketingNav, MarketingCTA, MarketingFooter } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Features — Freelanly',
  description: 'Twenty-four product features grouped into four pillars: discovery, outreach, tracking, and workflow. Built for freelancers.',
};

const pillars = [
  {
    num: '01', title: 'Discovery', subtitle: 'Find gigs before they go viral.',
    desc: 'Job-board listings are the leftovers. Real opportunities surface as LinkedIn posts and career-page drops hours before they hit the boards.',
    features: [
      { title: 'LinkedIn post crawler', desc: 'Scrapes "we\'re hiring" posts from hiring managers — not the public Jobs tab. Fresh feed every 3 hours.' },
      { title: '3,500+ career-page monitors', desc: 'Greenhouse, Lever, Ashby, Workable, and custom career pages — pinged the moment a new role appears.' },
      { title: 'Real-time signal mining', desc: 'Detects funding announcements, team-page changes, and new careers-page posts — leading indicators.' },
      { title: 'Contact enrichment', desc: 'Surfaces the actual hiring manager\'s email or LinkedIn — not a generic careers@ address.' },
      { title: 'Custom feeds', desc: 'Save filters as named feeds: "EU React contracts", "Brand design retainers". Each streams independently.' },
      { title: 'Quiet-hours scanning', desc: 'Crawlers run round the clock. When you wake up, EU and US morning posts are already in your queue.' },
    ],
  },
  {
    num: '02', title: 'Outreach', subtitle: 'Outreach that actually gets replies.',
    desc: 'Sending more applications doesn\'t win you more work — sending better ones does.',
    features: [
      { title: 'AI cover letter writer', desc: 'Reads the job post, references your portfolio, sounds like you. ~90 words. No "I hope this email finds you well."' },
      { title: 'Auto-apply engine', desc: 'Set criteria once. Applications go out at human cadence (max 25/day, business hours) from your real inbox.' },
      { title: 'Voice training', desc: 'Paste 3 of your real emails. The AI matches your sentence length, vocabulary, and sign-off.' },
      { title: 'Auto follow-ups', desc: 'If quiet for 5 days, one polite nudge. Five days later, one more. Pauses the second they reply.' },
      { title: 'Deal-breaker filters', desc: 'Never apply to "Web3 ninja rockstar" posts again. Block keywords, company types, contract terms.' },
      { title: 'Send from your inbox', desc: 'OAuth into Gmail. Sends as you, not a third-party domain. Replies route back into Freelanly.' },
    ],
  },
  {
    num: '03', title: 'Tracking', subtitle: 'Know exactly what\'s working.',
    desc: 'Every application tracked from send → open → reply → interview → offer.',
    features: [
      { title: 'Reply & open analytics', desc: 'Open rate, reply rate, interview rate. By week, by template, by company size, by industry.' },
      { title: 'Pipeline / Kanban', desc: 'Drag-and-drop board: Sent → Opened → Replied → Interview → Offer. Conversion at each stage.' },
      { title: 'Reply categorization', desc: 'Auto-tags every reply: interested, info-request, rejected. Move fast on the hot ones.' },
      { title: 'Weekly digest', desc: 'Every Monday at 9am: applications sent, replies in, top-performing template. Read in 30 seconds.' },
    ],
  },
  {
    num: '04', title: 'Workflow', subtitle: 'Fits the rest of your stack.',
    desc: 'Freelanly slots into your existing workflow — Notion, Calendly, Slack, your CRM.',
    features: [
      { title: 'Calendar booking', desc: 'Embed your Calendly / Cal.com link in cover letters. "Yes" replies go straight to a booked call.' },
      { title: 'Portfolio integration', desc: 'Plug in your portfolio URL once. AI picks the most relevant project to mention per job.' },
      { title: 'Slack notifications', desc: 'Pipe new replies into your personal Slack. Or a team channel. Or a Discord.' },
      { title: 'Data export & portability', desc: 'CSV-export every application, reply, contact, template — anytime. Your data stays yours.' },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div style={{ background: '#0A0B0F', color: '#FAFAFA' }}>
      <MarketingNav />

      <header className="pt-28 pb-16">
        <div className="max-w-[1240px] mx-auto px-8 text-center">
          <span className="font-mono text-xs tracking-widest uppercase text-[#C7F94A]">— Features</span>
          <h1 className="text-[clamp(40px,5.5vw,68px)] font-semibold tracking-tighter mt-4 mb-5 leading-none">
            Every tool you need to<br />land more work.
          </h1>
          <p className="text-[19px] text-[#D4D4D8] leading-relaxed max-w-[60ch] mx-auto">
            Twenty-two product features grouped into four pillars: discovery, outreach, tracking, and workflow.
          </p>
        </div>
      </header>

      {pillars.map(pillar => (
        <section key={pillar.num} className="py-20" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="max-w-[1240px] mx-auto px-8">
            <div className="mb-12">
              <span className="font-mono text-xs tracking-widest uppercase text-[#A1A1AA]">— Pillar {pillar.num} — {pillar.title}</span>
              <h2 className="text-[clamp(30px,3.5vw,44px)] font-semibold tracking-tighter mt-4 mb-3">{pillar.subtitle}</h2>
              <p className="text-[17px] text-[#D4D4D8] max-w-[60ch]">{pillar.desc}</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pillar.features.map(f => (
                <div key={f.title} className="p-6 rounded-[14px] hover:border-white/15 transition-colors" style={{ background: '#0E1016', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <h3 className="text-[16px] font-semibold tracking-tight mb-2">{f.title}</h3>
                  <p className="text-[14px] text-[#A1A1AA] leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* Manual vs Freelanly */}
      <section className="py-20" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-[900px] mx-auto px-8">
          <div className="mb-10 text-center">
            <span className="font-mono text-xs tracking-widest uppercase text-[#A1A1AA]">— Why not just…</span>
            <h2 className="text-[clamp(30px,3.5vw,44px)] font-semibold tracking-tighter mt-4">Manual outreach vs. Freelanly</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-7 rounded-[14px]" style={{ background: '#0E1016', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="font-mono text-[11px] tracking-widest uppercase text-[#6B7280] mb-4">Doing it yourself</div>
              <ul className="space-y-3 text-[14px] text-[#A1A1AA]">
                {['Refresh job boards, miss the fresh posts', 'Write each cover letter from scratch', 'Send, then forget about it', 'No follow-ups, no tracking', 'Burn out after 2 weeks'].map(t => (
                  <li key={t} className="flex items-start gap-2.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2.5" className="mt-0.5 flex-shrink-0"><path d="M18 6L6 18M6 6l12 12" /></svg>{t}</li>
                ))}
              </ul>
            </div>
            <div className="p-7 rounded-[14px]" style={{ background: '#0E1016', border: '2px solid rgba(199,249,74,0.3)' }}>
              <div className="font-mono text-[11px] tracking-widest uppercase text-[#C7F94A] mb-4">Freelanly</div>
              <ul className="space-y-3 text-[14px] text-[#D4D4D8]">
                {['Fresh posts arrive within hours', 'AI drafts a personalized letter in 2 seconds', 'Sent from your inbox at the right time', '2 follow-ups, tracking — automatic', 'Runs forever, even on weeks you don\'t'].map(t => (
                  <li key={t} className="flex items-start gap-2.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C7F94A" strokeWidth="2.5" className="mt-0.5 flex-shrink-0"><path d="M20 6L9 17l-5-5" /></svg>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <MarketingCTA />
      <MarketingFooter />
    </div>
  );
}
