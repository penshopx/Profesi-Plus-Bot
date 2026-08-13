# Push Notification End-to-End Test Checklist

Push notifications are **only testable on a physical iOS or Android device** — Expo explicitly
blocks them on simulators and emulators. Use Expo Go or a standalone EAS development build.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Physical iOS or Android device | Not a simulator/emulator |
| EAS project configured | Run `eas init` once (requires `npm i -g eas-cli` and an Expo account), then paste the UUID into `app.json > extra.eas.projectId` |
| Gustafta API server reachable | Use the `.replit.dev` dev URL or a deployed instance |
| Clerk account signed in | Needed for authenticated token registration |
| At least one conversation in "synthesis" phase | Required to trigger Exum generation |

> **One-time EAS setup**:
> 1. `npm i -g eas-cli` (if not already installed)
> 2. `cd artifacts/gustafta-mobile && eas init`
> 3. Copy the UUID printed by `eas init` into `app.json > expo.extra.eas.projectId`.
>
> The `extra.eas.projectId` slot already exists in `app.json` — just replace the empty string with your UUID.

---

## Test 1 — Token Registration

**Goal**: Confirm that signing in on a physical device registers a push token in the database.

### Steps
1. Install the app on a physical device (Expo Go or EAS dev build).
2. Sign in with a Clerk account.
3. When prompted, **grant notification permissions**.
4. Check the dev console / Metro logs for:
   ```
   [push] Expo push token: ExponentPushToken[...]
   [push] Token registered with server successfully
   ```
5. Verify in the database:
   ```sql
   SELECT id, email, "expoPushToken" FROM users WHERE "expoPushToken" IS NOT NULL;
   ```

### Pass criteria
- `expoPushToken` column is populated with a valid `ExponentPushToken[...]` string.
- No `[push] getExpoPushTokenAsync failed` warning in Metro logs.

---

## Test 2 — Server Calls exp.host on Exum Generation

**Goal**: Confirm the API server POSTs to `exp.host` without errors when Exum is generated.

### Steps
1. Open a conversation that has reached the "synthesis" phase.
2. Tap **Generate Exum** (or tap the summary button).
3. Check the **API server logs** (workflow: `artifacts/api-server: API Server`) for:
   - Absence of `Failed to send Expo push` or `Expo push HTTP error` lines.
   - Optionally add a temporary `console.log` before the push call to confirm it's reached.

### Pass criteria
- No push-related errors in server logs.
- If the token is valid, no `DeviceNotRegistered` warning appears.

---

## Test 3 — Notification Appears on Locked Screen

**Goal**: Confirm the push notification is delivered and visible on the device.

### Steps
1. With the physical device **screen locked or app backgrounded**, trigger an Exum generation
   from another device / browser (same account) or from the app while it's in the background.
2. Observe the device's lock screen or notification shade.

### Pass criteria
- Notification appears with:
  - **Title**: "Exum Anda Siap! 🎉"
  - **Body**: "Executive Summary PKB telah selesai dibuat. Ketuk untuk melihat."
- On Android: the notification appears in the **"Exum Selesai"** channel
  (Settings → App → Notifications).

---

## Test 4 — Deep-Link Tap Opens Exum Modal

This test covers three app states. Run at least **4a** and **4b**; **4c** is for thoroughness.

### 4a — App in Background (most common)
1. Open the app, navigate to any screen, then press the Home button (app backgrounded).
2. Trigger an Exum generation.
3. When the notification appears, **tap it**.

**Pass**: App comes to the foreground and opens the Exum modal for the correct conversation.

---

### 4b — App Completely Killed (cold-start)
1. Force-quit the app entirely.
2. Trigger an Exum generation from another device or browser.
3. **Tap the notification** from the lock screen or notification shade.

**Pass**: App launches fresh and navigates directly to the correct chat with the Exum modal open.
(This uses `getLastNotificationResponseAsync` added in this task — if this test failed before
and passes now, the cold-start fix is working.)

---

