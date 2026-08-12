import React, { useEffect, useMemo } from 'react';
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
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
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

  const projectId = process.env.EXPO_PUBLIC_REPL_ID;
  if (!projectId) return;

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const authToken = await getToken();
    if (authToken && token) {
      await registerPushToken(token, authToken);
    }
  } catch {
    // Non-fatal — push is a nice-to-have
  }
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function RootLayoutNav() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn) {
      registerForPushNotifications(getToken);
    }
  }, [isSignedIn, getToken]);

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
