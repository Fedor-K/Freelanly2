---
description: Analyze churned PRO users — who left, why, patterns
---

Analyze PRO user churn for Freelanly. Default to last 30 days.

## Steps:

1. **Get churned subscriptions from Stripe**:
```
curl -s "https://freelanly.com/api/cron/stripe-report?month=YYYY-MM" \
  -H "Authorization: Bearer 9c3827de0523441631996ab6f2b012801b8bef944873df5e218fdbf3b6b4552c"
```

2. **Query DB** for churned users — check RevenueEvent table for SUBSCRIPTION_CHURNED. Use DATABASE_URL from memory.

3. **For each churned user analyze**:
- Subscription duration (days)
- Emails received/opened/clicked
- Paywall hits / job views
- Source
- Country

4. **Find patterns**:
- Average subscription duration before churn
- Most common source for churned users
- Email engagement levels
- Product usage (job views, applies)

5. **Churn rate**:
- Monthly churn = canceled / active at start
- Compare with previous months

6. **Recommendations** based on findings

7. **Send to Telegram**
