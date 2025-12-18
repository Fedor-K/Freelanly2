'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Trash2, RefreshCw } from 'lucide-react';

interface Subscriber {
  id: string;
  email: string;
  keywords: string | null;
  category: string | null;
  isActive: boolean;
  createdAt: string;
  lastSentAt: string | null;
  emailsSent: number;
}

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;

  useEffect(() => {
    fetchSubscribers();
  }, [page]);

  async function fetchSubscribers() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/subscribers?page=${page}&limit=${perPage}`);
      const data = await res.json();
      if (data.success) {
        setSubscribers(data.subscribers);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Failed to fetch subscribers:', error);
    } finally {
      setLoading(false);
    }
  }

  async function deleteSubscriber(id: string) {
    if (!confirm('Are you sure you want to delete this subscriber?')) return;

    try {
      const res = await fetch(`/api/admin/subscribers?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSubscribers(subscribers.filter(s => s.id !== id));
        setTotal(total - 1);
      }
    } catch (error) {
      console.error('Failed to delete subscriber:', error);
    }
  }

  const totalPages = Math.ceil(total / perPage);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Subscribers</h1>
          <p className="text-muted-foreground mt-1">
            {total.toLocaleString()} total subscribers
          </p>
        </div>
        <Button onClick={fetchSubscribers} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading subscribers...</p>
      ) : subscribers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No subscribers yet</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {subscribers.map((subscriber) => (
              <Card key={subscriber.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{subscriber.email}</span>
                        <Badge variant={subscriber.isActive ? 'default' : 'secondary'}>
                          {subscriber.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>

                      {subscriber.keywords && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-xs text-muted-foreground">Keywords:</span>
                          <Badge variant="outline" className="text-xs">
                            {subscriber.keywords}
                          </Badge>
                        </div>
                      )}

                      {subscriber.category && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-xs text-muted-foreground">Category:</span>
                          <Badge variant="outline" className="text-xs">
                            {subscriber.category}
                          </Badge>
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground">
                        Subscribed: {new Date(subscriber.createdAt).toLocaleDateString()}
                        {subscriber.lastSentAt && (
                          <span> | Last email: {new Date(subscriber.lastSentAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSubscriber(subscriber.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <Button
                variant="outline"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="flex items-center px-4 text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
