import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { registerPushToken } from '@/lib/api';

/**
 * Fetches the current Expo push token and PATCHes it to the server.
 * Non-fatal on failure: if the Expo token can't be obtained, no request is
 * sent and no error is thrown (push is a nice-to-have).
 */
export async function registerForPushNotifications(
  getToken: () => Promise<string | null>,
): Promise<void> {
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
    await Notifications.setNotificationChannelAsync('kegiatan', {
      name: 'Update Kegiatan PKB',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7C3AED',
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

/**
 * Keeps the server's copy of this device's Expo push token fresh:
 * 1. Registers once on sign-in.
 * 2. Re-registers silently when the OS rotates the token (push token listener).
 * 3. Re-registers on every foreground ('active') AppState transition, so a
 *    token rotated while the app was backgrounded is picked up without a
 *    sign-out/in. The PATCH endpoint is idempotent, so frequent calls are safe.
 */
export function usePushRegistration(
  isSignedIn: boolean | undefined,
  getToken: () => Promise<string | null>,
): void {
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

  // Re-register on every foreground event so a rotated token (e.g. after a
  // system update or device reset) is picked up even without signing out/in.
  useEffect(() => {
    if (!isSignedIn) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        registerForPushNotifications(getToken);
      }
    });
    return () => subscription.remove();
  }, [isSignedIn, getToken]);
}
