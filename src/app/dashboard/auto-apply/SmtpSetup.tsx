'use client';

import { useState } from 'react';

interface UserSmtp {
  id: string;
  host: string;
  port: number;
  email: string;
  password: string;
  verified: boolean;
}

interface SmtpSetupProps {
  initialSmtp: UserSmtp | null;
  onSmtpUpdated: (smtp: UserSmtp) => void;
}

const SMTP_PRESETS = [
  { label: 'Gmail', host: 'smtp.gmail.com', port: 587 },
  { label: 'Outlook / Hotmail', host: 'smtp-mail.outlook.com', port: 587 },
  { label: 'Yahoo', host: 'smtp.mail.yahoo.com', port: 587 },
  { label: 'Custom', host: '', port: 587 },
];

export function SmtpSetup({ initialSmtp, onSmtpUpdated }: SmtpSetupProps) {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [preset, setPreset] = useState(() => {
    if (!initialSmtp) return 'Gmail';
    const found = SMTP_PRESETS.find((p) => p.host === initialSmtp.host);
    return found?.label || 'Custom';
  });
  const [host, setHost] = useState(initialSmtp?.host || 'smtp.gmail.com');
  const [port, setPort] = useState(String(initialSmtp?.port || 587));
  const [email, setEmail] = useState(initialSmtp?.email || '');
  const [password, setPassword] = useState(initialSmtp?.password || '');
  const [verified, setVerified] = useState(initialSmtp?.verified || false);

  const handlePresetChange = (label: string) => {
    setPreset(label);
    const found = SMTP_PRESETS.find((p) => p.label === label);
    if (found && found.host) {
      setHost(found.host);
      setPort(String(found.port));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/user/smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host,
          port: parseInt(port),
          email,
          password,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onSmtpUpdated(data);
        setMessage({ type: 'success', text: 'SMTP settings saved successfully!' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to save SMTP settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save SMTP settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/user/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        setVerified(true);
        setMessage({ type: 'success', text: 'Connection successful! Your SMTP is verified.' });
        if (initialSmtp) {
          onSmtpUpdated({ ...initialSmtp, verified: true });
        }
      } else {
        const data = await res.json();
        setVerified(false);
        setMessage({ type: 'error', text: data.error || 'Connection test failed. Check your credentials.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Connection test failed' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSave} className="bg-white rounded-xl border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">SMTP Configuration</h2>
          {verified && (
            <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700">
              Verified
            </span>
          )}
        </div>

        {message && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Provider
            </label>
            <select
              value={preset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {SMTP_PRESETS.map((p) => (
                <option key={p.label} value={p.label}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {preset === 'Custom' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SMTP Host
                </label>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="smtp.example.com"
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Port
                </label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="587"
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@gmail.com"
              required
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              App Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your app password"
              required
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              Use an app password, not your regular password
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !email || !password}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
        </div>
      </form>

      {/* Gmail App Password Instructions */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">How to Get a Gmail App Password</h2>
        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-700 shrink-0">
              1
            </span>
            <p>
              Go to your Google Account at{' '}
              <a
                href="https://myaccount.google.com/security"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                myaccount.google.com/security
              </a>
            </p>
          </div>
          <div className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-700 shrink-0">
              2
            </span>
            <p>Enable 2-Step Verification if not already enabled</p>
          </div>
          <div className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-700 shrink-0">
              3
            </span>
            <p>
              Search for &ldquo;App passwords&rdquo; in the security settings
            </p>
          </div>
          <div className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-700 shrink-0">
              4
            </span>
            <p>
              Create a new app password for &ldquo;Freelanly&rdquo; and paste it above
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
