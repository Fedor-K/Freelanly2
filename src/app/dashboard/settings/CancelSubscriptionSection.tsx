'use client';

import { useState } from 'react';
import { AlertTriangle, X, Gift, Pause, ArrowRight } from 'lucide-react';

interface CancelReason {
  value: string;
  label: string;
  emoji: string;
}

const CANCEL_REASONS: CancelReason[] = [
  { value: 'TOO_EXPENSIVE', label: 'Too expensive', emoji: '💰' },
  { value: 'NOT_ENOUGH_JOBS', label: 'Not enough relevant jobs', emoji: '📋' },
  { value: 'FOUND_JOB', label: 'I found a job!', emoji: '🎉' },
  { value: 'NOT_USING', label: "Not using it enough", emoji: '⏰' },
  { value: 'MISSING_FEATURES', label: 'Missing features I need', emoji: '🔧' },
  { value: 'TECHNICAL_ISSUES', label: 'Technical problems', emoji: '🐛' },
  { value: 'POOR_JOB_QUALITY', label: "Jobs don't match my skills", emoji: '🎯' },
  { value: 'OTHER', label: 'Other reason', emoji: '💬' },
];

type ModalStep = 'save-offers' | 'survey' | 'success' | 'offer-applied';

interface Props {
  subscriptionEndsAt: Date | null;
}

