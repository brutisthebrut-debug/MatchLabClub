import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Best-effort lookup of the Expo push token for the device currently
 * performing a sign-in. Returned to the server so the new-sign-in push
 * notification skips this device (the device that just signed in does
 * not need to alert itself).
 *
 * Returns null on web, when permission has not been granted, or when
 * any failure occurs — the signing-in flow must not block on this.
 */
export async function getSigningInDevicePushToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return null;
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data || null;
  } catch {
    return null;
  }
}
