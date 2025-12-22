'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { RefreshCw, Users, Crown } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string | null;
  plan: 'FREE' | 'PRO' | 'ENTERPRISE';
  stripeId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionEndsAt: string | null;
  createdAt: string;
  _count: {
    savedJobs: number;
    jobAlerts: number;
  };
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }

  async function togglePlan(userId: string, currentPlan: string) {
    const newPlan = currentPlan === 'PRO' ? 'FREE' : 'PRO';
    setUpdating(userId);

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: newPlan }),
      });

      if (res.ok) {
        setUsers(users.map(u =>
          u.id === userId ? { ...u, plan: newPlan as 'FREE' | 'PRO' } : u
        ));
      }
    } catch (error) {
      console.error('Failed to update plan:', error);
    } finally {
      setUpdating(null);
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const proUsers = users.filter(u => u.plan === 'PRO' || u.plan === 'ENTERPRISE').length;
  const freeUsers = users.filter(u => u.plan === 'FREE').length;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground mt-1">
            {users.length} total users · {proUsers} PRO · {freeUsers} FREE
          </p>
        </div>
        <Button onClick={fetchUsers} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading users...</p>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No users yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <Card key={user.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      {user.plan === 'PRO' || user.plan === 'ENTERPRISE' ? (
                        <Crown className="h-5 w-5 text-yellow-500" />
                      ) : (
                        <Users className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{user.email}</span>
                        <Badge variant={user.plan === 'PRO' ? 'default' : 'secondary'}>
                          {user.plan}
                        </Badge>
                        {user.stripeSubscriptionId && (
                          <Badge variant="outline" className="text-xs">
                            Stripe
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {user.name || 'No name'} · Joined {formatDate(user.createdAt)}
                        {user._count.savedJobs > 0 && ` · ${user._count.savedJobs} saved jobs`}
                        {user._count.jobAlerts > 0 && ` · ${user._count.jobAlerts} alerts`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-sm text-right">
                      <span className="text-muted-foreground mr-2">PRO</span>
                    </div>
                    <Switch
                      checked={user.plan === 'PRO' || user.plan === 'ENTERPRISE'}
                      onCheckedChange={() => togglePlan(user.id, user.plan)}
                      disabled={updating === user.id}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
