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
  { label: 'Gmail', host: 'smtp.gmail.com', port: 587, instructions: 'https://myaccount.google.com/apppasswords' },
  { label: 'Outlook / Hotmail', host: 'smtp-mail.outlook.com', port: 587, instructions: 'https://account.live.com/proofs/AppPassword' },
  { label: 'Yahoo', host: 'smtp.mail.yahoo.com', port: 587, instructions: 'https://login.yahoo.com/account/security/app-passwords' },
];

export function SmtpSetup({ initialSmtp, onSmtpUpdated }: SmtpSetupProps) {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [step, setStep] = useState<1 | 2>(initialSmtp?.verified ? 2 : 1);

  // Form state
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

    try {
      // Save first
      const saveRes = await fetch('/api/user/smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: selectedPreset.host,
          port: selectedPreset.port,
          email,
          password,
        }),
      });

      if (!saveRes.ok) {
        const data = await saveRes.json();
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
        return;
      }

      // Then test
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
  if (verified && step === 2) {
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
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step === s ? 'bg-black text-white' : step > s ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
            }`}>
              {step > s ? '✓' : s}
            </div>
            {s < 2 && <div className={`w-8 h-0.5 ${step > s ? 'bg-green-300' : 'bg-gray-200'}`} />}
          </div>
        ))}
        <span className="text-sm text-gray-500 ml-2">
          {step === 1 && 'Choose provider'}
          {step === 2 && 'Connect'}
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

      {/* Step 1: Choose provider */}
      {step === 1 && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Which email do you use?</h2>
          <p className="text-sm text-gray-500 mb-4">
            Applications will be sent from your personal email. Recruiters reply directly to your inbox.
          </p>
          <div className="space-y-2">
            {SMTP_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => { setSelectedPreset(preset); setStep(2); }}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all hover:border-gray-400 ${
                  selectedPreset.label === preset.label ? 'border-black bg-gray-50' : 'border-gray-200'
                }`}
              >
                <span className="text-2xl">
                  {preset.label === 'Gmail' && '📧'}
                  {preset.label === 'Outlook / Hotmail' && '📬'}
                  {preset.label === 'Yahoo' && '📨'}
                </span>
                <span className="font-medium">{preset.label}</span>
                <span className="ml-auto text-gray-400">→</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Create app password + Enter credentials (combined) */}
      {step === 2 && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Connect {selectedPreset.label}</h2>
          <p className="text-sm text-gray-500 mb-4">
            Create an App Password and enter your credentials below.
          </p>

          {/* Instructions */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <h3 className="text-sm font-semibold text-amber-900 mb-2">First, create an App Password:</h3>
            <ol className="space-y-1.5 text-sm text-amber-800 list-decimal list-inside mb-3">
              <li>Enable 2-Step Verification in your {selectedPreset.label} account</li>
              <li>Click below to open App Passwords page</li>
              <li>Create a password named <strong>&ldquo;Freelanly&rdquo;</strong></li>
              <li>Copy the 16-character code</li>
            </ol>
            <a
              href={selectedPreset.instructions}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 bg-amber-800 text-white rounded-lg hover:bg-amber-900 transition-colors text-sm font-medium"
            >
              Open {selectedPreset.label} App Passwords →
            </a>
          </div>

          {/* Credentials form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`your.email@${selectedPreset.label === 'Gmail' ? 'gmail.com' : selectedPreset.label === 'Yahoo' ? 'yahoo.com' : 'outlook.com'}`}
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
                placeholder="Paste the 16-character code here"
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-400">
                Not your regular password — the special code from the step above
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
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
