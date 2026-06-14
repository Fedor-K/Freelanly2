# Auto-Apply Deep Audit (2026-05-24)

Deep correctness + security review of the entire auto-apply subsystem (config → matching → sending → replies/follow-ups → inline-apply). 5 parallel reviewers; the highest-impact CRITICALs were **re-verified by hand in code** (marked ✓).

## Executive verdict
The subsystem *does* send applications, but **most of its configured controls and guarantees are not actually enforced**:
- The FREE 20/day cap is **not enforced** on the main path (and is bypassable/racy on every path).
- It can **double-send** to recruiters under concurrency; replies are **mis-attributed**; follow-up cadence ignores its own config; send-schedule/timezone/bounce limits are **dead config**.
- `apply-all` **crashes** on every call; ATS Jobs are **never** auto-applied.
- SMTP passwords are stored **plaintext**; user content goes into outbound email **unescaped**.

Treat the feature as "best-effort AI blast," not "applies to what the user configured, within their free limit." Below, severity is for the auto-apply subsystem specifically.

---

## CRITICAL

**A1. FREE 20/day cap is not enforced on the primary (Postal) apply path** ✓verified
`src/app/api/user/quick-apply/route.ts:196-236` — the Postal branch (default for users without their own SMTP = almost all inline applicants) creates + sends + `return`s at line 236, **before** the `freeAppliesUsedToday` increment block at :277-292 (which is only on the SMTP path). So the counter never moves → the cap check (:57-71) always sees 0 → **unlimited free applies**. Compounded by:
- `apply-all` (:69-90) and the processor (`auto-apply-processor.ts:214`) never check the 20 cap either (processor gates only on `loop.dailyLimit`, default 50). ✓
- The check is read-then-write with no atomicity → parallel requests all pass (TOCTOU).
Impact: the headline monetization constraint doesn't exist; unlimited outbound from `apply@freelanly.com` (revenue leak + deliverability/spam risk).
Fix: one shared `enforceAndConsumeApplyQuota(userId)` used by quick-apply (both branches), apply-all, and the processor; consume atomically (`updateMany where freeAppliesUsedToday < 20`) before sending.

**A2. ~~Loop criteria ignored~~ — RETRACTED: this is by design (verified against prod data)**
Original finding claimed matching ignores loop `jobTitles/keywords/country/level/salary` and rate floor. After review this is **correct behavior, not a bug.** Matching (`queueAutoApplyForListing`, `:663-738`) deliberately relies on an AI check (`aiMatchCheck`, `:518-571`) of the post's **title + description** + the applicant's résumé/location/languages — because the structured fields aren't reliably present in scraped LinkedIn posts. Prod data (31,964 active opportunities, 2026-05-24): `country` present **47%**, `level` non-default only **26%**, and `salaryMin` is **87% AI-estimated** (only 13% real). Hard-matching on those would discard or misjudge most of the pool. `aiMatchCheck` already enforces the meaningful gates from text: *"onsite/hybrid in a different country → score 0; remote ok for anyone"*, language must match (translation roles), and seniority (student vs 5+ yrs). `calculateMatchScore` (which used titles/level/country) is dead code from the abandoned structured approach.
Residual (minor, OPTIONAL — not correctness bugs): the loop's explicit `jobTitles`/`keywords` aren't used even as a cheap pre-filter against the (always-present) title/description, and `rateFloorHourly/Project` could be honored for just the 13% with `salaryIsEstimate=false`. The genuinely-valid matching bugs are independent of the design and listed under MEDIUM: aiMatchCache cross-user key, matchThreshold==0 bypass, excludeKeywords substring over-match.

**A3. `apply-all` crashes on every call (schema mismatch)** ✓verified
`src/app/api/user/discovery/apply-all/route.ts:35,46,78` use `where.source` and `select/use companyName` — but `Opportunity` has no `source` and no `companyName` (it has `sourceUrl/sourceId` and `clientName/posterCompany`). `companyName` is always selected → Prisma validation error → 500 every time. Even if fixed, this path bypasses blacklist/excludeKeywords/rate-floor/threshold/AI entirely (blindly queues PENDING).
Fix: use `clientName`; drop/remap `source`; route through `queueAutoApplyForListing` so guards apply.

**A4. No atomic PENDING→SENDING claim → duplicate sends to recruiters**
`auto-apply-processor.ts:88-132` (plain `findMany` on PENDING) + `:236-239` (unconditional `update` to SENDING). No `updateMany where status=PENDING` guard, no transaction. Two overlapping runs (Hetzner worker tick + a stray `process-auto-apply` route hit + retries) select & send the same rows → duplicate identical emails + double-counted limits. (The live trigger is an off-repo Hetzner worker whose serialization is unverified.)
Fix: `updateMany({where:{id,status:'PENDING'},data:{status:'SENDING'}})`; proceed only if `count===1`.

