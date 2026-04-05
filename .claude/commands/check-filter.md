---
description: Compare post filter quality before vs after prompt update (April 5 2026)
---

Compare LinkedIn post filtering quality: 7 days BEFORE vs 7 days AFTER the isJobPosting prompt update on April 5, 2026.

## Baseline (BEFORE — March 29 to April 4):
Already collected from n8n DB analysis:
- 10,193 posts processed
- 2,287 created (22%)
- 5,988 not_job_posting
- 1,005 non-target profession
- 261 duplicate_title
- 1,259 "Error during validation"

## Steps:

1. **Query n8n execution data** for April 5-12 (copy fresh DB from VPS 46.173.20.46):
```bash
sshpass -p 'PQfP2j*PzlC5' ssh root@46.173.20.46 "docker cp n8n:/home/node/.n8n/database.sqlite /tmp/n8n.db"
sshpass -p 'PQfP2j*PzlC5' scp root@46.173.20.46:/tmp/n8n.db /tmp/n8n_new.db
```

2. **Parse executions** for the AFTER period using the same Python script as before — count created, not_job_posting, and extract rejection reasons.

3. **Check for new "resume collector" rejections** — these are new from the prompt update:
- Look for reasons containing "resume collector", "staffing agency", "multiple roles"

4. **Sample 20 recent opportunities** from DB and manually assess quality.

5. **Compare**:
| Metric | BEFORE | AFTER | Change |
|--------|--------|-------|--------|
| Total processed | | | |
| Created (%) | | | |
| not_job_posting (%) | | | |
| Resume collector rejections | 0 | | NEW |
| Error during validation | | | |
| Quality score avg (created) | | | |

6. **Send results to Telegram**
