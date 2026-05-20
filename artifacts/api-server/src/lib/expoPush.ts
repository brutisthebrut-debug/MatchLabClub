import { logger } from "./logger";

export type ExpoPushMessage = {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
};

export async function sendExpoPushNotifications(
  messages: ExpoPushMessage[],
): Promise<void> {
  if (messages.length === 0) return;

  const { Expo } = (await import("expo-server-sdk")) as typeof import("expo-server-sdk");
  const expo = new Expo();

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      for (const ticket of tickets) {
        if (ticket.status === "error") {
          logger.warn(
            { error: ticket.details?.error ?? ticket.message },
            "Expo push ticket error",
          );
        }
      }
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "Failed to send Expo push notification chunk",
      );
    }
  }
}

export async function isValidExpoPushToken(token: string): Promise<boolean> {
  const { Expo } = (await import("expo-server-sdk")) as typeof import("expo-server-sdk");
  return Expo.isExpoPushToken(token);
}