### 4c — App in Foreground
1. Have the app open on a **different** chat screen.
2. Trigger an Exum generation for another conversation.
3. The in-app banner should appear automatically (handled by `setNotificationHandler`).
4. **Tap the in-app banner**.

**Pass**: App navigates to the correct chat and opens the Exum modal.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `[push] getExpoPushTokenAsync failed` in logs | No EAS `projectId` set | Add `extra.eas.projectId` to `app.json` |
| Token is null / not registered | Notification permission denied | Grant permission in device Settings |
| Token registered but no notification arrives | Incorrect token sent to exp.host | Check server logs; test token via Expo's push tool at https://expo.dev/notifications |
| Notification arrives but tap does nothing | Cold-start deep-link not handled | Verify `getLastNotificationResponseAsync` is in `_layout.tsx` (added in this task) |
| Android notification shows but no channel | `setNotificationChannelAsync` skipped | Check that `Platform.OS === 'android'` branch runs; verify channel in device Settings |
| `DeviceNotRegistered` in server logs | App was reinstalled / token expired | Reinstall and sign in again — the server clears stale tokens automatically |

---

## Test 5 — Token Replacement on Reinstall

**Goal**: Confirm that reinstalling the app and signing in again replaces the old token in the database (not appends a second one).

### Steps
1. Note the current `expoPushToken` for your test account:
   ```sql
   SELECT id, email, "expoPushToken", "expoPushTokenSetAt" FROM users WHERE email = '<your-email>';
   ```
2. Uninstall the app from the physical device.
3. Reinstall (via Expo Go or an EAS build) and sign in with the **same Clerk account**.
4. Grant notification permissions when prompted.
5. Re-run the SQL query above.

### Pass criteria
- `expoPushToken` is updated to a new `ExponentPushToken[...]` value (may be the same token if the OS reuses it, which is also valid).
- `expoPushTokenSetAt` is updated to roughly `now()` — confirming the timestamp is being written.
- There is still only **one row** for the user — no duplicate tokens.

---

## Test 6 — Stale Token Cleanup on Server Restart

**Goal**: Confirm the startup job clears push tokens that are older than 90 days or have no recorded `expoPushTokenSetAt`.

> This is a manual simulation test — artificially age a token to trigger cleanup without waiting 90 real days.

### Steps
1. Find a test user that has a push token registered:
   ```sql
   SELECT id, email, "expoPushToken", "expoPushTokenSetAt" FROM users WHERE "expoPushToken" IS NOT NULL;
   ```
2. Manually backdate `expoPushTokenSetAt` to 91 days ago (or set it to NULL):
   ```sql
   -- Age the token
   UPDATE users
     SET "expoPushTokenSetAt" = NOW() - INTERVAL '91 days'
     WHERE id = <user-id>;
   -- Or simulate pre-migration state (NULL timestamp):
   -- UPDATE users SET "expoPushTokenSetAt" = NULL WHERE id = <user-id>;
   ```
3. Restart the API server workflow (`artifacts/api-server: API Server`).
4. Check the API server logs for:
   ```
   Cleared stale Expo push tokens
   ```
5. Re-run the SQL from Step 1.

### Pass criteria
- `expoPushToken` is now `NULL` for the affected user.
- `expoPushTokenSetAt` is now `NULL` for the affected user.
- The log line shows `count: 1` (or more if multiple stale tokens existed).
- A production push to a reinstalled user immediately after sign-in still works (token was refreshed in step 3 of Test 5).

---

## Expo Push Notification Test Tool

You can manually send a test push notification without triggering Exum:

```bash
curl -X POST https://exp.host/--/api/v2/push/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "ExponentPushToken[PASTE_TOKEN_HERE]",
    "title": "Test Notification",
    "body": "This is a manual test.",
    "data": { "conversationId": "123" },
    "channelId": "exum"
  }'
```

Replace `PASTE_TOKEN_HERE` with the token from the database or Metro logs. A successful response
returns `{ "data": [{ "status": "ok", "id": "..." }] }`.
