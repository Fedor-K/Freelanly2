---
description: System health check — cron jobs, queues, errors, services
---

Run a comprehensive health check of all Freelanly systems. Report status to Telegram.

## Checks:

1. **Vercel deployment** — check site is up:
```
curl -s -o /dev/null -w "%{http_code}" https://freelanly.com
```

2. **Database** — verify Neon DB using DATABASE_URL from memory:
```sql
SELECT 1;
SELECT COUNT(*) FROM "User";
SELECT COUNT(*) FROM "Opportunity" WHERE "createdAt" > NOW() - INTERVAL '24 hours';
```

3. **Cron jobs** — check each cron ran recently:
- fetch-sources: new jobs in last 2 hours?
- process-instant-alerts: recent alert notifications?
- post-to-social: recent POSTED items in SocialPostQueue?
- send-winback-emails: check last run
- submit-to-index: check IndexNow submissions

4. **Queues**:
- SocialPostQueue: pending count, failed count
- AlertNotification: pending/failed
- Content autopilot: check `/home/claudebot/content-autopilot/logs/autopilot.log` last entry

5. **n8n** — try reaching https://n8n.freelanly.com

6. **Email** — check recent EMAIL_SENT in ActivityLog (last 24h)

7. **Stripe** — quick revenue check via cron endpoint

8. **Format as dashboard**:
- ✅ Service OK
- ⚠️ Warning (degraded)
- ❌ Down/Error

Send results to Telegram.
