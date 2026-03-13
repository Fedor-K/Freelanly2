"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Reads UTM params from URL and saves them to a "conv_utm" cookie (30 days).
 * Only writes if utm_source is present in the URL.
 * Cookie format: source:value|medium:value|campaign:value
 */
export function ConversionUTMTracker() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const utmSource = searchParams.get("utm_source");
    if (!utmSource) return;

    const utmMedium = searchParams.get("utm_medium") || "";
    const utmCampaign = searchParams.get("utm_campaign") || "";

    const value = `source:${utmSource}|medium:${utmMedium}|campaign:${utmCampaign}`;
    const maxAge = 30 * 24 * 60 * 60; // 30 days
    document.cookie = `conv_utm=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  }, [searchParams]);

  return null;
}
