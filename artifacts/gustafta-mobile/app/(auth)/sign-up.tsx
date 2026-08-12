import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { isClerkAPIResponseError } from '@clerk/expo';
import { useSignUp } from '@clerk/expo/legacy';
import { Link, useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

export default function SignUpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;
  const isBusy = loading;

  const clearErrors = () => { setGlobalError(''); setFieldErrors({}); };

  const handleClerkError = (err: unknown, fallback: string) => {
    if (isClerkAPIResponseError(err)) {
      const newFieldErrors: Record<string, string> = {};
      for (const e of err.errors) {
        const param = e.meta?.paramName ?? '';
        if (param === 'email_address') newFieldErrors.email = e.longMessage ?? e.message;
        else if (param === 'password') newFieldErrors.password = e.longMessage ?? e.message;
        else setGlobalError(e.longMessage ?? e.message);
      }
      if (Object.keys(newFieldErrors).length) setFieldErrors(newFieldErrors);
    } else {
      setGlobalError(fallback);
    }
  };

  const handleSubmit = async () => {
    if (!isLoaded || !email || !password || isBusy) return;
    clearErrors();
    setLoading(true);
    try {
      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0] || undefined;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;
      await signUp.create({
        emailAddress: email,
        password,
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
      });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err) {
      handleClerkError(err, 'Pendaftaran gagal. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded || !code || isBusy) return;
    clearErrors();
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(home)/(tabs)');
      } else {
        setGlobalError('Verifikasi belum selesai. Coba lagi.');
      }
    } catch (err) {
      handleClerkError(err, 'Kode tidak valid. Silakan periksa kembali.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!isLoaded || isBusy) return;
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
    } catch (err) {
      setGlobalError('Gagal mengirim ulang kode.');
    }
  };

  // ── Verification step ──────────────────────────────────────────────────────
  if (pendingVerification) {
    return (
      <KeyboardAwareScrollViewCompat
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[styles.content, { paddingTop: topPad + 40, paddingBottom: bottomPad + 24 }]}
        bottomOffset={20}
      >
        <View style={styles.header}>
          <View style={[styles.logoMark, { backgroundColor: colors.accent }]}>
            <Feather name="mail" size={28} color="#fff" />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Verifikasi Email</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Kami mengirimkan kode ke {email}
          </Text>
        </View>

        {globalError ? (
          <View style={[styles.alertBox, { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '44' }]}>
            <Feather name="alert-circle" size={14} color={colors.destructive} />
            <Text style={[styles.alertText, { color: colors.destructive }]}>{globalError}</Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Kode verifikasi</Text>
          <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Feather name="key" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              value={code}
              onChangeText={(v) => { setCode(v); clearErrors(); }}
              placeholder="000000"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              maxLength={6}
            />
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.submitBtn,
            { backgroundColor: !code || isBusy ? colors.muted : colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={handleVerify}
          disabled={!code || isBusy}
        >
          {isBusy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.submitText, { color: !code ? colors.mutedForeground : '#fff' }]}>
              Verifikasi
            </Text>
          )}
        </Pressable>

        <Pressable style={styles.linkRow} onPress={handleResendCode} disabled={isBusy}>
          <Text style={{ color: colors.primary, fontFamily: 'PlusJakartaSans_500Medium' }}>
            Kirim ulang kode
          </Text>
        </Pressable>

        {/* Required by Clerk for bot protection */}
        <View nativeID="clerk-captcha" />
      </KeyboardAwareScrollViewCompat>
    );
  }

  // ── Registration form ──────────────────────────────────────────────────────
  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 40, paddingBottom: bottomPad + 24 }]}
      bottomOffset={20}
    >
      <View style={styles.header}>
        <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
          <MaterialCommunityIcons name="certificate-outline" size={30} color="#fff" />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Buat Akun</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Mulai perjalanan PKB Anda hari ini
        </Text>
      </View>

      {globalError ? (
        <View style={[styles.alertBox, { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '44' }]}>
          <Feather name="alert-circle" size={14} color={colors.destructive} />
          <Text style={[styles.alertText, { color: colors.destructive }]}>{globalError}</Text>
        </View>
      ) : null}

      {/* Name */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Nama lengkap</Text>
        <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Feather name="user" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            value={name}
            onChangeText={setName}
            placeholder="Nama Anda"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="words"
            autoComplete="name"
          />
        </View>
      </View>

      {/* Email */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Email</Text>
        <View style={[styles.inputWrap, { borderColor: fieldErrors.email ? colors.destructive : colors.border, backgroundColor: colors.card }]}>
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
        {fieldErrors.email ? (
          <Text style={[styles.errText, { color: colors.destructive }]}>{fieldErrors.email}</Text>
        ) : null}
      </View>

      {/* Password */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Kata sandi</Text>
        <View style={[styles.inputWrap, { borderColor: fieldErrors.password ? colors.destructive : colors.border, backgroundColor: colors.card }]}>
          <Feather name="lock" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            value={password}
            onChangeText={(v) => { setPassword(v); clearErrors(); }}
            placeholder="Min. 8 karakter"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry={!showPassword}
            autoComplete="password-new"
          />
          <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
            <Feather name={showPassword ? 'eye-off' : 'eye'} size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
        {fieldErrors.password ? (
          <Text style={[styles.errText, { color: colors.destructive }]}>{fieldErrors.password}</Text>
        ) : null}
      </View>

      {/* Submit */}
      <Pressable
        style={({ pressed }) => [
          styles.submitBtn,
          { backgroundColor: !email || !password || isBusy ? colors.muted : colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={handleSubmit}
        disabled={!email || !password || isBusy}
      >
        {isBusy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={[styles.submitText, { color: !email || !password ? colors.mutedForeground : '#fff' }]}>
            Daftar
          </Text>
        )}
      </Pressable>

      <View style={styles.linkRow}>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'PlusJakartaSans_400Regular' }}>
          Sudah punya akun?{' '}
        </Text>
        <Link href="/(auth)/sign-in">
          <Text style={{ color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Masuk</Text>
        </Link>
      </View>

      {/* Required by Clerk for bot protection */}
      <View nativeID="clerk-captcha" />
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
  linkRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
});
