import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateCoverLetter, generateSubjectLine } from '@/services/cover-letter-generator';
import { assessPairing } from '@/services/matching/assess-pairing';
import { assessPairingCached, profileStamp } from '@/services/matching/assess-pairing-cached';
import { generateRecruiterRationale } from '@/services/matching/recruiter-rationale';
import { sendEmailViaSMTP } from '@/lib/smtp-sender';
import { sendAutoApplyViaPostal } from '@/lib/email/postal';
import { consumeApplyQuota, refundApplyQuota, FREE_DAILY_APPLY_LIMIT } from '@/lib/apply-quota';
import { escapeHtml } from '@/lib/html-escape';
import { fetchResumeAttachment, hasRealCV } from '@/lib/resume-attachment';
import { getRecruiterPortalUrl } from '@/lib/recruiter-token';
import { isBlockedApplyEmail } from '@/config/blocked-apply-domains';
import { isFreeEmailProvider } from '@/lib/content-quality';
import { buildFitContext, scoreFit } from '@/lib/fit-score';
import { getUserEmbedding, semanticRankIds } from '@/services/embeddings/semantic-rank';

const FREE_DAILY_LIMIT = 20;

/**
 * Short AI summary shown on the draft/review screen after the profile is analyzed: who the
 * candidate is, how they fit THIS role, and other roles they'd be a strong fit for. Best-effort
 * (returns null on any failure) — never blocks the draft.
 */
async function generateCandidateSummary(
  profile: Record<string, unknown> | null,
  jobTitle: string,
  jobDescription: string,
  matchLabel: string | null,
  matchReason: string,
): Promise<{ who: string; fit: string; otherRoles: string[] } | null> {
  if (!profile) return null;
  try {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ baseURL: 'https://api.z.ai/api/paas/v4', apiKey: process.env.ZAI_API_KEY || '' });
    const skills = ((profile.skills as string[]) || []).slice(0, 15).join(', ');
    const prompt = `Candidate:
- Current title: ${profile.current_title || '—'}
- Field: ${profile.field || '—'}
- Experience: ${profile.experience_years ?? '—'} years
- Skills: ${skills || '—'}
- Summary: ${(profile.summary as string) || '—'}

Target role: ${jobTitle}
Role description: ${jobDescription.slice(0, 600)}

Our matcher rated this candidate↔role pairing as: "${matchLabel || 'unrated'}" match${matchReason ? ` (reason: ${matchReason})` : ''}.
Your "fit" sentence MUST be consistent with that rating — never oversell. If the match is Weak/poor,
say plainly that this role is a stretch and WHY (e.g. it's in a different field than the candidate's
background). If it's Strong, explain why it's a great fit. The "otherRoles" should be roles that
genuinely match the candidate's actual background (not the target role's field if it doesn't fit).

Return ONLY JSON, no markdown:
{"who":"one punchy sentence on who this candidate is professionally","fit":"1-2 sentences, consistent with the match rating: how well they fit THIS specific role and why","otherRoles":["3-5 specific job titles this candidate is genuinely a strong fit for"]}`;
    const r = await client.chat.completions.create({
      model: 'glm-4-32b-0414-128k', temperature: 0.4, max_tokens: 320,
      messages: [
        { role: 'system', content: 'You are a concise, BRUTALLY HONEST career analyst. Never inflate fit. Return ONLY valid JSON.' },
        { role: 'user', content: prompt },
      ],
    });
    const m = (r.choices[0]?.message?.content || '').match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]);
    return {
      who: String(parsed.who || '').slice(0, 240),
      fit: String(parsed.fit || '').slice(0, 320),
      otherRoles: Array.isArray(parsed.otherRoles) ? parsed.otherRoles.slice(0, 5).map((s: unknown) => String(s)) : [],
    };
  } catch {
    return null;
  }
}

