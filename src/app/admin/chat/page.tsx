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
  createdAt: string;
}

export default function ChatAdminPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

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

      {/* Messages */}
      <div className="space-y-3">
        {loading && messages.length === 0 ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded-lg" />)}
          </div>
        ) : messages.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Пока никто не написал в чат
            </CardContent>
          </Card>
        ) : (
          messages.map((msg) => (
            <Card key={msg.id} className={msg.details?.escalated ? 'border-red-200 bg-red-50/30' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {new Date(msg.createdAt).toLocaleString('ru-RU', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                    {msg.country && (
                      <Badge variant="outline" className="text-[10px]">
                        {msg.country} {msg.city}
                      </Badge>
                    )}
                    {msg.details?.escalated && (
                      <Badge variant="destructive" className="text-[10px]">
                        Эскалация
                      </Badge>
                    )}
                  </div>
                </div>

                {/* User message */}
                <div className="flex gap-2 mb-2">
                  <span className="text-xs font-medium text-blue-600 shrink-0 pt-0.5">Юзер:</span>
                  <p className="text-sm bg-blue-50 rounded-lg px-3 py-2 flex-1">
                    {msg.details?.userMessage}
                  </p>
                </div>

                {/* Bot reply */}
                <div className="flex gap-2">
                  <span className="text-xs font-medium text-gray-500 shrink-0 pt-0.5">Бот:</span>
                  <p className="text-sm bg-gray-50 rounded-lg px-3 py-2 flex-1">
                    {msg.details?.botReply}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
