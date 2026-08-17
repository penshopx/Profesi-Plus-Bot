---
name: Cross-platform alert wrapper
description: Alert.alert is a no-op on react-native-web; use the shared showAlert helper.
---

Rule: never call `Alert.alert` directly in the mobile app — use `showAlert` from `@/lib/alert`, which keeps the Alert.alert signature but maps to window.alert/confirm/prompt on web.

**Why:** react-native-web silently drops Alert.alert, so errors were invisible in web preview. Tests also spy on `Alert.alert`, so the wrapper must forward only the args actually provided (a trailing explicit `undefined` breaks `toHaveBeenCalledWith` arity).

**How to apply:** any new mobile dialog/error notice; on web, 3+ button menus render as a numbered window.prompt — prefer restructuring UI over adding more such menus.