/**
 * Roles that genuinely fit this candidate — shown when THIS role is a weak match, so we steer the
 * user toward applications a recruiter will actually answer instead of spamming a mismatch.
 *
 * Two stages, no arbitrary pool cap:
 *  1) Cheap lexical fit-score over the WHOLE 14-day base (no LLM): skill overlap + title/field token
 *     overlap. Runs in code over a few thousand light rows in milliseconds, so every category — even
 *     a 5%-of-base one like project-management — is fully considered. Take the top ~10 by score.
 *  2) Strict vet: run those few through the SAME assessPairing the apply-flow uses on click, so a
 *     suggestion is only surfaced if the real matcher won't reject it (decision !== 'NO'). Take 4.
 * We do NOT filter by the user's loop categories — those get contaminated by the very role they're
 * applying to (a PM applying to a Web Developer post seeds an "engineering" loop).
 */
async function findFittingOpportunities(
  userId: string,
  excludeOpportunityId: string,
  profile: Record<string, unknown> | null,
  cvText: string,
  hasRealCV: boolean,
): Promise<{ slug: string; title: string; company: string }[]> {
  try {
    if (!profile) return [];

    const applied = await prisma.autoApplication.findMany({
      where: { userId }, select: { opportunityId: true },
    });
    const appliedIds = applied.map(a => a.opportunityId).filter(Boolean) as string[];

    // Full 14-day base, light fields only — no take/limit. Scoring happens in code below.
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const pool = await prisma.opportunity.findMany({
      where: {
        isActive: true,
        applyEmail: { not: null },
        createdAt: { gte: since },
        id: { notIn: [excludeOpportunityId, ...appliedIds] },
      },
      select: { id: true, slug: true, title: true, skills: true },
    });
    if (pool.length === 0) return [];

    // Stage 1 — lexical fit score (no LLM) over the whole base.
    const fitCtx = buildFitContext(profile);
    const lex = pool
      .map((o) => ({ o, score: scoreFit(fitCtx, o) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);

    if (lex.length === 0) return [];

    // Stage 1b — semantic re-rank (behind FEED_SEMANTIC_RANK): fit-scoring is lexical and can't tell
    // "Project Manager" (fits) from "Salesforce Project Manager" (doesn't) — both score on
    // project+manager. Re-rank the lexical shortlist by MEANING so the genuinely-fitting roles rise to
    // the top of the vet queue. Falls back to pure lexical when off / user unembedded.
    let ordered = lex;
    const SEMANTIC = process.env.FEED_SEMANTIC_RANK === '1' || process.env.FEED_SEMANTIC_RANK === 'on';
    if (SEMANTIC) {
      const userVec = await getUserEmbedding(userId);
      if (userVec) {
        const shortlist = lex.slice(0, 60);
        const sims = await semanticRankIds(userVec, shortlist.map(x => x.o.id));
        if (sims.size) {
          ordered = shortlist.slice().sort((a, b) =>
            ((sims.get(b.o.id) ?? -1) - (sims.get(a.o.id) ?? -1)) || (b.score - a.score),
          );
        }
      }
    }

    // Vet DEEPER than the top handful: even after re-rank, gate in score-order batches and stop as soon
    // as 4 pass — cheap for the common case (fits sit at the top), deep enough to rescue the niche case.
    const VET_CAP = 24, VET_BATCH = 8, WANT = 4;
    const cand = ordered.slice(0, VET_CAP).map(x => x.o);
    const full = await prisma.opportunity.findMany({
      where: { id: { in: cand.map(t => t.id) } },
      select: { id: true, slug: true, title: true, description: true, country: true, clientName: true, posterCompany: true, company: { select: { name: true } } },
    });
    const byId = new Map(full.map(o => [o.id, o]));

    // Stage 2 — vet through the SAME assessPairing the apply-flow runs on click, so a suggestion is
    // only shown if the real matcher would NOT reject it. Score-order batches with early stop at 4.
    const kept: { slug: string; title: string; company: string }[] = [];
    for (let i = 0; i < cand.length && kept.length < WANT; i += VET_BATCH) {
      const batch = cand.slice(i, i + VET_BATCH);
      const results = await Promise.all(batch.map(async (t) => {
        const o = byId.get(t.id);
        if (!o) return null;
        try {
          const pr = await assessPairing({
            jobTitle: o.title, jobDescription: o.description, jobCountry: o.country,
            profile, cvText, hasRealCV,
          });
          return pr.decision !== 'NO' ? o : null;
        } catch {
          return null;
        }
      }));
      for (const o of results) {
        if (o && kept.length < WANT) kept.push({ slug: o.slug, title: o.title, company: o.company?.name || o.posterCompany || o.clientName || '' });
      }
    }
    return kept;
  } catch {
    return [];
  }
}

/**
 * POST /api/user/quick-apply
 * One-click apply to a specific opportunity from the project page.
 * Body: { opportunityId: string }
 * Returns: { success, coverLetter, subject } or error
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { opportunityId, jobId, editedCoverLetter, editedSubject, draftOnly, summaryOnly, coverLetter: providedCoverLetter, subject: providedSubject } = body;
    if (!opportunityId && !jobId) {
      return NextResponse.json({ error: 'opportunityId or jobId required' }, { status: 400 });
    }

    // Get user with SMTP and profile
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        resumeText: true,
        resumeUrl: true,
        resumeFileName: true,
        parsedProfile: true,
        location: true,
        workAuthorization: true,
        currentRate: true,
        salaryExpectation: true,
        availableFrom: true,
        freeAppliesUsedToday: true,
        lastFreeApplyReset: true,
        userSmtp: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const hasSmtp = !!user.userSmtp?.verified;

    // Check resume
    if (!user.resumeText && !user.parsedProfile) {
      return NextResponse.json({ error: 'resume_required', message: 'Upload your resume first.' }, { status: 400 });
    }

    // Check free daily limit
    if (user.plan === 'FREE') {
      const now = new Date();
      const lastReset = new Date(user.lastFreeApplyReset);
      const isNewDay = now.getUTCDate() !== lastReset.getUTCDate() ||
        now.getUTCMonth() !== lastReset.getUTCMonth() ||
        now.getUTCFullYear() !== lastReset.getUTCFullYear();

      const usedToday = isNewDay ? 0 : (user.freeAppliesUsedToday || 0);
      if (usedToday >= FREE_DAILY_LIMIT) {
        return NextResponse.json({
          error: 'limit_reached',
          message: `Daily limit reached (${FREE_DAILY_LIMIT}/${FREE_DAILY_LIMIT}). Upgrade to PRO for unlimited applies.`,
        }, { status: 429 });
      }
    }

    // Get opportunity
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: {
        id: true,
        title: true,
        description: true,
        clientName: true,
        clientType: true,
        posterCompany: true,
        applyEmail: true,
        category: { select: { slug: true } },
        company: { select: { name: true } },
      },
    });

    if (!opportunity || !opportunity.applyEmail) {
      return NextResponse.json({ error: 'Opportunity not found or no email' }, { status: 404 });
    }

    // Global apply blocklist (spam farms / banned senders) — the inline path must honour the same
    // block as the matcher/import, so a blocked address can't be reached via manual apply either.
    if (isBlockedApplyEmail(opportunity.applyEmail)) {
      return NextResponse.json({ error: 'unavailable', message: 'This project is no longer available.' }, { status: 410 });
    }

    // Free-domain demand is dropped (decision 2026-06): import/match/send already block it; this
    // closes the last door — old free-domain opportunities still inside the 30-day storage window
    // could otherwise be reached via inline apply.
    if (isFreeEmailProvider(opportunity.applyEmail)) {
      return NextResponse.json({ error: 'unavailable', message: 'This project is no longer available.' }, { status: 410 });
    }

    // Check if already applied
    const existing = await prisma.autoApplication.findFirst({
      where: {
        userId: user.id,
        opportunityId: opportunity.id,
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'already_applied', message: 'You already applied to this project.' }, { status: 409 });
    }

    // Resolve company name vs recruiter name
    const emailDomain = opportunity.applyEmail?.split('@')[1] || '';
    const isCorpEmail = emailDomain && !['gmail.com','yahoo.com','hotmail.com','outlook.com','live.com','aol.com','icloud.com','mail.com','protonmail.com','yandex.com','zoho.com'].includes(emailDomain);
    const companyFromDomain = isCorpEmail ? emailDomain.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';

    const companyName = opportunity.company?.name
      || opportunity.posterCompany
      || (opportunity.clientType === 'company' ? opportunity.clientName : null)
      || companyFromDomain
      || 'the hiring team';

    // Extract recruiter name: from clientName or from email local part
    let recruiterName = '';
    if (opportunity.clientType === 'profile' && opportunity.clientName) {
      recruiterName = opportunity.clientName.split(' ')[0];
    } else if (opportunity.applyEmail) {
      const localPart = opportunity.applyEmail.split('@')[0];
      // Extract first name from email like nishtha.saretha or john_doe
      const namePart = localPart.split(/[._-]/)[0];
      if (namePart.length >= 3 && namePart !== 'info' && namePart !== 'hr' && namePart !== 'careers' && namePart !== 'jobs' && namePart !== 'hiring' && namePart !== 'recruit' && namePart !== 'admin' && namePart !== 'contact' && namePart !== 'hello' && namePart !== 'apply' && namePart !== 'support') {
        recruiterName = namePart.charAt(0).toUpperCase() + namePart.slice(1).toLowerCase();
      }
    }

    // Assess the pairing with the SAME verifier + gate + verdict as the autonomous matcher, so a
    // self-apply gets an honest cover + a stored breakdown (no more "—" record, no over-promising).
    const profile = user.parsedProfile as Record<string, unknown> | null;
    // Cached gate: reuse a recent verdict for this (user × opportunity) → no 5-7s recompute on a repeat
    // click, no repeat LLM cost, AND every verdict (incl. NO) gets persisted so the feed can hide what
    // apply would reject. Fail-open: a cache miss/error just runs the live assessment.
    const pairing = await assessPairingCached(
      { userId: user.id, opportunityId: opportunity.id, stamp: profileStamp({ resumeUrl: user.resumeUrl, skills: profile?.skills as string[], title: profile?.current_title as string }) },
      { jobTitle: opportunity.title, jobDescription: opportunity.description, jobCountry: null, profile, cvText: user.resumeText || '', hasRealCV: hasRealCV(user) },
    );
    // Gate: block BOTH the cover-letter generation (draftOnly) AND the send when the verdict is NO.
    // Blocking only the send wasted a cover-letter LLM call (money) and led to a contradictory UX —
    // the user wrote/reviewed a letter, then got refused at "Send". If we won't send it, don't let
    // them spend on writing it: stop at the draft. summaryOnly still passes (it's just the verdict
    // card, no letter). The weak-match card uses the `gated` flag below to not even offer the path.
    const enforceGate = process.env.MATCH_GATE_ENFORCE !== '0';
    if (!summaryOnly && enforceGate && pairing.decision === 'NO') {
      return NextResponse.json({ error: 'poor_match', message: `This role isn't a strong enough match for your profile (${pairing.reason}).` }, { status: 422 });
    }

    // SUMMARY-ONLY: return the candidate summary card (who they are + fit + other roles) WITHOUT
    // writing the cover letter. The user reads this first, then clicks through to generate the
    // application — so we don't spend the cover-letter LLM call until they actually proceed.
    if (summaryOnly) {
      // Tier drives the verdict copy on the summary card: strong/good → "write my application";
      // weak → honest "this one's a stretch, recruiters skip mismatches" + roles that actually fit.
      const isWeak = pairing.decision === 'NO' || /weak|poor/i.test(pairing.label || '');
      const tier = isWeak ? 'weak' : (/strong/i.test(pairing.label || '') ? 'strong' : 'good');
      const [matchSummary, suggestions] = await Promise.all([
        generateCandidateSummary(profile, opportunity.title, opportunity.description, pairing.label || null, pairing.reason || ''),
        isWeak ? findFittingOpportunities(user.id, opportunity.id, profile, user.resumeText || '', hasRealCV(user)) : Promise.resolve([]),
      ]);
      return NextResponse.json({
        ok: true,
        matchSummary,
        matchLabel: pairing.label || null,
        tier,
        suggestions,
        // gated = a real SEND would be refused (hard NO + gate on). The card uses this to NOT offer
        // "Apply here anyway" (which would only generate a letter and then be blocked). A weak-but-
        // sendable verdict (decision !== NO) leaves gated=false, so "Apply here anyway" still works.
        gated: enforceGate && pairing.decision === 'NO',
        to: opportunity.applyEmail,
      });
    }

    // Use provided text or generate new
    let coverLetter: string;
    if (providedCoverLetter || editedCoverLetter) {
      coverLetter = providedCoverLetter || editedCoverLetter;
    } else {
      coverLetter = await generateCoverLetter({
        jobTitle: opportunity.title,
        jobDescription: opportunity.description.slice(0, 800),
        companyName,
        userProfile: {
          name: user.name || 'Applicant',
          skills: (profile?.skills as string[]) || [],
          experience: (user.resumeText || '').slice(0, 300),
          resumeText: user.resumeText || undefined,
          recruiterEmail: opportunity.applyEmail,
        } as any,
        verdict: pairing.verdict, // honest mode + missing-strip
      });
    }

    const subject = providedSubject || editedSubject || await generateSubjectLine({
      jobTitle: opportunity.title,
      userName: user.name || 'Applicant',
    });

    // Build full letter with greeting and signature.
    // NEVER include the user's email in the body — replies must route through us
    // (apply@ From + reply+{appId}@ Reply-To), so exposing it would let recruiters
    // contact the user directly, off-platform.
    // The AI-generated letter already opens with a greeting; only prepend one when the
    // body lacks it (e.g. user-pasted text) — otherwise we get "Hi X,\nHi there," dupes.
    const hasGreeting = /^\s*(hi|hello|dear|hey)\b/i.test(coverLetter);
    const greeting = hasGreeting ? '' : (recruiterName ? `Hi ${recruiterName},\n\n` : 'Hi there,\n\n');
    const signature = `Best regards,\n${user.name || 'Applicant'}`;
    // ATS-checklist footer: the exact fields recruiters re-ask for on the first reply (location, work
    // auth, current + expected pay, availability). Collected in the signup form; attached here so the
    // recruiter has them up front and skips the "share these details" round. No email/phone (replies
    // route through us). Each is the candidate's OWN self-reported value — never an email.
    const details = [
      user.location && `Location: ${user.location}`,
      user.workAuthorization && `Work authorization: ${user.workAuthorization}`,
      user.currentRate && `Current rate: ${user.currentRate}`,
      user.salaryExpectation && `Expected rate: ${user.salaryExpectation}`,
      user.availableFrom && `Availability: ${user.availableFrom}`,
    ].filter(Boolean);
    const detailsBlock = details.length ? `\n\n—\n${details.join('\n')}` : '';
    const fullLetter = `${greeting}${coverLetter}\n\n${signature}${detailsBlock}`;

    // Draft-only mode: return full letter as user will see it
    if (draftOnly) {
      // Summary card is fetched separately first (summaryOnly) — here we only return the letter.
      return NextResponse.json({ ok: true, coverLetter: fullLetter, subject, to: opportunity.applyEmail });
    }

    // Recruiter-voice rationale for the admin audit card — generated ONLY on a real send (after the
    // draft-return above, so the inline preview stays fast). Frozen into the stored breakdown.
    if (pairing.matchBreakdown && pairing.verdict) {
      const rr = await generateRecruiterRationale({
        jobTitle: opportunity.title, jobDescription: opportunity.description,
        candidateTitle: (profile?.current_title as string) || null,
        candidateYears: typeof profile?.experience_years === 'number' ? (profile.experience_years as number) : null,
        candidateSkills: (profile?.skills as string[]) || [], candidateBackground: user.resumeText || '',
        matched: pairing.verdict.matchedSkills || [], missingCore: pairing.verdict.missingCore || [], missing: pairing.verdict.missing || [],
        profession: (pairing.matchBreakdown.profession as string) || null,
        matchedN: (pairing.matchBreakdown.matched as number) ?? 0, totalN: (pairing.matchBreakdown.total as number) ?? 0,
      });
      if (rr) pairing.matchBreakdown.recruiterReasoning = rr;
    }

    // Use user-edited text if provided, otherwise use assembled fullLetter
    const finalText = providedCoverLetter || editedCoverLetter || fullLetter;

    // Attach the candidate's CV (Blob PDF) + link the recruiter portal — so self-apply carries the
    // same payload the auto-apply card did (CV + "view all candidates"), the two biggest recruiter asks.
    const cv = await fetchResumeAttachment(user.resumeUrl, user.resumeFileName || undefined);
    const portalUrl = getRecruiterPortalUrl(opportunity.applyEmail);
    const safeName = escapeHtml(user.name || 'this candidate');
    // Subtle, professional footer — Gmail already shows the attachment chip, so don't repeat "CV
    // attached" as loud body text; just a clean text link (acid underline, not a neon button).
    const footerHtml = `
  <div style="margin-top: 24px; padding-top: 14px; border-top: 1px solid #eee; font-size: 13px; color: #888;">
    <a href="${portalUrl}" style="color: #1a1a1a; font-weight: 600; text-decoration: none; border-bottom: 2px solid #C7F94A; padding-bottom: 1px;">View ${safeName}'s full profile${cv ? ' &amp; CV' : ''} &rarr;</a>
  </div>`;
    const footerText = `\n\n—\nView ${user.name || 'this candidate'}'s full profile${cv ? ' & CV' : ''}: ${portalUrl}`;

    // Render the cover letter as clean flowing paragraphs: split on blank lines (real paragraph
    // breaks) and collapse the AI's mid-sentence hard-wrap newlines into spaces — otherwise every
    // wrapped line became its own gapped <p>, chopping sentences ("…a proven" / "track record…").
    const paragraphs = finalText
      .split(/\n\s*\n/).map((b: string) => b.trim()).filter(Boolean)
      .map((b: string) => `<p style="margin: 0 0 14px; line-height: 1.6;">${escapeHtml(b).replace(/\s*\n\s*/g, ' ')}</p>`)
      .join('');

    // Build HTML from final text
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; font-size: 15px; line-height: 1.6;">
  ${paragraphs}
  ${footerHtml}
</body>
</html>`.trim();

    const text = finalText + footerText;

    // Atomically consume the FREE daily quota slot BEFORE sending. The check at the
    // top is a fast UX pre-check only; THIS is the real gate — TOCTOU-safe and covers
    // the Postal branch, which previously never incremented the counter (→ unlimited).
    if (!(await consumeApplyQuota(user.id, user.plan))) {
      return NextResponse.json({
        error: 'limit_reached',
        message: `Daily limit reached (${FREE_DAILY_APPLY_LIMIT}/${FREE_DAILY_APPLY_LIMIT}). Upgrade to PRO for unlimited applies.`,
      }, { status: 429 });
    }

    // Send via user's SMTP or Postal
    let result: { success: boolean; messageId?: string; error?: string };

    if (hasSmtp) {
      const smtp = user.userSmtp!;
      result = await sendEmailViaSMTP(
        { host: smtp.host, port: smtp.port, email: smtp.email, password: smtp.password },
        {
          from: `${user.name || 'Applicant'} <${smtp.email}>`,
          to: opportunity.applyEmail,
          replyTo: smtp.email,
          subject,
          html,
          text,
          attachmentBase64: cv?.base64,
          attachmentFilename: cv?.filename,
        }
      );
    } else {
      // Create application record FIRST to get ID for reply routing
      let loop = await prisma.autoApplyLoop.findFirst({ where: { userId: user.id } });
      if (!loop) {
        loop = await prisma.autoApplyLoop.create({
          data: { userId: user.id, name: 'Quick Apply', jobTitles: [], dailyLimit: 50, mode: 'MANUAL', isActive: false },
        });
      }
      const appRecord = await prisma.autoApplication.create({
        data: {
          origin: 'SELF', // user clicked apply (quick-apply)
          userId: user.id, loopId: loop.id, opportunityId: opportunity.id,
          companyName: opportunity.clientName, jobTitle: opportunity.title,
          appliedToEmail: opportunity.applyEmail, coverLetter, subject,
          status: 'SENDING', sentVia: 'postal',
          matchLabel: pairing.label ?? undefined,
          matchBreakdown: pairing.matchBreakdown ? (pairing.matchBreakdown as Prisma.InputJsonValue) : undefined,
        },
      });

      result = await sendAutoApplyViaPostal({
        userName: user.name || 'Applicant',
        userEmail: user.email,
        to: opportunity.applyEmail,
        subject,
        html,
        text,
        applicationId: appRecord.id,
        attachmentBase64: cv?.base64,
        attachmentFilename: cv?.filename,
      });

      if (result.success) {
        await prisma.autoApplication.update({
          where: { id: appRecord.id },
          data: { status: 'SENT', sentAt: new Date() },
        });
      } else {
        await prisma.autoApplication.update({
          where: { id: appRecord.id },
          data: { status: 'FAILED', errorMessage: result.error?.slice(0, 500) },
        });
        await refundApplyQuota(user.id, user.plan); // send failed — give the slot back
        return NextResponse.json({ error: 'send_failed', message: result.error }, { status: 500 });
      }

      return NextResponse.json({ success: true, coverLetter: fullLetter, subject, sentTo: opportunity.applyEmail });
    }

    if (!result.success) {
      await refundApplyQuota(user.id, user.plan); // send failed — give the slot back
      return NextResponse.json({ error: 'send_failed', message: result.error }, { status: 500 });
    }

    // Create AutoApplication record for SMTP users
    let loop = await prisma.autoApplyLoop.findFirst({
      where: { userId: user.id },
    });

    if (!loop) {
      loop = await prisma.autoApplyLoop.create({
        data: {
          userId: user.id,
          name: 'Quick Apply',
          jobTitles: [],
          dailyLimit: 50,
          mode: 'MANUAL',
          isActive: false,
        },
      });
    }

    await prisma.autoApplication.create({
      data: {
        origin: 'SELF', // user clicked apply (quick-apply, draft path)
        userId: user.id,
        loopId: loop.id,
        opportunityId: opportunity.id,
        companyName: opportunity.clientName,
        jobTitle: opportunity.title,
        appliedToEmail: opportunity.applyEmail,
        coverLetter,
        subject,
        status: 'SENT',
        sentVia: 'smtp',
        sentAt: new Date(),
        matchLabel: pairing.label ?? undefined,
        matchBreakdown: pairing.matchBreakdown ? (pairing.matchBreakdown as Prisma.InputJsonValue) : undefined,
      },
    });

    // (FREE quota was already consumed atomically before sending — see consumeApplyQuota)

    return NextResponse.json({
      success: true,
      coverLetter: fullLetter,
      subject,
      sentTo: opportunity.applyEmail,
    });
  } catch (error) {
    console.error('[QuickApply] Error:', error);
    return NextResponse.json({ error: 'Failed to apply' }, { status: 500 });
  }
}
