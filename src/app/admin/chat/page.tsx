'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, MessageCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface ChatMessage {
  id: string;
  details: {
    type: string;
    userMessage: string;
    botReply: string;
    escalated: boolean;
  };
  country: string | null;
  city: string | null;
  ipAddress: string | null;
  sessionId: string | null;
  createdAt: string;
}

interface ChatSession {
  sessionId: string;
  messages: ChatMessage[];
  country: string | null;
  city: string | null;
  startedAt: string;
}

function groupBySessions(messages: ChatMessage[]): ChatSession[] {
  const groups = new Map<string, ChatMessage[]>();

  for (const msg of messages) {
    // Group by sessionId, or by IP+country as fallback
    const key = msg.sessionId || `${msg.ipAddress}_${msg.country}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(msg);
  }

  return Array.from(groups.entries()).map(([sessionId, msgs]) => ({
    sessionId,
    messages: msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    country: msgs[0].country,
    city: msgs[0].city,
    startedAt: msgs[msgs.length - 1].createdAt, // newest first (msgs sorted asc, but sessions sorted desc)
  })).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

export default function ChatAdminPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const sessions = groupBySessions(messages);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/chat');
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Failed to fetch chat messages:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Админка
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageCircle className="h-6 w-6" />
              Чат-бот — Сообщения
            </h1>
            <p className="text-muted-foreground text-sm">
              Все разговоры с AI ботом на сайте
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchMessages} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      {/* Stats */}
      <div className="flex gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{sessions.length}</div>
            <div className="text-sm text-muted-foreground">Чатов</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{messages.length}</div>
            <div className="text-sm text-muted-foreground">Сообщений</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{messages.filter(m => m.details?.escalated).length}</div>
            <div className="text-sm text-muted-foreground">Эскалаций</div>
          </CardContent>
        </Card>
      </div>

      {/* Sessions */}
      <div className="space-y-4">
        {loading && messages.length === 0 ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded-lg" />)}
          </div>
        ) : sessions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Пока никто не написал в чат
            </CardContent>
          </Card>
        ) : (
          sessions.map((session) => {
            const hasEscalation = session.messages.some(m => m.details?.escalated);
            return (
              <Card key={session.sessionId} className={hasEscalation ? 'border-red-200 bg-red-50/30' : ''}>
                <CardContent className="p-4">
                  {/* Session header */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 pb-2 border-b">
                    <span>
                      {new Date(session.startedAt).toLocaleString('ru-RU', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                    {session.country && (
                      <Badge variant="outline" className="text-[10px]">
                        {session.country} {session.city}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px]">
                      {session.messages.length} {session.messages.length === 1 ? 'сообщение' : session.messages.length < 5 ? 'сообщения' : 'сообщений'}
                    </Badge>
                    {hasEscalation && (
                      <Badge variant="destructive" className="text-[10px]">
                        Эскалация
                      </Badge>
                    )}
                  </div>

                  {/* Messages in session */}
                  <div className="space-y-2">
                    {session.messages.map((msg) => (
                      <div key={msg.id}>
                        <div className="flex gap-2 mb-1">
                          <span className="text-xs font-medium text-blue-600 shrink-0 pt-0.5 w-10">Юзер:</span>
                          <p className="text-sm bg-blue-50 rounded-lg px-3 py-1.5 flex-1">
                            {msg.details?.userMessage}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-xs font-medium text-gray-500 shrink-0 pt-0.5 w-10">Бот:</span>
                          <p className="text-sm bg-gray-50 rounded-lg px-3 py-1.5 flex-1">
                            {msg.details?.botReply}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
