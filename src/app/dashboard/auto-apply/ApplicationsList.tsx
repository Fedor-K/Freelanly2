'use client';

import { useState } from 'react';

interface AutoApplication {
  id: string;
  loopId: string;
  companyName: string;
  jobTitle: string;
  appliedToEmail: string;
  coverLetter: string;
  subject: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
  errorMessage: string | null;
  opportunityId?: string | null;
  jobId?: string | null;
  followUpSentAt?: string | null;
  followUpCount?: number;
}

interface ApplicationsListProps {
  initialApplications: AutoApplication[];
  statusFilter?: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  SENT: 'bg-blue-100 text-blue-700',
  REPLIED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  INTERVIEW: 'bg-purple-100 text-purple-700',
  REVIEW: 'bg-orange-100 text-orange-700',
  SENDING: 'bg-blue-50 text-blue-600',
  DELIVERED: 'bg-blue-100 text-blue-700',
  OPENED: 'bg-teal-100 text-teal-700',
  REJECTED: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Queued',
  SENDING: 'Sending...',
  SENT: 'Sent',
  DELIVERED: 'Delivered',
  OPENED: 'Opened',
  REPLIED: 'Replied! 🎉',
  INTERVIEW: 'Interview! 🎉',
  FAILED: 'Failed',
  REJECTED: 'Rejected',
  REVIEW: 'In Review',
};

const PAGE_SIZE = 10;

export function ApplicationsList({ initialApplications, statusFilter }: ApplicationsListProps) {
  const [applications] = useState<AutoApplication[]>(initialApplications);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const filtered = statusFilter
    ? applications.filter(a => a.status === statusFilter)
    : applications;
  const visibleApps = showAll ? filtered : filtered.slice(0, PAGE_SIZE);
  const hasMore = filtered.length > PAGE_SIZE;

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getFollowUpLabel = (app: AutoApplication): string | null => {
    if (app.followUpSentAt) return 'Follow-up sent';
    if ((app.status === 'SENT' || app.status === 'OPENED') && app.sentAt) {
      const sentDate = new Date(app.sentAt);
      const followUpDate = new Date(sentDate.getTime() + 3 * 24 * 60 * 60 * 1000);
      const now = new Date();
      if (followUpDate > now) {
        const daysLeft = Math.ceil((followUpDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        return `Follow-up in ${daysLeft}d`;
      }
      return 'Follow-up soon';
    }
    return null;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (applications.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-12 text-center">
        <svg
          className="w-16 h-16 mx-auto text-gray-300 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          No applications yet
        </h2>
        <p className="text-gray-600 mb-6">
          Applications will appear here once your auto-apply loops start sending
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Table header */}
      <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
        <div className="col-span-3">Job Title</div>
        <div className="col-span-3">Company</div>
        <div className="col-span-2">Date</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-2">Subject</div>
      </div>

      {/* Application rows */}
      <div className="space-y-2">
        {visibleApps.map((app) => (
          <div key={app.id}>
            <div
              onClick={() => toggleExpand(app.id)}
              className="bg-white rounded-xl border p-6 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div className="md:grid md:grid-cols-12 md:gap-4 md:items-center">
                <div className="col-span-3">
                  <p className="font-semibold text-gray-900 text-sm">{app.jobTitle}</p>
                </div>
                <div className="col-span-3">
                  <p className="text-sm text-gray-600">{app.companyName}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500">
                    {formatDate(app.sentAt || app.createdAt)}
                  </p>
                </div>
                <div className="col-span-2">
                  <span
                    className={`px-2 py-0.5 text-xs rounded ${
                      STATUS_STYLES[app.status] || 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {STATUS_LABELS[app.status] || app.status}
                  </span>
                  {(() => {
                    const fuLabel = getFollowUpLabel(app);
                    if (!fuLabel) return null;
                    return (
                      <p className={`text-[10px] mt-1 ${app.followUpSentAt ? 'text-green-600' : 'text-gray-400'}`}>
                        {fuLabel}
                      </p>
                    );
                  })()}
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500 truncate">{app.subject}</p>
                </div>
              </div>

              {/* Mobile layout */}
              <div className="md:hidden mt-2 flex items-center gap-3">
                <span className="text-sm text-gray-500">
                  {formatDate(app.sentAt || app.createdAt)}
                </span>
                <span
                  className={`px-2 py-0.5 text-xs rounded ${
                    STATUS_STYLES[app.status] || 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {STATUS_LABELS[app.status] || app.status}
                </span>
              </div>
            </div>

            {/* Expanded row - cover letter preview */}
            {expandedId === app.id && (
              <div className="bg-gray-50 rounded-xl border border-t-0 rounded-t-none p-6 -mt-2">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Sent To</p>
                    <p className="text-sm text-gray-700">{app.appliedToEmail}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Subject</p>
                    <p className="text-sm text-gray-700">{app.subject}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Cover Letter</p>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap bg-white p-4 rounded-lg border">
                      {app.coverLetter}
                    </div>
                  </div>
                  {(app.opportunityId || app.jobId) && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Original Job Posting</p>
                      <a href={`/api/user/auto-apply/redirect?appId=${app.id}`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                        View original posting →
                      </a>
                    </div>
                  )}
                  {app.errorMessage && (
                    <div>
                      <p className="text-xs font-medium text-red-500 mb-1">Error</p>
                      <p className="text-sm text-red-600">{app.errorMessage}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Show more / Show less */}
      {hasMore && (
        <div className="text-center mt-4">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            {showAll ? 'Show less' : `Show all ${filtered.length} applications`}
          </button>
        </div>
      )}
    </div>
  );
}
