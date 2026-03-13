'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users, TrendingUp, DollarSign, Bell, Crown, UserPlus,
  Mail, Briefcase, ArrowRight, ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

interface DashboardData {
  funnel: {
    visitors30d: number | null;
    registrations30d: number;
    verifiedEmails30d: number;
    paywallHits30d: number;
    newPro30d: number;
    regToVerified: number;
    verifiedToPaywall: number;
    paywallToPro: number;
  };
  today: {
    registrations: number;
    newPro: number;
    paywallHits: number;
    newOpportunities: number;
  };
  revenue: {
    mrr: number;
    totalProUsers: number;
    churnedLast30d: number;
  };
  emails: {
    alertsSentLast7d: number;
    openRate7d: number;
    clickRate7d: number;
  };
  content: {
    activeOpportunities: number;
    opportunitiesLast7d: number;
    activeAlerts: number;
  };
}

function MetricCard({
  title,
  value,
  sub,
  icon: Icon,
  iconColor,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  iconColor?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${iconColor || 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function FunnelStep({
  label,
  value,
  conversionPercent,
  isLast,
}: {
  label: string;
  value: number | string;
  conversionPercent?: number;
  isLast?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-center min-w-[100px]">
        <div className="text-xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
      {!isLast && (
        <div className="flex flex-col items-center gap-0.5">
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          {conversionPercent !== undefined && (
            <span className="text-[10px] font-medium text-muted-foreground">{conversionPercent}%</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/management-dashboard')
      .then(res => res.json())
      .then(json => {
        if (json.success) setData(json);
      })
      .catch(err => console.error('Failed to fetch dashboard:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Management Dashboard</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Management Dashboard</h1>
        <p className="text-red-500">Failed to load dashboard data</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Management Dashboard</h1>

      {/* Section 1: Funnel (30 days) */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Funnel (30 days)
        </h2>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-1 flex-wrap">
              <FunnelStep
                label="Traffic"
                value={data.funnel.visitors30d !== null ? data.funnel.visitors30d.toLocaleString() : '—'}
                conversionPercent={
                  data.funnel.visitors30d && data.funnel.registrations30d
                    ? parseFloat(((data.funnel.registrations30d / data.funnel.visitors30d) * 100).toFixed(1))
                    : undefined
                }
              />
              <FunnelStep
                label="Registrations"
                value={data.funnel.registrations30d}
                conversionPercent={data.funnel.regToVerified}
              />
              <FunnelStep
                label="Verified"
                value={data.funnel.verifiedEmails30d}
                conversionPercent={data.funnel.verifiedToPaywall}
              />
              <FunnelStep
                label="Paywall Hit"
                value={data.funnel.paywallHits30d}
                conversionPercent={data.funnel.paywallToPro}
              />
              <FunnelStep
                label="PRO"
                value={data.funnel.newPro30d}
                isLast
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section 2: Today */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Today
        </h2>
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard
            title="New Registrations"
            value={data.today.registrations}
            icon={UserPlus}
            iconColor="text-blue-500"
          />
          <MetricCard
            title="New PRO"
            value={data.today.newPro}
            icon={Crown}
            iconColor="text-yellow-500"
          />
          <MetricCard
            title="Paywall Hits"
            value={data.today.paywallHits}
            sub="apply attempts"
            icon={Users}
            iconColor="text-orange-500"
          />
          <MetricCard
            title="New Opportunities"
            value={data.today.newOpportunities}
            icon={Briefcase}
            iconColor="text-purple-500"
          />
        </div>
      </div>

      {/* Section 3: Revenue */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Revenue
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            title="MRR"
            value={`€${data.revenue.mrr.toLocaleString()}`}
            sub="estimated from active subscriptions"
            icon={DollarSign}
            iconColor="text-green-600"
          />
          <MetricCard
            title="Total PRO Users"
            value={data.revenue.totalProUsers}
            sub="with active subscription"
            icon={Crown}
            iconColor="text-yellow-500"
          />
          <MetricCard
            title="Churned (30d)"
            value={data.revenue.churnedLast30d}
            sub="subscription ended"
            icon={TrendingUp}
            iconColor="text-red-500"
          />
        </div>
      </div>

      {/* Section 4: Email Health (7 days) */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Health (7 days)
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            title="Alerts Sent"
            value={data.emails.alertsSentLast7d.toLocaleString()}
            icon={Bell}
            iconColor="text-blue-500"
          />
          <MetricCard
            title="Open Rate"
            value={`${data.emails.openRate7d}%`}
            icon={Mail}
            iconColor="text-green-500"
          />
          <MetricCard
            title="Click Rate"
            value={`${data.emails.clickRate7d}%`}
            icon={ExternalLink}
            iconColor="text-purple-500"
          />
        </div>
      </div>

      {/* Section 5: Content */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Content
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            title="Active Opportunities"
            value={data.content.activeOpportunities.toLocaleString()}
            icon={Briefcase}
            iconColor="text-blue-500"
          />
          <MetricCard
            title="New This Week"
            value={data.content.opportunitiesLast7d}
            icon={TrendingUp}
          />
          <MetricCard
            title="Active Alerts"
            value={data.content.activeAlerts.toLocaleString()}
            icon={Bell}
          />
        </div>
      </div>

      {/* Section 6: Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Pages</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {[
            { href: '/admin/users', label: 'Users', color: 'bg-primary text-primary-foreground hover:bg-primary/90' },
            { href: '/admin/conversions', label: 'Conversions', color: 'bg-green-600 text-white hover:bg-green-700' },
            { href: '/admin/email-stats', label: 'Email Stats', color: 'bg-blue-600 text-white hover:bg-blue-700' },
            { href: '/admin/analytics', label: 'Analytics', color: 'bg-secondary text-secondary-foreground hover:bg-secondary/90' },
            { href: '/admin/cancellations', label: 'Cancellations', color: 'bg-secondary text-secondary-foreground hover:bg-secondary/90' },
            { href: '/admin/sources', label: 'Sources', color: 'bg-secondary text-secondary-foreground hover:bg-secondary/90' },
            { href: '/admin/jobs', label: 'Jobs', color: 'bg-secondary text-secondary-foreground hover:bg-secondary/90' },
            { href: '/admin/logs', label: 'Logs', color: 'bg-secondary text-secondary-foreground hover:bg-secondary/90' },
            { href: '/admin/activation', label: 'Activation', color: 'bg-secondary text-secondary-foreground hover:bg-secondary/90' },
            { href: '/admin/free-nurture', label: 'Free Nurture', color: 'bg-secondary text-secondary-foreground hover:bg-secondary/90' },
            { href: '/admin/clarity', label: 'UX (Clarity)', color: 'bg-secondary text-secondary-foreground hover:bg-secondary/90' },
            { href: '/admin/keywords', label: 'Keywords', color: 'bg-secondary text-secondary-foreground hover:bg-secondary/90' },
            { href: '/admin/parsing', label: 'Parsing', color: 'bg-secondary text-secondary-foreground hover:bg-secondary/90' },
            { href: '/admin/google-ads', label: 'Google Ads', color: 'bg-secondary text-secondary-foreground hover:bg-secondary/90' },
          ].map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${link.color}`}
            >
              {link.label}
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
