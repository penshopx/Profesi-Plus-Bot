import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { useSSO, isClerkAPIResponseError } from '@clerk/expo';
import { useSignIn } from '@clerk/expo/legacy';
import { Link, useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

WebBrowser.maybeCompleteAuthSession();

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

export default function SignInScreen() {
  useWarmUpBrowser();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startSSOFlow } = useSSO();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [globalError, setGlobalError] = useState('');

  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;
  const isBusy = loading || ssoLoading;

  const clearErrors = () => {
    setEmailError('');
    setPasswordError('');
    setGlobalError('');
  };

  const handleEmailSignIn = async () => {
    if (!isLoaded || !email || !password || isBusy) return;
    clearErrors();
    setLoading(true);
    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(home)/(tabs)');
      }
    } catch (err) {
      if (isClerkAPIResponseError(err)) {
        for (const e of err.errors) {
          if (e.meta?.paramName === 'identifier' || e.code === 'form_identifier_not_found') {
            setEmailError(e.longMessage ?? e.message);
          } else if (e.meta?.paramName === 'password' || e.code === 'form_password_incorrect') {
            setPasswordError(e.longMessage ?? e.message);
          } else {
            setGlobalError(e.longMessage ?? e.message);
          }
        }
      } else {
        setGlobalError('Terjadi kesalahan. Silakan coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = useCallback(async () => {
    if (!isLoaded || isBusy) return;
    clearErrors();
    try {
      setSsoLoading(true);
      const { createdSessionId, setActive: activate } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && activate) {
        await activate({ session: createdSessionId });
        router.replace('/(home)/(tabs)');
      }
    } catch (err) {
      if (isClerkAPIResponseError(err)) {
        setGlobalError(err.errors[0]?.longMessage ?? 'Google sign-in gagal.');
      } else {
        setGlobalError('Google sign-in gagal.');
      }
    } finally {
      setSsoLoading(false);
    }
  }, [isLoaded, startSSOFlow, router, isBusy]);

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 40, paddingBottom: bottomPad + 24 },
      ]}
      bottomOffset={20}
    >
      {/* Logo + heading */}
      <View style={styles.header}>
        <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
          <MaterialCommunityIcons name="certificate-outline" size={30} color="#fff" />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Selamat datang
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Masuk ke akun Gustafta PKB Anda
        </Text>
      </View>

      {/* Google SSO */}
      <Pressable
        style={({ pressed }) => [
          styles.socialBtn,
          {
            borderColor: colors.border,
            backgroundColor: pressed ? colors.muted : colors.card,
          },
        ]}
        onPress={handleGoogleSignIn}
        disabled={isBusy}
      >
        {ssoLoading ? (
          <ActivityIndicator size="small" color={colors.foreground} />
        ) : (
          <>
            <MaterialCommunityIcons name="google" size={20} color="#EA4335" />
            <Text style={[styles.socialBtnText, { color: colors.foreground }]}>
              Lanjutkan dengan Google
            </Text>
          </>
        )}
      </Pressable>

      {/* Divider */}
      <View style={styles.divider}>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>atau</Text>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
      </View>

      {/* Global error */}
      {globalError ? (
        <View style={[styles.alertBox, { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '44' }]}>
          <Feather name="alert-circle" size={14} color={colors.destructive} />
          <Text style={[styles.alertText, { color: colors.destructive }]}>{globalError}</Text>
        </View>
      ) : null}

      {/* Email */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Email</Text>
        <View
          style={[
            styles.inputWrap,
            {
              borderColor: emailError ? colors.destructive : colors.border,
              backgroundColor: colors.card,
            },
          ]}
        >
          <Feather name="mail" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            value={email}
            onChangeText={(v) => { setEmail(v); clearErrors(); }}
            placeholder="nama@email.com"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
        </View>
        {emailError ? (
          <Text style={[styles.errText, { color: colors.destructive }]}>{emailError}</Text>
        ) : null}
      </View>

      {/* Password */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Kata sandi</Text>
        <View
          style={[
            styles.inputWrap,
            {
              borderColor: passwordError ? colors.destructive : colors.border,
              backgroundColor: colors.card,
            },
          ]}
        >
          <Feather name="lock" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            value={password}
            onChangeText={(v) => { setPassword(v); clearErrors(); }}
            placeholder="••••••••"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry={!showPassword}
            autoComplete="password"
          />
          <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
            <Feather name={showPassword ? 'eye-off' : 'eye'} size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
        {passwordError ? (
          <Text style={[styles.errText, { color: colors.destructive }]}>{passwordError}</Text>
        ) : null}
      </View>

      {/* Submit */}
      <Pressable
        style={({ pressed }) => [
          styles.submitBtn,
          {
            backgroundColor: !email || !password || isBusy ? colors.muted : colors.primary,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
        onPress={handleEmailSignIn}
        disabled={!email || !password || isBusy}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={[styles.submitText, { color: !email || !password ? colors.mutedForeground : '#fff' }]}>
            Masuk
          </Text>
        )}
      </Pressable>

      {/* Sign-up link */}
      <View style={styles.linkRow}>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'PlusJakartaSans_400Regular' }}>
          Belum punya akun?{' '}
        </Text>
        <Link href="/(auth)/sign-up">
          <Text style={{ color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
            Daftar
          </Text>
        </Link>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, flexGrow: 1 },
  header: { alignItems: 'center', marginBottom: 32 },
  logoMark: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 26, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 8 },
  subtitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center' },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 24,
  },
  socialBtnText: { fontSize: 15, fontFamily: 'PlusJakartaSans_500Medium' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular' },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  alertText: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', flex: 1 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 50,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, fontFamily: 'PlusJakartaSans_400Regular' },
  eyeBtn: { padding: 4 },
  errText: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 4 },
  submitBtn: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  submitText: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold' },
  linkRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
