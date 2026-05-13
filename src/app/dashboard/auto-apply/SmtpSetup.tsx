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
  { label: 'Gmail', host: 'smtp.gmail.com', port: 587, instructions: 'https://myaccount.google.com/apppasswords', twoFactorUrl: 'https://myaccount.google.com/signinoptions/two-step-verification' },
  { label: 'Outlook / Hotmail', host: 'smtp-mail.outlook.com', port: 587, instructions: 'https://account.live.com/proofs/AppPassword', twoFactorUrl: 'https://account.live.com/proofs/manage/additional' },
  { label: 'Yahoo', host: 'smtp.mail.yahoo.com', port: 587, instructions: 'https://login.yahoo.com/account/security/app-passwords', twoFactorUrl: 'https://login.yahoo.com/account/security' },
];

export function SmtpSetup({ initialSmtp, onSmtpUpdated }: SmtpSetupProps) {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(initialSmtp?.verified ? 3 : 1);

  const [selectedPreset, setSelectedPreset] = useState(() => {
    if (!initialSmtp) return SMTP_PRESETS[0];
    return SMTP_PRESETS.find((p) => p.host === initialSmtp.host) || SMTP_PRESETS[0];
  });
  const [email, setEmail] = useState(initialSmtp?.email || '');
  const [password, setPassword] = useState(initialSmtp?.password || '');
  const [verified, setVerified] = useState(initialSmtp?.verified || false);

  const handleSaveAndTest = async () => {
    setLoading(true);
    setMessage(null);

    // Auto-detect host from email domain (override preset if mismatch)
    const emailDomain = email.split('@')[1]?.toLowerCase() || '';
    const domainToHost: Record<string, { host: string; port: number }> = {
      'gmail.com': { host: 'smtp.gmail.com', port: 587 },
      'googlemail.com': { host: 'smtp.gmail.com', port: 587 },
      'hotmail.com': { host: 'smtp-mail.outlook.com', port: 587 },
      'outlook.com': { host: 'smtp-mail.outlook.com', port: 587 },
      'live.com': { host: 'smtp-mail.outlook.com', port: 587 },
      'msn.com': { host: 'smtp-mail.outlook.com', port: 587 },
      'yahoo.com': { host: 'smtp.mail.yahoo.com', port: 587 },
      'yahoo.co.uk': { host: 'smtp.mail.yahoo.com', port: 587 },
    };
    const detected = domainToHost[emailDomain];
    const smtpHost = detected?.host || selectedPreset.host;
    const smtpPort = detected?.port || selectedPreset.port;

    try {
      const saveRes = await fetch('/api/user/smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: smtpHost,
          port: smtpPort,
          email,
          password,
        }),
      });

      if (!saveRes.ok) {
        const data = await saveRes.json();
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
        return;
      }

      setTesting(true);
      const testRes = await fetch('/api/user/smtp/test', { method: 'POST' });

      if (testRes.ok) {
        setVerified(true);
        const saveData = await saveRes.json();
        onSmtpUpdated({ ...saveData, verified: true });
        setMessage({ type: 'success', text: '✅ Connected! Test email sent to your inbox.' });
      } else {
        const data = await testRes.json();
        setMessage({ type: 'error', text: data.error || 'Connection failed. Check your app password.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setLoading(false);
      setTesting(false);
    }
  };

  // Already verified — show status
  if (verified && step === 3) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-lg">✓</div>
          <div>
            <h2 className="text-lg font-semibold">Email Connected</h2>
            <p className="text-sm text-gray-500">{email} via {selectedPreset.label}</p>
          </div>
          <span className="ml-auto px-3 py-1 text-xs rounded-full bg-green-100 text-green-700 font-medium">
            Verified
          </span>
        </div>
        <button
          onClick={() => { setStep(1); setVerified(false); }}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          Change email settings
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border p-6">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step === s ? 'bg-black text-white' : step > s ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
            }`}>
              {step > s ? '✓' : s}
            </div>
            {s < 3 && <div className={`w-8 h-0.5 ${step > s ? 'bg-green-300' : 'bg-gray-200'}`} />}
          </div>
        ))}
        <span className="text-sm text-gray-500 ml-2">
          {step === 1 && 'Enter email'}
          {step === 2 && 'Create app password'}
          {step === 3 && 'Connect'}
        </span>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Step 1: Enter email → auto-detect provider */}
      {step === 1 && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Enter your email</h2>
          <p className="text-sm text-gray-500 mb-4">
            Applications will be sent from your personal email. Recruiters reply directly to your inbox.
          </p>
          <div className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                const domain = e.target.value.split('@')[1]?.toLowerCase() || '';
                const match = SMTP_PRESETS.find(p =>
                  (p.label === 'Gmail' && (domain === 'gmail.com' || domain === 'googlemail.com')) ||
                  (p.label === 'Outlook / Hotmail' && ['hotmail.com', 'outlook.com', 'live.com', 'msn.com'].includes(domain)) ||
                  (p.label === 'Yahoo' && (domain === 'yahoo.com' || domain === 'yahoo.co.uk'))
                );
                if (match) setSelectedPreset(match);
              }}
              placeholder="your.email@gmail.com"
              className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg"
            />
            {email.includes('@') && (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-3 rounded-lg">
                <span className="text-lg">
                  {selectedPreset.label === 'Gmail' && '📧'}
                  {selectedPreset.label === 'Outlook / Hotmail' && '📬'}
                  {selectedPreset.label === 'Yahoo' && '📨'}
                </span>
                Detected: <strong>{selectedPreset.label}</strong>
              </div>
            )}
            <button
              onClick={() => {
                if (!email.includes('@')) {
                  setMessage({ type: 'error', text: 'Please enter a valid email address' });
                  return;
                }
                setStep(2);
              }}
              disabled={!email.includes('@')}
              className="w-full px-4 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors font-medium disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Create app password */}
      {step === 2 && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Create an App Password</h2>
          <p className="text-sm text-gray-500 mb-4">
            For security, {selectedPreset.label} requires a special &ldquo;App Password&rdquo; instead of your regular password.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
            <ol className="space-y-3 text-sm text-amber-900">
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-200 flex items-center justify-center text-xs font-bold shrink-0">1</span>
                <span>
                  Enable 2-Step Verification in your {selectedPreset.label} account
                  {' '}
                  <a
                    href={selectedPreset.twoFactorUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-semibold hover:text-amber-700"
                  >
                    (open settings)
                  </a>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-200 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <span>Click &ldquo;Open App Passwords&rdquo; below</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-200 flex items-center justify-center text-xs font-bold shrink-0">3</span>
                <span>Create a new password with name <strong>&ldquo;Freelanly&rdquo;</strong></span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-200 flex items-center justify-center text-xs font-bold shrink-0">4</span>
                <span>Copy the 16-character code, then come back here</span>
              </li>
            </ol>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs text-blue-800">
            <strong>Not working?</strong> If the App Passwords page says &ldquo;not available&rdquo;, you need to{' '}
            <a
              href={selectedPreset.twoFactorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold"
            >
              enable 2-Step Verification
            </a>
            {' '}first. After enabling it, come back and try again.
          </div>

          <a
            href={selectedPreset.instructions}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setStep(3)}
            className="inline-block w-full text-center px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium mb-3"
          >
            Open {selectedPreset.label} App Passwords →
          </a>

          <button
            onClick={() => setStep(1)}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            ← Back
          </button>
        </div>
      )}

      {/* Step 3: Enter credentials */}
      {step === 3 && !verified && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Paste App Password</h2>
          <p className="text-sm text-gray-500 mb-4">
            Paste the app password you created for <strong>{email}</strong>
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                App Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Paste the 16-character code here"
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-400">
                The special code from {selectedPreset.label}, not your regular password
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                ← Back
              </button>
              <button
                onClick={handleSaveAndTest}
                disabled={loading || !email || !password}
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm ml-auto disabled:opacity-50"
              >
                {loading ? (testing ? 'Testing connection...' : 'Saving...') : 'Save & Test Connection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
