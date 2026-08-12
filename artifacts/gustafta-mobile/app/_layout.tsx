import React, { useEffect, useRef, useMemo } from 'react';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { registerPushToken } from '@/lib/api';

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ─── Per-user query isolation ─────────────────────────────────────────────────
//
// A fresh QueryClient is created for each distinct userId so that the in-memory
// cache from a previous account is never visible to the next account's render.
// The `key` prop on UserQueryProvider forces React to fully unmount and remount
// the subtree — including all child queries — whenever the user identity changes.
// This eliminates the race window that exists with a global client + useEffect.

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 30_000,
        // Keep cached data for 24 h so offline reads survive app restarts
        gcTime: 24 * 60 * 60 * 1_000,
      },
    },
  });
}

/**
 * Renders a fresh QueryClient + AsyncStorage persister keyed to `userId`.
 * This component is always mounted with a unique `key` (see AuthQueryWrapper),
 * so `useMemo([], [])` is safe — the component only lives for one user session.
 */
function UserQueryProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  // Both client and persister are stable for the lifetime of this mount.
  const client = useMemo(() => makeQueryClient(), []);
  const persister = useMemo(
    () =>
      createAsyncStoragePersister({
        storage: AsyncStorage,
        key: `GUSTAFTA_RQ_CACHE_${userId}`,
        throttleTime: 1_000,
      }),
    [userId],
  );

  return (
    <PersistQueryClientProvider client={client} persistOptions={{ persister }}>
      {children}
    </PersistQueryClientProvider>
  );
}

/**
 * Reads the current userId from Clerk and mounts a `UserQueryProvider` keyed
 * to it. When the user signs out or switches accounts React unmounts the old
 * subtree (and its QueryClient) before mounting the new one, preventing any
 * cross-account data leakage through the in-memory cache.
 *
 * While no user is authenticated (userId is null/undefined) we still need the
 * React Query context for unauthenticated screens (e.g. sign-in), so we fall
 * back to a plain QueryClientProvider with an ephemeral client.
 */
function AuthQueryWrapper({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();

  // Always created unconditionally so hook count is stable across all
  // userId transitions (null → userId, userId → null, userId → userId2).
  // This client is only mounted when no user is authenticated; it is
  // intentionally ephemeral and carries no sensitive cached data.
  const anonClient = useMemo(() => makeQueryClient(), []);

  if (!userId) {
    return (
      <QueryClientProvider client={anonClient}>
        {children}
      </QueryClientProvider>
    );
  }

  // `key` forces a full remount of UserQueryProvider — and therefore a fresh
  // QueryClient — whenever the authenticated identity changes.
  return (
    <UserQueryProvider key={userId} userId={userId}>
      {children}
    </UserQueryProvider>
  );
}

// ─── Push notifications ───────────────────────────────────────────────────────

async function registerForPushNotifications(getToken: () => Promise<string | null>): Promise<void> {
  if (!Device.isDevice) return;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('exum', {
      name: 'Exum Selesai',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1AA890',
    });
  }

  // Prefer the EAS project ID baked into the app config (set via `eas init` or
  // `app.json extra.eas.projectId`). In Expo Go the project ID is inferred from
  // the manifest so we can omit it; in standalone builds it must be provided.
  const projectId: string | undefined =
    (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ??
    (Constants.easConfig?.projectId as string | undefined);

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : {},
    );
    if (__DEV__) console.log('[push] Expo push token:', token);
    const authToken = await getToken();
    if (authToken && token) {
      await registerPushToken(token, authToken);
      if (__DEV__) console.log('[push] Token registered with server successfully');
    }
  } catch (err) {
    // Non-fatal — push is a nice-to-have, but surface it in dev so it's never silently lost
    if (__DEV__) console.warn('[push] getExpoPushTokenAsync failed:', err);
  }
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function RootLayoutNav() {
  const { getToken, isSignedIn } = useAuth();
  const router = useRouter();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (isSignedIn) {
      registerForPushNotifications(getToken);
    }
  }, [isSignedIn, getToken]);

  // Re-register silently whenever the device push token changes (OS upgrade,
  // device reset, app reinstall) so the server always holds a valid token.
  useEffect(() => {
    if (!isSignedIn) return;
    const subscription = Notifications.addPushTokenListener(async ({ data: newToken }) => {
      try {
        const authToken = await getToken();
        if (authToken && newToken) {
          await registerPushToken(newToken, authToken);
          if (__DEV__) console.log('[push] Token refreshed silently:', newToken);
        }
      } catch (err) {
        if (__DEV__) console.warn('[push] Silent token refresh failed:', err);
      }
    });
    return () => subscription.remove();
  }, [isSignedIn, getToken]);

  // Handle notification taps: deep-link to the chat screen and open the Exum modal.
  useEffect(() => {
    // ── Cold-start case ──────────────────────────────────────────────────────
    // When the app is fully killed and the user taps a push notification,
    // `addNotificationResponseReceivedListener` does NOT fire — the OS launches
    // the app fresh. `getLastNotificationResponseAsync` retrieves that initial
    // response so the deep-link still works after a cold launch.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as Record<string, unknown>;
      const conversationId = data?.conversationId;
      if (conversationId) {
        router.push(`/(home)/chat/${conversationId}?openExum=true` as never);
      }
    });

    // ── Foreground / background case ─────────────────────────────────────────
    // Foreground notification display is already configured via setNotificationHandler above.
    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      // No-op in foreground — the banner is shown automatically.
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const conversationId = data?.conversationId;
      if (conversationId) {
        // Navigate to the chat and signal that the Exum modal should open.
        router.push(`/(home)/chat/${conversationId}?openExum=true` as never);
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(home)" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;
const proxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache} proxyUrl={proxyUrl}>
      <SafeAreaProvider>
        <ErrorBoundary>
          {/* AuthQueryWrapper must be inside ClerkProvider to call useAuth() */}
          <AuthQueryWrapper>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </AuthQueryWrapper>
        </ErrorBoundary>
      </SafeAreaProvider>
    </ClerkProvider>
  );
}
