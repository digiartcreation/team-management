import crypto from "crypto";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";

type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

type WebPushModule = {
  setVapidDetails: (
    subject: string,
    publicKey: string,
    privateKey: string
  ) => void;
  sendNotification: (
    subscription: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    },
    payload: string,
    options?: { timeout?: number }
  ) => Promise<unknown>;
};

/**
 * How long one push service may take to answer. web-push has no limit of its
 * own, so a push service that never answered kept the work waiting forever.
 */
const PUSH_TIMEOUT_MS = 10_000;

const dynamicImport = new Function(
  "modulePath",
  "return import(modulePath)"
) as (modulePath: string) => Promise<{ default?: WebPushModule } & WebPushModule>;

export function hashEndpoint(endpoint: string) {
  return crypto.createHash("sha256").update(endpoint).digest("hex");
}

// Loaded and given the VAPID keys once per server process, not per push.
let webPushReady: Promise<WebPushModule | null> | undefined;

function getWebPush() {
  webPushReady ??= loadWebPush();
  return webPushReady;
}

async function loadWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return null;
  }

  try {
    const imported = await dynamicImport("web-push");
    const webPush = imported.default ?? imported;

    webPush.setVapidDetails(subject, publicKey, privateKey);
    return webPush;
  } catch (error) {
    console.error("Push notification package is unavailable.", error);
    return null;
  }
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  const webPush = await getWebPush();

  if (!webPush) {
    return;
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId, enabled: true },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          JSON.stringify(payload),
          { timeout: PUSH_TIMEOUT_MS }
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;

        // 404 / 410: the browser has dropped this subscription for good.
        // Switch it off so later notifications stop trying it; subscribing
        // again from that browser turns it back on (app/api/push/subscribe).
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription
            .update({ where: { id: subscription.id }, data: { enabled: false } })
            .catch(() => {});
          return;
        }

        console.error("Push notification delivery failed.", error);
      }
    })
  );
}

/**
 * Sends the push once the response has gone out, so whoever saved the change
 * does not wait on the push services. The notification row itself is written
 * before this, so pages and counts are unchanged.
 */
export function sendPushAfterResponse(userId: string, payload: PushPayload) {
  try {
    after(() => sendPushToUser(userId, payload));
  } catch {
    // Outside a request (a script, say) there is no response to wait for.
    void sendPushToUser(userId, payload);
  }
}

export async function notifyUsersWithPush(
  userIds: string[],
  payload: PushPayload
) {
  await Promise.all(userIds.map((userId) => sendPushToUser(userId, payload)));
}
