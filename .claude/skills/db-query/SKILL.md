---
name: db-query
description: "Run queries against Freelanly Neon PostgreSQL database"
allowed-tools: "Bash(DATABASE_URL=* node *), Bash(DATABASE_URL=* npx *)"
---

# Database Query Skill

Run queries against the Freelanly production database (Neon PostgreSQL).

## Connection
```
DATABASE_URL=postgresql://neondb_owner:npg_XuzI8BYto5Qf@ep-noisy-tooth-ahj8gt6v-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
```

## How to Query

Use Prisma client from the project:
```bash
cd /home/claudebot/Freelanly2
DATABASE_URL="postgresql://neondb_owner:npg_XuzI8BYto5Qf@ep-noisy-tooth-ahj8gt6v-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.\$queryRaw\`YOUR SQL HERE\`
  .then(r => console.log(JSON.stringify(r, null, 2)))
  .finally(() => p.\$disconnect());
"
```

## Key Tables
- User: id, email, name, plan (FREE/PRO), source, gclid, createdAt
- Opportunity: id, title, slug, companyId, createdAt, contentQuality
- Company: id, name, slug, website
- JobAlert: id, userId, category, frequency, active
- AlertNotification: id, alertId, opportunityId, status, sentAt
- SocialPostQueue: id, status (PENDING/POSTED/FAILED), postText, postedAt
- ActivityLog: id, userId, action, pageUrl, createdAt
- BlogPost: id, title, slug, createdAt
- RevenueEvent: id, userId, type, amount, currency, createdAt

## Important
- Always use CAST(COUNT(*) AS INTEGER) to avoid BigInt serialization errors
- Use CAST(date AS TEXT) for date fields
- Column names are camelCase in quotes: "createdAt", "contentQuality"
