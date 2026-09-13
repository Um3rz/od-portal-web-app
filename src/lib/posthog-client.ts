import posthog from "posthog-js";

let initialized = false;

export function initAnalytics() {
  if (initialized || typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key || !host) return;
  posthog.init(key, {
    api_host: host,
    capture_pageview: true,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
  });
  initialized = true;
}

export function captureEvent(event: string, properties?: Record<string, unknown>) {
  initAnalytics();
  if (!initialized) return;
  posthog.capture(event, properties);
}

export function captureClientException(error: unknown) {
  initAnalytics();
  if (!initialized) return;
  posthog.captureException(error);
}

export function identifyAccount(accountId: string) {
  initAnalytics();
  if (!initialized) return;
  const identifiedId = posthog.get_property("$user_id");
  if (typeof identifiedId === "string" && identifiedId !== accountId) posthog.reset();
  posthog.identify(accountId);
}

export function resetAnalytics() {
  initAnalytics();
  if (!initialized) return;
  posthog.reset();
}