export function CancelSubscriptionSection({ subscriptionEndsAt }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState<ModalStep>('save-offers');
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [otherText, setOtherText] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [offerType, setOfferType] = useState<'discount' | 'pause' | null>(null);

  const handleApplyDiscount = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/user/apply-retention-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerType: 'discount' }),
      });

      if (res.ok) {
        setOfferType('discount');
        setStep('offer-applied');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to apply discount');
      }
    } catch {
      setError('Failed to apply discount. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePauseSubscription = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/user/apply-retention-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerType: 'pause' }),
      });

      if (res.ok) {
        setOfferType('pause');
        setStep('offer-applied');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to pause subscription');
      }
    } catch {
      setError('Failed to pause subscription. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedReason) {
      setError('Please select a reason');
      return;
    }

    if (selectedReason === 'OTHER' && !otherText.trim()) {
      setError('Please tell us your reason');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/user/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: selectedReason,
          otherText: selectedReason === 'OTHER' ? otherText : undefined,
          feedback: feedback || undefined,
        }),
      });

      if (res.ok) {
        setStep('success');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to cancel subscription');
      }
    } catch {
      setError('Failed to cancel subscription. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setStep('save-offers');
    setSelectedReason(null);
    setOtherText('');
    setFeedback('');
    setError('');
    setOfferType(null);
    if (step === 'success' || step === 'offer-applied') {
      window.location.reload();
    }
  };

  // If already set to cancel, show that info
  if (subscriptionEndsAt && new Date(subscriptionEndsAt) > new Date()) {
    return (
      <div className="mt-6 bg-yellow-50 rounded-xl border border-yellow-200 p-6">
        <h2 className="text-lg font-semibold text-yellow-800 mb-2">Subscription Ending</h2>
        <p className="text-sm text-yellow-700">
          Your PRO subscription will end on{' '}
          <strong>
            {new Date(subscriptionEndsAt).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </strong>
          . You&apos;ll keep access until then.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-2">Subscription</h2>
        <p className="text-sm text-gray-600 mb-4">
          Manage your PRO subscription
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="text-sm text-red-600 hover:text-red-700 hover:underline"
        >
          Cancel subscription
        </button>
      </div>

      {/* Cancellation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                {step === 'save-offers' && 'Before you go...'}
                {step === 'survey' && 'Cancel Subscription'}
                {step === 'success' && 'Subscription Canceled'}
                {step === 'offer-applied' && 'Great choice!'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Step 1: Save Offers */}
            {step === 'save-offers' && (
              <div className="p-4">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Gift className="h-8 w-8 text-purple-600" />
                  </div>
                  <h4 className="text-xl font-semibold mb-2">We&apos;d hate to see you go!</h4>
                  <p className="text-gray-600 text-sm">
                    Here are some options that might work better for you:
                  </p>
                </div>

                {/* Discount Offer */}
                <div className="border-2 border-purple-200 rounded-xl p-4 mb-3 bg-purple-50">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center shrink-0">
                      <span className="text-white font-bold">50%</span>
                    </div>
                    <div className="flex-1">
                      <h5 className="font-semibold text-purple-900">Get 50% off next month</h5>
                      <p className="text-sm text-purple-700 mb-3">
                        Stay with us at half price. That&apos;s just €10 for another month of PRO.
                      </p>
                      <button
                        onClick={handleApplyDiscount}
                        disabled={loading}
                        className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium disabled:opacity-50"
                      >
                        {loading ? 'Applying...' : 'Apply 50% Discount'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Pause Offer */}
                <div className="border rounded-xl p-4 mb-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                      <Pause className="h-5 w-5 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <h5 className="font-semibold">Pause for 1 month</h5>
                      <p className="text-sm text-gray-600 mb-3">
                        Take a break without losing your settings. Resume anytime.
                      </p>
                      <button
                        onClick={handlePauseSubscription}
                        disabled={loading}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
                      >
                        {loading ? 'Pausing...' : 'Pause Subscription'}
                      </button>
                    </div>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-600 mb-3">{error}</p>
                )}

                {/* Continue to Cancel */}
                <button
                  onClick={() => setStep('survey')}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-gray-500 hover:text-gray-700 text-sm"
                >
                  No thanks, continue to cancel
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Step 2: Survey */}
            {step === 'survey' && (
              <div className="p-4">
                {/* Warning */}
                <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg mb-4">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-800">Before you go...</p>
                    <p className="text-yellow-700">
                      Help us improve! Your feedback helps us make Freelanly better.
                    </p>
                  </div>
                </div>

                {/* Reason selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">
                    Why are you canceling?
                  </label>
                  <div className="space-y-2">
                    {CANCEL_REASONS.map((reason) => (
                      <label
                        key={reason.value}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedReason === reason.value
                            ? 'border-black bg-gray-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="reason"
                          value={reason.value}
                          checked={selectedReason === reason.value}
                          onChange={() => setSelectedReason(reason.value)}
                          className="sr-only"
                        />
                        <span className="text-lg">{reason.emoji}</span>
                        <span className="text-sm">{reason.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Other reason text */}
                {selectedReason === 'OTHER' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">
                      Please tell us more
                    </label>
                    <input
                      type="text"
                      value={otherText}
                      onChange={(e) => setOtherText(e.target.value)}
                      placeholder="Your reason..."
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    />
                  </div>
                )}

                {/* Additional feedback */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">
                    Anything else you&apos;d like to share? (optional)
                  </label>
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="How could we have done better?"
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-transparent resize-none"
                  />
                </div>

                {/* Error */}
                {error && (
                  <p className="text-sm text-red-600 mb-4">{error}</p>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('save-offers')}
                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm"
                    disabled={loading}
                  >
                    Go Back
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={loading || !selectedReason}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50"
                  >
                    {loading ? 'Canceling...' : 'Cancel Subscription'}
                  </button>
                </div>

                <p className="text-xs text-gray-500 text-center mt-3">
                  You&apos;ll keep PRO access until your billing period ends
                </p>
              </div>
            )}

            {/* Success: Subscription Canceled */}
            {step === 'success' && (
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">✓</span>
                </div>
                <h4 className="text-xl font-semibold mb-2">Subscription Canceled</h4>
                <p className="text-gray-600 mb-4">
                  Your subscription will end at the end of your current billing period.
                  You&apos;ll keep full access until then.
                </p>
                <button
                  onClick={closeModal}
                  className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
                >
                  Close
                </button>
              </div>
            )}

            {/* Success: Offer Applied */}
            {step === 'offer-applied' && (
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🎉</span>
                </div>
                <h4 className="text-xl font-semibold mb-2">
                  {offerType === 'discount' ? 'Discount Applied!' : 'Subscription Paused!'}
                </h4>
                <p className="text-gray-600 mb-4">
                  {offerType === 'discount'
                    ? "You'll get 50% off your next billing cycle. Thank you for staying with us!"
                    : "Your subscription is paused for 1 month. We'll resume it automatically after that."
                  }
                </p>
                <button
                  onClick={closeModal}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Continue to Dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
