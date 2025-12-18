'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, Linkedin, Globe, Plus } from 'lucide-react';

const sources = [
  {
    id: 'apify',
    name: 'Apify LinkedIn',
    description: 'LinkedIn Posts Search scraper via Apify',
    icon: Linkedin,
    status: 'active',
    href: '/admin/sources/apify',
    stats: {
      lastRun: 'Today',
      totalImported: '1,234',
    },
  },
  {
    id: 'manual',
    name: 'Manual Entry',
    description: 'Manually added jobs',
    icon: Globe,
    status: 'active',
    href: '#',
    stats: {
      lastRun: 'N/A',
      totalImported: '0',
    },
  },
];

const upcomingSources = [
  { name: 'Indeed API', description: 'Job listings from Indeed' },
  { name: 'RemoteOK', description: 'Remote job board' },
  { name: 'WeWorkRemotely', description: 'Remote job listings' },
  { name: 'HackerNews Jobs', description: 'Who is Hiring threads' },
];

export default function SourcesPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Data Sources</h1>
        <p className="text-muted-foreground mt-1">
          Configure and manage job data sources
        </p>
      </div>

      {/* Active Sources */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Active Sources</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {sources.map((source) => {
            const Icon = source.icon;
            return (
              <Link key={source.id} href={source.href}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{source.name}</CardTitle>
                          <CardDescription>{source.description}</CardDescription>
                        </div>
                      </div>
                      <Badge variant={source.status === 'active' ? 'default' : 'secondary'}>
                        {source.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Last run:</span>{' '}
                        <span className="font-medium">{source.stats.lastRun}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total imported:</span>{' '}
                        <span className="font-medium">{source.stats.totalImported}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Upcoming Sources */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Upcoming Sources</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {upcomingSources.map((source) => (
            <Card key={source.name} className="opacity-60">
              <CardHeader className="py-4">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">{source.name}</CardTitle>
                </div>
                <CardDescription className="text-xs">{source.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
        <p className="text-sm text-muted-foreground mt-4">
          More sources will be added soon. Contact support to request a specific source.
        </p>
      </div>
    </div>
  );
}
