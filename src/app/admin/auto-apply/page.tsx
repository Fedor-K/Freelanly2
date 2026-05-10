import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminAutoApplyPage() {
  // Per-user stats
  const users = await prisma.$queryRaw<Array<{
    name: string | null;
    email: string;
    plan: string;
    started: Date | null;
    sent: bigint;
    replies: bigint;
    pending: bigint;
    opened: bigint;
    has_smtp: boolean;
  }>>`
    SELECT
      u.name,
      u.email,
      u.plan,
      MIN(a."sentAt") as started,
      COUNT(*) FILTER (WHERE a."sentAt" IS NOT NULL) as sent,
      COUNT(*) FILTER (WHERE a.status = 'REPLIED') as replies,
      COUNT(*) FILTER (WHERE a.status = 'PENDING') as pending,
      COUNT(*) FILTER (WHERE a.status = 'OPENED') as opened,
      EXISTS(SELECT 1 FROM "UserSmtp" WHERE "userId" = u.id AND verified = true) as has_smtp
    FROM "AutoApplication" a
    JOIN "User" u ON u.id = a."userId"
    GROUP BY u.name, u.email, u.plan, u.id
    ORDER BY MIN(a."createdAt") ASC
  `;

  // Daily stats
  const daily = await prisma.$queryRaw<Array<{
    day: Date;
    new_loops: bigint;
    new_smtp: bigint;
    sent: bigint;
    registrations: bigint;
  }>>`
    SELECT
      d.day,
      (SELECT COUNT(*) FROM "AutoApplyLoop" WHERE "createdAt"::date = d.day) as new_loops,
      (SELECT COUNT(*) FROM "UserSmtp" WHERE "createdAt"::date = d.day AND verified = true) as new_smtp,
      (SELECT COUNT(*) FROM "AutoApplication" WHERE "sentAt"::date = d.day) as sent,
      (SELECT COUNT(*) FROM "User" WHERE "createdAt"::date = d.day) as registrations
    FROM generate_series(CURRENT_DATE - 7, CURRENT_DATE, '1 day') as d(day)
    ORDER BY d.day DESC
  `;

  // Totals
  const totals = await prisma.$queryRaw<Array<{
    total_loops: bigint;
    active_loops: bigint;
    total_smtp: bigint;
    total_sent: bigint;
    total_replied: bigint;
    total_opened: bigint;
    total_pending: bigint;
  }>>`
    SELECT
      (SELECT COUNT(*) FROM "AutoApplyLoop") as total_loops,
      (SELECT COUNT(*) FROM "AutoApplyLoop" WHERE "isActive" = true) as active_loops,
      (SELECT COUNT(*) FROM "UserSmtp" WHERE verified = true) as total_smtp,
      (SELECT COUNT(*) FROM "AutoApplication" WHERE "sentAt" IS NOT NULL) as total_sent,
      (SELECT COUNT(*) FROM "AutoApplication" WHERE status = 'REPLIED') as total_replied,
      (SELECT COUNT(*) FROM "AutoApplication" WHERE status = 'OPENED') as total_opened,
      (SELECT COUNT(*) FROM "AutoApplication" WHERE status = 'PENDING') as total_pending
  `;

  const t = totals[0];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Auto-Apply Dashboard</h1>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
        {[
          { label: 'Active Loops', value: Number(t.active_loops), color: 'text-green-600' },
          { label: 'SMTP Users', value: Number(t.total_smtp), color: 'text-blue-600' },
          { label: 'Sent', value: Number(t.total_sent), color: 'text-gray-900' },
          { label: 'Opened', value: Number(t.total_opened), color: 'text-teal-600' },
          { label: 'Replied', value: Number(t.total_replied), color: 'text-green-600' },
          { label: 'Pending', value: Number(t.total_pending), color: 'text-yellow-600' },
          { label: 'Total Loops', value: Number(t.total_loops), color: 'text-gray-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg border p-3 text-center">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Daily table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <h2 className="text-sm font-semibold p-4 border-b">Daily Activity</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Date</th>
              <th className="text-right p-3">Registrations</th>
              <th className="text-right p-3">New Loops</th>
              <th className="text-right p-3">New SMTP</th>
              <th className="text-right p-3">Sent</th>
              <th className="text-right p-3">Conversion</th>
            </tr>
          </thead>
          <tbody>
            {daily.map(d => {
              const regs = Number(d.registrations);
              const loops = Number(d.new_loops);
              const conv = regs > 0 ? ((loops / regs) * 100).toFixed(1) : '0';
              return (
                <tr key={d.day.toISOString()} className="border-t">
                  <td className="p-3">{d.day.toISOString().slice(0, 10)}</td>
                  <td className="p-3 text-right">{regs}</td>
                  <td className="p-3 text-right font-medium">{loops}</td>
                  <td className="p-3 text-right">{Number(d.new_smtp)}</td>
                  <td className="p-3 text-right">{Number(d.sent)}</td>
                  <td className="p-3 text-right text-green-600 font-medium">{conv}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Per-user table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <h2 className="text-sm font-semibold p-4 border-b">Users ({users.length})</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Email</th>
              <th className="text-center p-3">Plan</th>
              <th className="text-center p-3">SMTP</th>
              <th className="text-left p-3">Started</th>
              <th className="text-right p-3">Sent</th>
              <th className="text-right p-3">Opened</th>
              <th className="text-right p-3">Replied</th>
              <th className="text-right p-3">Pending</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.email} className="border-t hover:bg-gray-50">
                <td className="p-3 font-medium">{u.name || '—'}</td>
                <td className="p-3 text-gray-500 text-xs">{u.email}</td>
                <td className="p-3 text-center">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${u.plan === 'PRO' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                    {u.plan}
                  </span>
                </td>
                <td className="p-3 text-center">{u.has_smtp ? '✅' : '📮'}</td>
                <td className="p-3 text-xs text-gray-500">{u.started ? u.started.toISOString().slice(5, 10) : '—'}</td>
                <td className="p-3 text-right">{Number(u.sent)}</td>
                <td className="p-3 text-right text-teal-600">{Number(u.opened)}</td>
                <td className="p-3 text-right text-green-600 font-medium">{Number(u.replies)}</td>
                <td className="p-3 text-right text-yellow-600">{Number(u.pending)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
