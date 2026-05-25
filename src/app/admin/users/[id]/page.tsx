import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Activity, MessageSquare, Mail } from 'lucide-react';

// Defense-in-depth: the /admin layout already gates by email, but this page
// exposes private user↔recruiter conversations, so re-check here too.
const ADMIN_EMAILS = ['fedor.hatla@gmail.com'];

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  SENDING: 'bg-amber-100 text-amber-700',
  SENT: 'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-sky-100 text-sky-700',
  OPENED: 'bg-indigo-100 text-indigo-700',
  REPLIED: 'bg-green-100 text-green-700',
  INTERVIEW: 'bg-emerald-200 text-emerald-800',
  OFFER: 'bg-emerald-300 text-emerald-900',
  REJECTED: 'bg-red-100 text-red-700',
  FAILED: 'bg-red-200 text-red-800',
  REVIEW: 'bg-yellow-100 text-yellow-700',
};

function fmt(d: Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect('/auth/signin?callbackUrl=/admin/users');
  if (!ADMIN_EMAILS.includes(session.user.email)) redirect('/');

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, email: true, name: true, plan: true, createdAt: true,
      resumeFileName: true, parsedProfile: true,
    },
  });
  if (!user) notFound();

  const apps = await prisma.autoApplication.findMany({
    where: { userId: id },
    select: {
      id: true, companyName: true, jobTitle: true, appliedToEmail: true,
      status: true, subject: true, coverLetter: true, errorMessage: true,
      replyText: true, replyCategory: true, replySignal: true,
      sentAt: true, repliedAt: true, createdAt: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, from: true, text: true, attachmentUrl: true, createdAt: true },
      },
    },
    orderBy: [{ repliedAt: 'desc' }, { sentAt: 'desc' }, { createdAt: 'desc' }],
    take: 500,
  });

  // Only applications that were ACTUALLY SENT are real outreach. Everything else
  // (queued, awaiting review, expired, invalid-profile, send errors) is queue debris —
  // show it as a compact breakdown, not as a wall of "FAILED" conversation cards.
  const realApps = apps.filter((a) => a.sentAt);
  const neverSent = apps.filter((a) => !a.sentAt);

  const reasonOf = (status: string, err: string | null): string => {
    if (status === 'PENDING' || status === 'SENDING') return 'В очереди на отправку';
    if (status === 'REVIEW') return 'Ждёт одобрения';
    if (/^expired/i.test(err || '')) return 'Протухло (не успели за 24ч)';
    if (/no skills|resume may be invalid/i.test(err || '')) return 'Битый профиль (резюме)';
    if (/doesn't speak|does not speak/i.test(err || '')) return 'Язык не совпал';
    if (/postal|smtp|recipient|bounce|connection/i.test(err || '')) return 'Ошибка отправки';
    return 'Прочее / не отправлено';
  };
  const neverSentByReason = neverSent.reduce<Record<string, number>>((acc, a) => {
    const r = reasonOf(a.status, a.errorMessage);
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {});

  const replied = realApps.filter((a) => a.repliedAt).length;
  const withThread = realApps.filter((a) => a.messages.length > 1 || (a.messages.length === 1 && a.replyText)).length;
  const profile = (user.parsedProfile || {}) as Record<string, unknown>;
  const badResume = ((profile.skills as unknown[])?.length || 0) === 0 && ((profile.languages as unknown[])?.length || 0) === 0;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/users">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            {user.name || 'No name'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {user.email} · <Badge variant={user.plan === 'PRO' ? 'default' : 'secondary'}>{user.plan}</Badge>
            {' '}· зарегистрирован {fmt(user.createdAt)}
            {profile.current_title ? ` · ${profile.current_title}` : ''}
          </p>
        </div>
        <Link href={`/admin/users/${user.id}/activity`}>
          <Button variant="outline" size="sm">
            <Activity className="h-4 w-4 mr-1" />
            Активность
          </Button>
        </Link>
      </div>

      {/* Bad-resume nudge */}
      {badResume && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-900">
            ⚠️ Резюме не распарсилось (нет навыков и языков в профиле) — авто-отклики не уходят.
            Юзеру нужно перезалить резюме.
          </CardContent>
        </Card>
      )}

      {/* Stats — only real (sent) outreach */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold">{realApps.length}</div>
          <div className="text-sm text-muted-foreground">Отправлено</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold">{replied}</div>
          <div className="text-sm text-muted-foreground">Рекрутёр ответил</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold">{withThread}</div>
          <div className="text-sm text-muted-foreground">Есть переписка</div>
        </CardContent></Card>
      </div>

      {/* Never-sent debris — compact breakdown, not conversation cards */}
      {neverSent.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium mb-2 text-muted-foreground">
              Не отправлено: {neverSent.length} <span className="font-normal">(не отклики — мусор очереди)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(neverSentByReason)
                .sort(([, a], [, b]) => b - a)
                .map(([reason, n]) => (
                  <Badge key={reason} variant="outline" className="text-xs">
                    {reason}: {n}
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conversations — only applications that were actually sent */}
      <div className="space-y-4">
        {realApps.length === 0 && (
          <Card><CardContent className="py-8">
            <p className="text-center text-muted-foreground">Реальных отправок нет{neverSent.length > 0 ? ' (см. сводку выше)' : ''}</p>
          </CardContent></Card>
        )}

        {realApps.map((app) => {
          // Build the thread: prefer Message records; fall back to coverLetter + replyText
          // for older applications created before the Message model existed.
          const thread = app.messages.length > 0
            ? app.messages
            : [
                { id: `${app.id}-cl`, from: 'user', text: app.coverLetter, attachmentUrl: null, createdAt: app.sentAt || app.createdAt },
                ...(app.replyText
                  ? [{ id: `${app.id}-rt`, from: 'recruiter', text: app.replyText, attachmentUrl: null, createdAt: app.repliedAt || app.createdAt }]
                  : []),
              ];

          return (
            <Card key={app.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-start justify-between gap-3">
                  <span className="flex-1">
                    {app.jobTitle} <span className="text-muted-foreground font-normal">@ {app.companyName}</span>
                  </span>
                  <Badge className={STATUS_COLOR[app.status] || 'bg-gray-100 text-gray-700'}>{app.status}</Badge>
                </CardTitle>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                  <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{app.appliedToEmail}</span>
                  <span>Отправлено: {fmt(app.sentAt)}</span>
                  {app.repliedAt && <span>Ответ: {fmt(app.repliedAt)}</span>}
                  {app.replyCategory && <Badge variant="outline" className="text-[10px]">{app.replyCategory}</Badge>}
                </div>
                {app.replySignal && (
                  <div className="text-xs mt-1 pl-2 border-l-2 border-emerald-400 text-emerald-800">
                    AI-сигнал: {app.replySignal}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {thread.map((m) => {
                    const isUser = m.from === 'user';
                    const isSystem = m.from === 'system';
                    if (isSystem) {
                      return (
                        <div key={m.id} className="text-center">
                          <span className="text-[11px] text-muted-foreground italic">{m.text} · {fmt(m.createdAt)}</span>
                        </div>
                      );
                    }
                    return (
                      <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words ${
                          isUser ? 'bg-blue-50 border border-blue-100' : 'bg-muted'
                        }`}>
                          <div className={`text-[10px] uppercase tracking-wide mb-1 ${isUser ? 'text-blue-600' : 'text-muted-foreground'}`}>
                            {isUser ? 'Юзер' : 'Рекрутёр'} · {fmt(m.createdAt)}
                          </div>
                          {m.text}
                          {m.attachmentUrl && (
                            <div className="mt-1 text-[11px] text-blue-600">📎 {m.attachmentUrl}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
