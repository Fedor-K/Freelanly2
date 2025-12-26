'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { AlertTriangle } from 'lucide-react';

export function DeleteAccountSection() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') {
      setError('Please type DELETE to confirm');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/user/delete-account', {
        method: 'DELETE',
      });

      if (res.ok) {
        // Sign out and redirect to home
        await signOut({ callbackUrl: '/' });
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete account');
      }
    } catch {
      setError('Failed to delete account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 bg-white rounded-xl border border-red-200 p-6">
      <h2 className="text-lg font-semibold text-red-600 mb-2">Danger Zone</h2>
      <p className="text-sm text-gray-600 mb-4">
        Once you delete your account, there is no going back. All your data will be permanently removed.
      </p>

      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
        >
          Delete Account
        </button>
      ) : (
        <div className="space-y-4 p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">Are you absolutely sure?</p>
              <p className="text-sm text-red-700 mt-1">
                This action cannot be undone. This will permanently delete:
              </p>
              <ul className="text-sm text-red-700 mt-2 list-disc list-inside space-y-1">
                <li>Your profile and account settings</li>
                <li>All saved jobs</li>
                <li>All job alerts</li>
                <li>Application history</li>
                <li>Subscription (will be cancelled)</li>
              </ul>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-red-800 mb-1">
              Type <span className="font-mono bg-red-100 px-1">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full px-4 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowConfirm(false);
                setConfirmText('');
                setError('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={loading || confirmText !== 'DELETE'}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Deleting...' : 'Permanently Delete Account'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