**A5. Reply attribution is unreliable; inbound webhook is spoofable** ✓(known b, broader)
`src/services/reply-checker.ts:243-301` — IMAP `SEARCH FROM "<recruiter>" SINCE <14d>` matches ANY email from that address (newsletters, auto-replies, a different role), ignores subject/thread; apps are grouped by `fromEmail` so one stray email flips **all** apps to that recruiter → false REPLIED/INTERVIEW with wrong body + 🎉 notification (email+Telegram+Slack). No SPAM/auto-reply class in the IMAP categorizer (defaults to REPLIED). No idempotency (time-window notification query → duplicate alerts on overlap). Separately, `webhooks/inbound-reply` is unauthenticated unless `POSTAL_WEBHOOK_SECRET` is set (the hook I added is no-op until configured) — a forged POST to `reply+{appId}@…` can flip a victim's status, inject a recruiter Message, and email them attacker content with `replyTo: attacker`.
Fix: retire IMAP polling in favor of the `reply+{appId}` webhook, or match by `Message-ID`/`In-Reply-To` + per-mailbox UID tracking; **set POSTAL_WEBHOOK_SECRET** + validate `from` domain; share one categorizer (with SPAM/OOO/bounce handling) across both paths.

**A6. SMTP password stored in plaintext** ✓verified (schema lies)
`prisma/schema.prisma:1930` says "encrypted at application level" but there is **no** encryption anywhere; `api/user/smtp/route.ts:88` writes the raw password and `smtp-sender.ts` reads it raw. A DB dump leaks every user's Gmail app-password / SMTP credential. GET also returns the last 4 chars to the client (:22-32).
Fix: AES-256-GCM with a `SMTP_ENCRYPTION_KEY`; never return any password fragment (return `hasPassword: boolean`).

**A7. Unescaped user content → HTML/header injection into outbound email** ✓verified
`quick-apply/route.ts:169-176` interpolates `finalText` (user-editable cover letter) into `<p>${p}</p>` with no escaping, and `subject` goes verbatim to Postal; `sendAutoApplyViaPostal` lacks the recipient/subject sanitization that `sendEmail` has. A user can send attacker-shaped HTML/links from `apply@freelanly.com`.
Fix: HTML-escape body, strip CR/LF from subject, cap lengths, validate/sanitize recipient on both Postal helpers.

---

## HIGH

**B1. ATS Jobs are never auto-applied** — `queueAutoApplyForJob` has zero callers; `matchAndQueueAutoApplies` queries `opportunity` only. Half the stated scope is dead.

**B2. `resume-preauth` is unauthenticated** (`api/user/resume-preauth/route.ts`) — user-enumeration oracle (differential 404 vs 400) + triggers billable Apify LinkedIn scrapes per request with no rate limit. Add a signed token / IP throttle; validate input before the DB lookup.

