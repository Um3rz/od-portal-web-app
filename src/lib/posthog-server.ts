import "server-only";
import { PostHog } from "posthog-node";

export function getPostHogClient() {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!posthogKey || !posthogHost) {
    if (process.env.NODE_ENV !== "production") {
      const variable = !posthogKey ? "NEXT_PUBLIC_POSTHOG_KEY" : "NEXT_PUBLIC_POSTHOG_HOST";
      throw new Error(
        `${variable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variable} is configured`,
      );
    }
    return null;
  }

  return new PostHog(posthogKey, {
    host: posthogHost,
    flushAt: 1,
    flushInterval: 0,
    enableExceptionAutocapture: true,
  });
}

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
) {
  const posthog = getPostHogClient();
  if (!posthog) return;
  posthog.capture({ distinctId, event, properties });
  await posthog.shutdown();
}

export async function captureServerException(error: unknown, distinctId: string) {
  const posthog = getPostHogClient();
  if (!posthog) return;
  posthog.captureException(error, distinctId);
  await posthog.shutdown();
}
