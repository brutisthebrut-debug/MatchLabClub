import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setBaseUrl } from "@workspace/api-client-react";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";

import {
  COACH_ACTION_DISMISS,
  COACH_ACTION_NOT_SENT,
  COACH_ACTION_SENT,
  COACH_ACTION_SNOOZE_1H,
  COACH_ACTION_SNOOZE_3H,
  COACH_NOTIFICATION_TYPE,
  cancelCoachReminder,
  configureNotificationHandler,
  loadCoachReminderPrefs,
  recordCoachDismissed,
  recordCoachFollowUp,
  recordCoachSnoozed,
  setPendingCoachFollowUpPrompt,
  snoozeCoachReminder,
} from "@/lib/coachNotifications";

import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

configureNotificationHandler();

import { ErrorBoundary } from "@/components/ErrorBoundary";

SplashScreen.preventAutoHideAsync();

const domain = process.env.EXPO_PUBLIC_DOMAIN;
if (domain) {
  setBaseUrl(`https://${domain}`);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function RootLayoutNav() {
  const router = useRouter();

  useEffect(() => {
    async function handleResponse(
      response: Notifications.NotificationResponse,
    ) {
      const data = response.notification.request.content.data;
      if (
        !data ||
        typeof data !== "object" ||
        (data as { type?: unknown }).type !== COACH_NOTIFICATION_TYPE
      ) {
        return;
      }
      const action = response.actionIdentifier;
      const matchName =
        typeof (data as { matchName?: unknown }).matchName === "string"
          ? ((data as { matchName?: string }).matchName as string)
          : undefined;
      if (action === COACH_ACTION_SENT) {
        await recordCoachFollowUp("sent");
        return;
      }
      if (action === COACH_ACTION_NOT_SENT) {
        await recordCoachFollowUp("not_sent");
        return;
      }
      if (action === COACH_ACTION_SNOOZE_1H) {
        const prefs = await loadCoachReminderPrefs();
        await snoozeCoachReminder({
          matchName,
          delaySeconds: prefs.snoozeShortSeconds,
        });
        await recordCoachSnoozed();
        return;
      }
      if (action === COACH_ACTION_SNOOZE_3H) {
        const prefs = await loadCoachReminderPrefs();
        await snoozeCoachReminder({
          matchName,
          delaySeconds: prefs.snoozeLongSeconds,
        });
        await recordCoachSnoozed();
        return;
      }
      if (action === COACH_ACTION_DISMISS) {
        await cancelCoachReminder();
        await recordCoachDismissed();
        return;
      }
      await setPendingCoachFollowUpPrompt();
      router.push("/coach");
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        void handleResponse(response);
      },
    );

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) void handleResponse(response);
      })
      .catch(() => {});

    return () => subscription.remove();
  }, [router]);

  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        headerStyle: { backgroundColor: "#0B0F1D" },
        headerTintColor: "#ECEEF5",
        contentStyle: { backgroundColor: "#0B0F1D" },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="audit/[id]" options={{ title: "Mini-report" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0B0F1D" }}>
            <KeyboardProvider>
              <StatusBar style="light" />
              <RootLayoutNav />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
