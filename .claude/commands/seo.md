---
description: SEO status — GSC data, indexation, positions, traffic
---

Check current SEO status using Google Search Console.

## Steps:

1. **Query GSC API** using credentials at `/home/claudebot/gsc-credentials.json`:
- Service account: freelanly2@freelanly2.iam.gserviceaccount.com
- Site: https://freelanly.com/ and sc-domain:freelanly.com

2. **Metrics** (last 28 days vs previous 28 days):
- Total clicks, impressions, CTR, average position
- Top 20 queries by clicks
- Top 20 pages by clicks
- Index coverage

3. **Check indexation**:
```sql
SELECT "contentQuality", COUNT(*) FROM "Opportunity" GROUP BY "contentQuality";
```

4. **Check sitemap & robots.txt**

5. **Blog traffic** — GSC data for /blog/* pages

6. **Format report**:
- 📊 Traffic overview
- 📈 Top queries & pages
- 📑 Index coverage
- 🔄 Trends vs previous period
- ⚠️ Issues

7. **Send to Telegram**