**B3. SavedFeeds IDOR + mass-assignment** (`api/user/saved-feeds/route.ts:86-115`) — PATCH/DELETE have no `userId` scoping (any user edits/deletes another's feed by id), and PATCH spreads raw body into `update` (can set `userId` etc.). Scope by session user; allowlist fields.

**B4. Cross-user references not validated** — `templateId` on a loop (`api/user/auto-apply/route.ts:122,197`) and `edit-sequence` loop update (`[id]/route.ts:380-391`) don't verify the referenced template/loop belongs to the caller; `followUpDay1/2` unbounded.

**B5. Send schedule / timezone ignored** — `auto-apply-processor.ts` never reads `sendStartHour/EndHour/sendWeekdaysOnly/timezone`; emails fire 24/7 UTC (3am Sunday recruiter-local). Dead feature.

**B6. Bounce kill-switch ignored on auto-apply** — `emailBounceCount>=3` is honored only for alerts, never in the apply send path; and the bounce webhook matches the *applicant's* own email, so a dead applicant inbox keeps sending while their replies bounce.

**B7. Follow-up cadence ignores its own config** — `auto-apply-processor.ts:910-1018` hardcodes 3-day / 1 follow-up and **never reads** `followUpEnabled` (users who disabled it still get follow-ups), `followUpDay1`(4)/`followUpDay2`(8), or the 2-follow-up model. No daily-limit/send-window applied to follow-ups.

**B8. Automated status transitions are not monotonic** — webhook guards only INTERVIEW/OFFER; IMAP guards nothing → a later/SPAM reply regresses INTERVIEW/REJECTED back to REPLIED; pipeline KPIs corrupt.

**B9. Throttles leak** — hourly count (`:56-59`) filters statuses (SENT/OPENED/REPLIED/INTERVIEW) and misses DELIVERED/OFFER/FAILED → undercounts real sends → exceeds `MAX_PER_HOUR`. Per-recipient cap is per-batch + computed once at run start → not concurrency-safe.

**B10. Stale-send expiry can FAIL in-flight sends** — the top-of-run sweep flips `PENDING|REVIEW|SENDING` >24h to FAILED, so a slow in-flight SENDING can be marked FAILED (user sees false failure for an email that went out). Only expire PENDING/REVIEW; recover SENDING separately.

**B11. No rate limiting on quick-apply / draft-apply / apply-all** — `draft-apply` runs 2 paid LLM calls/request with only an auth check → cost-amplification DoS; apply-all has no per-user throttle.

**B12. Resume stored on public Vercel Blob with attacker-influenced path** (`api/user/resume/route.ts:119`, `resume-preauth:150`) — `access:'public'` + `resumes/{userId}/{file.name}` (PII exposure + path from unsanitized filename). Use private blob + signed URLs + UUID filename.

**B13. P2002 (duplicate) surfaces as 500** — quick-apply double-submit (the `?apply=1` auto-fire + no button disable) races the `findFirst` pre-check; the unique violation throws → generic 500 instead of 409, and a concurrent loser may already have sent a duplicate email.

---

## MEDIUM

- **`aiMatchCache` unbounded + cross-user key** (`:634,717`) — module-level Map never cleared (leak on warm worker) and key omits `userId` (top-5 skills+location) → users with overlapping skills share AI verdict/score written to *their* AutoApplication.
- **`appsUsedThisCycle` never incremented** — billing-cycle cap is cosmetic; PRO `appsPerMonth` unenforced.
- **matchThreshold check unsound** (`:220` `if (app.matchScore && …)`) — score 0/null bypasses the threshold and sends.
- **excludeKeywords substring over-match** (“java” blocks “javascript”); **blacklistCompanies exact-match** under-blocks (“Acme” ≠ “Acme Inc”).
- **SMTP transient errors → permanent FAILED** (only EBUSY retried; no Postal fallback); unique constraint then blocks re-apply.
- **Pause conditions wrong/unreachable** — `pauseOnUnanswered` counts *any* reply (pauses winning loops); pause logic runs only in the digest cron behind a `notifyDigest` + "had activity yesterday" gate, so `pauseOnInactive` never fires for the inactive users it targets.
- **Snooze is a no-op** (`inbox/route.ts:203` writes `errorMessage="[snoozed]"`, never read; clobbers real failure reasons).
- **Digest counts wrong** — open count keys on `updatedAt`; "week" fields are passed yesterday's numbers.
- **`update-draft`/template fields unbounded** (cover letter/subject length); `isDefault` template race (no transaction); library import can create a 2nd default.
- **Resume attachment hard-disabled** — `generateTailoredResume` imported but never called; Postal path attaches no resume at all; no base64 size cap if re-enabled.
- **Open pixel** flips status with no signed token (third-party/proxy prefetch → false OPENED; minor abuse via guessed cuid).
- **send-schedule / smtp-test input validation** — `sendStartHour/EndHour` and `timezone` unvalidated (can block all sends or throw at runtime).

## LOW
- Prompt-injection: scraped job text flows unescaped into the cover-letter LLM prompt (attacker posting can steer the email sent under the user's name).
- Hardcoded `RESUME_API_KEY='rk_freelanly_resume_2026'` fallback in `resume-preview` + `resume-pdf-generator`.
- Two divergent reply categorizers (webhook vs IMAP) classify the same reply differently; `INFO_REQUEST`/`replyCategory` vocabulary drift (stores status string, not AI label).
- `resume-preview` self-fetches template over HTTP via `request.nextUrl.origin` (fragile/SSRF-adjacent via Host header) — read from filesystem instead.
- Discovery feed match score (skill-overlap heuristic) ≠ queue-time AI score; discovery "match" sort only sorts the current 20-row page.

---

## Suggested fix order (auto-apply)
1. **A1 + A3** — make the FREE cap real (shared atomic quota across quick-apply/apply-all/processor) and fix apply-all's crash. (Business-critical + user-visible.)
2. **A4** — atomic PENDING→SENDING claim (stops duplicate recruiter emails).
3. **A6 + A7** — encrypt SMTP passwords; escape/sanitize outbound email content.
4. **A5** — set POSTAL_WEBHOOK_SECRET + fix/retire IMAP reply matching; B8 monotonic status.
5. **B5/B6/B7** — wire send-schedule, bounce limit, follow-up config (so those features mean something).
6. The rest as cleanup. (A2 retracted — matching-by-AI is by design.)

(Some of these touch the off-repo Hetzner worker that actually runs the engine — confirm its behavior when fixing A4/B9.)
