---
description: Monthly business report — Stripe revenue, users, funnel, churn
---

Generate a comprehensive monthly business report for Freelanly. Default to the previous month unless specified.

## Steps:

1. **Stripe data** — call the cron endpoint:
```
curl -s "https://freelanly.com/api/cron/stripe-report?month=YYYY-MM" \
  -H "Authorization: Bearer 9c3827de0523441631996ab6f2b012801b8bef944873df5e218fdbf3b6b4552c"
```

2. **Database metrics** — query Neon DB with DATABASE_URL from memory (`reference_neon_db.md`):
- New users (total + by source)
- New PRO users
- Emails sent, opened, clicked
- Paywall hits → Pricing views → Checkout starts → PRO conversions
- Job alerts: sent, opened, clicked, unsubscribed
- New jobs imported
- Blog posts published
- Social posts sent

3. **Compare with previous month** — run the same queries for the month before

4. **Format report** with sections:
- 💰 Revenue (gross, net, MRR, refunds)
- 📈 Subscriptions (new, churned, net, active)
- 👥 Users (new registrations by source, total)
- 🔄 Funnel (registration → paywall → pricing → checkout → PRO)
- 📧 Email (sent, opens, clicks, unsubscribes, rates)
- 📝 Content (jobs, blog posts, social posts)
- 📊 vs Previous Month (% change for key metrics)

5. **Send to Telegram** via the telegram reply tool
