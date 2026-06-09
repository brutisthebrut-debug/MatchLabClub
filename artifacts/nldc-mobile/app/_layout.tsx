import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { setAuthTokenGetter, setBaseUrl, setCredentials } from "@workspace/api-client-react";
import { AuthProvider, getStoredAuthToken } from "@/lib/auth";
import { useClaimAnonymousOnLogin } from "@/lib/useClaimAnonymousOnLogin";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect } from "react";

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
import { TRASH_NOTIFICATION_TYPE } from "@/lib/auditTrashNotifications";

export const NEW_SIGN_IN_NOTIFICATION_TYPE = "new-sign-in";

import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

configureNotificationHandler();

import { ErrorBoundary } from "@/components/ErrorBoundary";

SplashScreen.preventAutoHideAsync();

const domain = process.env.EXPO_PUBLIC_DOMAIN;
if (domain) {
  setBaseUrl(`https://${domain}`);
  setCredentials("include");
}

setAuthTokenGetter(() => getStoredAuthToken());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function AuthDependentEffects() {
  // Mounted inside AuthProvider so it can read auth state. When the user
  // signs in, reassign any anonymous audits/sessions/etc. recorded on this
  // device to their account.
  useClaimAnonymousOnLogin();
  return null;
}

function RootLayoutNav() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const handleAuthChange = useCallback(() => {
    // Re-fetch every user-scoped query when the auth identity flips.
    void queryClient.invalidateQueries();
  }, [queryClient]);

  useEffect(() => {
    async function handleResponse(
      response: Notifications.NotificationResponse,
    ) {
      const data = response.notification.request.content.data;
      if (!data || typeof data !== "object") return;
      const type = (data as { type?: unknown }).type;
      if (type === TRASH_NOTIFICATION_TYPE) {
        router.push("/trash");
        return;
      }
      if (type === NEW_SIGN_IN_NOTIFICATION_TYPE) {
        router.push("/sessions");
        return;
      }
      if (type !== COACH_NOTIFICATION_TYPE) {
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
          mode: prefs.snoozeShort,
        });
        await recordCoachSnoozed();
        return;
      }
      if (action === COACH_ACTION_SNOOZE_3H) {
        const prefs = await loadCoachReminderPrefs();
        await snoozeCoachReminder({
          matchName,
          mode: prefs.snoozeLong,
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
    <AuthProvider onAuthChange={handleAuthChange}>
      <AuthDependentEffects />
      <Stack
        screenOptions={{
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: "#07061A" },
          headerTintColor: "#F1F0FA",
          contentStyle: { backgroundColor: "#07061A" },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="audit/[id]" options={{ title: "Mini-report" }} />
        <Stack.Screen name="trash" options={{ title: "Recently deleted" }} />
        <Stack.Screen name="journal" options={{ title: "Your journal" }} />
        <Stack.Screen name="dates" options={{ title: "Post-date notes" }} />
        <Stack.Screen
          name="sessions"
          options={{ title: "Devices & sign-ins" }}
        />
        <Stack.Screen name="compass" options={{ title: "Compatibility Compass" }} />
        <Stack.Screen name="imports" options={{ title: "Imports" }} />
        <Stack.Screen name="mirror" options={{ title: "Your Mirror" }} />
        <Stack.Screen name="connections" options={{ title: "Conversations" }} />
        <Stack.Screen name="messages/[id]" options={{ title: "Conversation" }} />
        <Stack.Screen name="matching" options={{ title: "Match" }} />
      </Stack>
    </AuthProvider>
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
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#07061A" }}>
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
