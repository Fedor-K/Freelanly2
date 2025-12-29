'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { RegistrationModal } from './RegistrationModal';

export function UserMenu() {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Loading state
  if (status === 'loading') {
    return (
      <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
    );
  }

  // Not logged in - show sign in button that opens modal
  if (!session?.user) {
    return (
      <>
        <button
          onClick={() => setShowRegistration(true)}
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
        >
          Sign In
        </button>
        <RegistrationModal
          open={showRegistration}
          onClose={() => setShowRegistration(false)}
        />
      </>
    );
  }

  // Logged in - show user menu
  const user = session.user;
  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email?.charAt(0).toUpperCase() || 'U';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 transition-colors"
      >
        {user.image ? (
          <img
            src={user.image}
            alt={user.name || 'User'}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-sm font-medium">
            {initials}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border py-1 z-50">
          {/* User info */}
          <div className="px-4 py-3 border-b">
            <p className="font-medium text-gray-900 truncate">
              {user.name || 'User'}
            </p>
            <p className="text-sm text-gray-500 truncate">{user.email}</p>
            <span
              className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded ${
                user.plan === 'PRO'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                  : user.plan === 'ENTERPRISE'
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600'
              }`}
            >
              {user.plan}
            </span>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <Link
              href="/dashboard"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/saved"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Saved Jobs
            </Link>
            <Link
              href="/dashboard/applications"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              My Applications
            </Link>
            <Link
              href="/dashboard/alerts"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Job Alerts
            </Link>
          </div>

          {/* Settings & Logout */}
          <div className="border-t py-1">
            <Link
              href="/dashboard/settings"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Settings
            </Link>
            {user.email === 'fedor.hatla@gmail.com' && (
              <Link
                href="/admin"
                onClick={() => setIsOpen(false)}
                className="block px-4 py-2 text-sm text-orange-600 font-medium hover:bg-orange-50"
              >
                Admin Panel
              </Link>
            )}
            {user.plan === 'FREE' && (
              <Link
                href="/pricing"
                onClick={() => setIsOpen(false)}
                className="block px-4 py-2 text-sm text-purple-600 font-medium hover:bg-purple-50"
              >
                Upgrade to PRO
              </Link>
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
