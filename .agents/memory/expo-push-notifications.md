---
name: Expo push notifications
description: How to send Expo push notifications from the Express server and register tokens from the mobile app.
---

**Server-side send:** POST to `https://exp.host/--/api/v2/push/send` with `{ to, title, body, data, channelId }`. No server credentials needed — Expo handles APNs/FCM routing. Fire-and-forget (`.catch()`); do not block the response.

**Push token storage:** Add `expoPushToken: text("expo_push_token")` to the `users` table. Register via `POST /api/users/me/push-token` (auth required).

**Mobile registration flow:**
1. Call in `useAuth`-aware component (e.g. `RootLayoutNav`) so the auth token is available.
2. `Notifications.getPermissionsAsync()` → `requestPermissionsAsync()` on first run.
3. Android requires a notification channel before `getExpoPushTokenAsync`.
4. `getExpoPushTokenAsync({ projectId })` — projectId is the Expo project ID, not the Replit repl ID. In this project `EXPO_PUBLIC_REPL_ID` is used as a stand-in; may need to replace with actual EAS project ID if publishing through EAS.
5. POST the token to the server with the Clerk auth bearer token.

**SDK 54 compatible versions:** `expo-notifications@~0.32.17`, `expo-device@~8.0.10`.

**Why:** The older `~0.29.x` / `~7.0.x` versions print compatibility warnings and may have API differences; always match the SDK 54 expected versions.
