/**
 * Cross-platform alert helper.
 *
 * React Native's `Alert.alert` is a NO-OP on web (react-native-web), so any
 * error notice using it fails silently in the web preview. This helper keeps
 * the exact `Alert.alert` signature: on native it delegates to Alert.alert
 * unchanged; on web it maps to window.alert / window.confirm so messages and
 * button callbacks still work.
 *
 * Usage: replace `Alert.alert(...)` with `showAlert(...)`.
 */

import { Alert, Platform, type AlertButton } from 'react-native';

export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
): void {
  if (Platform.OS !== 'web') {
    // Forward only the args actually provided so call sites (and tests
    // asserting on Alert.alert) see the same arity as a direct call.
    if (buttons !== undefined) Alert.alert(title, message, buttons);
    else if (message !== undefined) Alert.alert(title, message);
    else Alert.alert(title);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length === 0) {
    window.alert(text);
    return;
  }

  const cancelBtn = buttons.find((b) => b.style === 'cancel');
  const actions = buttons.filter((b) => b.style !== 'cancel');

  if (actions.length === 0) {
    // Only a cancel/OK-style button
    window.alert(text);
    cancelBtn?.onPress?.();
    return;
  }

  if (actions.length === 1) {
    if (cancelBtn) {
      // Two-way choice → confirm dialog
      const label = actions[0].text ? ` (${actions[0].text}?)` : '';
      if (window.confirm(`${text}${label}`)) {
        actions[0].onPress?.();
      } else {
        cancelBtn.onPress?.();
      }
    } else {
      window.alert(text);
      actions[0].onPress?.();
    }
    return;
  }

  // 3+ options (e.g. pick camera vs gallery) → numbered prompt
  const menu = actions
    .map((b, i) => `${i + 1}. ${b.text ?? `Opsi ${i + 1}`}`)
    .join('\n');
  const answer = window.prompt(
    `${text}\n\n${menu}\n\nKetik nomor pilihan (batal untuk menutup):`,
  );
  if (answer === null) {
    cancelBtn?.onPress?.();
    return;
  }
  const idx = parseInt(answer.trim(), 10) - 1;
  if (idx >= 0 && idx < actions.length) {
    actions[idx].onPress?.();
  } else {
    cancelBtn?.onPress?.();
  }
}
