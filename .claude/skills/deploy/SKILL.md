---
name: deploy
description: "Push code to GitHub and verify Vercel deployment succeeded"
allowed-tools: "Bash(git *), Bash(curl *)"
---

# Deploy Skill

Deploy the current code to production (Vercel auto-deploys from GitHub main).

## Steps:

1. **Pre-deploy checks**:
```bash
cd /home/claudebot/Freelanly2
npx tsc --noEmit 2>&1 | tail -20
```
If TypeScript errors found, report them and stop.

2. **Check git status**:
```bash
git status
git diff --stat
```

3. **Push to main**:
```bash
git push origin main
```

4. **Wait for Vercel deploy** (2 minutes):
```bash
sleep 120
```

5. **Verify deployment**:
```bash
curl -s -o /dev/null -w "%{http_code}" https://freelanly.com
```

6. **Quick smoke test** — verify a key API endpoint:
```bash
curl -s "https://freelanly.com/api/cron/stripe-report?month=2026-01" \
  -H "Authorization: Bearer 9c3827de0523441631996ab6f2b012801b8bef944873df5e218fdbf3b6b4552c" | head -1
```

7. **Report result**: success/failure with details
