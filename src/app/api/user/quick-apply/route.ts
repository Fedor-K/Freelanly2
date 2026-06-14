import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateCoverLetter, generateSubjectLine } from '@/services/cover-letter-generator';
import { assessPairing } from '@/services/matching/assess-pairing';
import { generateRecruiterRationale } from '@/services/matching/recruiter-rationale';
import { sendEmailViaSMTP } from '@/lib/smtp-sender';
import { sendAutoApplyViaPostal } from '@/lib/email/postal';
import { consumeApplyQuota, refundApplyQuota, FREE_DAILY_APPLY_LIMIT } from '@/lib/apply-quota';
import { escapeHtml } from '@/lib/html-escape';
import { isBlockedApplyEmail } from '@/config/blocked-apply-domains';
import { isFreeEmailProvider } from '@/lib/content-quality';

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

/** Significant lowercase tokens (drops stopwords + short noise) for lexical overlap scoring. */
function fitTokens(s: string): string[] {
  const stop = new Set(['the','and','for','with','our','your','you','are','will','that','this','from','into','remote','full','time','part','job','role','position','team','work','senior','junior','mid','lead','i','ii','iii']);
  return (s.toLowerCase().match(/[a-z][a-z+#.]{2,}/g) || []).filter(t => !stop.has(t));
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
    const candSkills = new Set(((profile.skills as string[]) || []).map(s => s.toLowerCase().trim()).filter(Boolean));
    const candTitleTokens = new Set([
      ...fitTokens(typeof profile.current_title === 'string' ? profile.current_title : ''),
      ...fitTokens(typeof profile.field === 'string' ? profile.field : ''),
    ]);

    const scored = pool.map((o) => {
      const oppSkills = (o.skills || []).map(s => s.toLowerCase().trim());
      const oppTitleTokens = fitTokens(o.title);
      let skillScore = 0;
      for (const s of candSkills) if (oppSkills.includes(s) || o.title.toLowerCase().includes(s)) skillScore++;
      let titleScore = 0;
      for (const t of oppTitleTokens) if (candTitleTokens.has(t)) titleScore++;
      // Title overlap is the stronger signal of role-fit (a "Project Manager" matching a PM), skills second.
      return { o, score: titleScore * 3 + skillScore };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);

    if (scored.length === 0) return [];
    const top = scored.slice(0, 10).map(x => x.o);

    // Fetch full records (incl. description) only for the top-scored handful, for the strict vet.
    const full = await prisma.opportunity.findMany({
      where: { id: { in: top.map(t => t.id) } },
      select: { id: true, slug: true, title: true, description: true, country: true, clientName: true, posterCompany: true, company: { select: { name: true } } },
    });
    const byId = new Map(full.map(o => [o.id, o]));

    // Stage 2 — vet each through the SAME assessPairing the apply-flow runs on click, so a suggestion
    // is only shown if the real matcher would NOT reject it. Preserve fit-score order, take 4.
    const vetted = await Promise.all(top.map(async (t) => {
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
    return vetted.filter(Boolean).slice(0, 4).map((o) => ({
      slug: o!.slug, title: o!.title, company: o!.company?.name || o!.posterCompany || o!.clientName || '',
    }));
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
        parsedProfile: true,
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
    const pairing = await assessPairing({
      jobTitle: opportunity.title, jobDescription: opportunity.description, jobCountry: null,
      profile, cvText: user.resumeText || '', hasRealCV: !!user.resumeText,
    });
    // Gate: block an actual SEND (not a draft preview) when the verdict is NO.
    const enforceGate = process.env.MATCH_GATE_ENFORCE !== '0';
    if (!draftOnly && !summaryOnly && enforceGate && pairing.decision === 'NO') {
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
        isWeak ? findFittingOpportunities(user.id, opportunity.id, profile, user.resumeText || '', !!user.resumeText) : Promise.resolve([]),
      ]);
      return NextResponse.json({
        ok: true,
        matchSummary,
        matchLabel: pairing.label || null,
        tier,
        suggestions,
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
    const fullLetter = `${greeting}${coverLetter}\n\n${signature}`;

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

    // Build HTML from final text
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; font-size: 15px; line-height: 1.6;">
  ${finalText.split('\n').filter((p: string) => p.trim()).map((p: string) => `<p style="margin: 0 0 12px; line-height: 1.6;">${escapeHtml(p)}</p>`).join('')}
</body>
</html>`.trim();

    const text = finalText;

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
