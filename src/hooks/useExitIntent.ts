'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseExitIntentOptions {
  threshold?: number; // How close to top before triggering (px)
  delay?: number; // Delay before enabling detection (ms)
  cookieName?: string; // Cookie to check if already shown
  cookieDays?: number; // How long to remember dismissal
}

export function useExitIntent(options: UseExitIntentOptions = {}) {
  const {
    threshold = 50,
    delay = 2000, // Wait 2 seconds before enabling
    cookieName = 'exit_intent_shown',
    cookieDays = 7,
  } = options;

  const [showPopup, setShowPopup] = useState(false);
  const [enabled, setEnabled] = useState(false);

  // Check if cookie exists
  const hasCookie = useCallback(() => {
    if (typeof document === 'undefined') return true;
    return document.cookie.includes(`${cookieName}=true`);
  }, [cookieName]);

  // Set cookie
  const setCookie = useCallback(() => {
    if (typeof document === 'undefined') return;
    const expires = new Date();
    expires.setDate(expires.getDate() + cookieDays);
    document.cookie = `${cookieName}=true; expires=${expires.toUTCString()}; path=/`;
  }, [cookieName, cookieDays]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(
    (e: MouseEvent) => {
      // Only trigger if mouse leaves through the top of the page
      if (e.clientY <= threshold && enabled && !showPopup && !hasCookie()) {
        setShowPopup(true);
      }
    },
    [threshold, enabled, showPopup, hasCookie]
  );

  // Close popup and set cookie
  const closePopup = useCallback(() => {
    setShowPopup(false);
    setCookie();
  }, [setCookie]);

  // Enable after delay
  useEffect(() => {
    // Don't enable if cookie exists
    if (hasCookie()) return;

    const timer = setTimeout(() => {
      setEnabled(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, hasCookie]);

  // Add mouse leave listener
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [enabled, handleMouseLeave]);

  return {
    showPopup,
    closePopup,
    // For manual trigger (e.g., testing)
    triggerPopup: () => !hasCookie() && setShowPopup(true),
  };
}
