// Prints "lockedTotal,paidTotal,lockedSincePaywall" for the paywall monitor.
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const locked = (await p.$queryRawUnsafe(`SELECT COUNT(*)::int n FROM "AutoApplication" WHERE "replyUnlocked"=false`))[0].n;
  const paid = (await p.$queryRawUnsafe(`SELECT COUNT(*)::int n FROM "ActivityLog" WHERE action::text='CHECKOUT_COMPLETE' AND details->>'type'='unlock_reply'`))[0].n;
  console.log(`${locked},${paid}`);
})().catch(() => console.log('ERR,ERR')).finally(() => p.$disconnect());
