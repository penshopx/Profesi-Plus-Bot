import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, TextInput, ActivityIndicator,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { claimPayment } from '@/lib/api';
import { useColors } from '@/hooks/useColors';

/**
 * ClaimCard — lets a user manually claim a Scalev order whose checkout email
 * didn't match their account. On success, invalidates the 'my-plan' and
 * 'my-payments' query caches so the balance updates immediately.
 */
export function ClaimCard({ onSuccess }: { onSuccess: () => void }) {
  const colors = useColors();
  const [orderId, setOrderId] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<{
    ok: boolean; creditsGranted: number; alreadyClaimed?: boolean;
  } | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () => claimPayment(orderId.trim(), email.trim()),
    onSuccess: (data) => {
      setResult(data);
      setErrMsg(null);
      setOrderId('');
      setEmail('');
      onSuccess();
    },
    onError: (err: Error) => { setErrMsg(err.message); setResult(null); },
  });

  const canSubmit = orderId.trim().length > 0 && email.trim().length > 0 && !mut.isPending;

  return (
    <View style={[cl.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Feather name="search" size={16} color={colors.primary} />
        <Text style={[cl.title, { color: colors.foreground }]}>Klaim Pesanan Manual</Text>
      </View>
      <Text style={[cl.desc, { color: colors.mutedForeground }]}>
        Bayar dengan email berbeda? Masukkan ID pesanan dan email yang digunakan saat checkout.
      </Text>

      <TextInput
        testID="input-order-id"
        value={orderId}
        onChangeText={setOrderId}
        placeholder="ID pesanan, mis. INV-20240812-001"
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="none"
        autoCorrect={false}
        style={[cl.input, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
      />
      <TextInput
        testID="input-email"
        value={email}
        onChangeText={setEmail}
        placeholder="Email yang digunakan saat checkout"
        placeholderTextColor={colors.mutedForeground}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        style={[cl.input, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
      />

      <Pressable
        testID="btn-klaim"
        onPress={() => { setResult(null); setErrMsg(null); mut.mutate(); }}
        disabled={!canSubmit}
        style={({ pressed }) => [
          cl.btn,
          { backgroundColor: colors.primary, opacity: !canSubmit ? 0.5 : pressed ? 0.8 : 1 },
        ]}
      >
        {mut.isPending
          ? <ActivityIndicator testID="spinner" color="#fff" size="small" />
          : <Text style={cl.btnText}>Klaim Kredit</Text>}
      </Pressable>

      {result && !result.alreadyClaimed && (
        <View testID="banner-success" style={[cl.msg, { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}>
          <Feather name="check-circle" size={14} color="#15803d" />
          <Text testID="text-credits-granted" style={[cl.msgText, { color: '#15803d' }]}>
            Berhasil! <Text style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>{result.creditsGranted} kredit Exum</Text> ditambahkan.
          </Text>
        </View>
      )}
      {result?.alreadyClaimed && (
        <View testID="banner-already-claimed" style={[cl.msg, { backgroundColor: '#dbeafe', borderColor: '#93c5fd' }]}>
          <Feather name="info" size={14} color="#1d4ed8" />
          <Text style={[cl.msgText, { color: '#1d4ed8' }]}>Pesanan ini sudah dikreditkan sebelumnya.</Text>
        </View>
      )}
      {errMsg && (
        <View testID="banner-error" style={[cl.msg, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
          <Feather name="alert-circle" size={14} color="#b91c1c" />
          <Text testID="text-error-msg" style={[cl.msgText, { color: '#b91c1c' }]}>{errMsg}</Text>
        </View>
      )}
    </View>
  );
}

const cl = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  title: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold' },
  desc: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 19 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular' },
  btn: { borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnText: { color: '#fff', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14 },
  msg: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 10, padding: 10 },
  msgText: { flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 18 },
});
