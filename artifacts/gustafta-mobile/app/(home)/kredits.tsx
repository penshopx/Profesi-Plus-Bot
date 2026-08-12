import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getMyPlan, getMyPayments, claimPayment, type PaymentRecord } from '@/lib/api';

// ─── Payment history row ──────────────────────────────────────────────────────

function PaymentRow({ p, colors }: { p: PaymentRecord; colors: ReturnType<typeof useColors> }) {
  const date = new Date(p.createdAt).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  return (
    <View style={[pr.row, { borderBottomColor: colors.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[pr.id, { color: colors.foreground }]} numberOfLines={1}>{p.externalId}</Text>
        <Text style={[pr.sub, { color: colors.mutedForeground }]}>{p.customerEmail} · {date}</Text>
      </View>
      <View style={pr.badge}>
        <Text style={[pr.credits, { color: colors.primary }]}>+{p.creditsGranted} kredit</Text>
      </View>
    </View>
  );
}

const pr = StyleSheet.create({
  row: { paddingVertical: 14, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  id: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' },
  sub: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 },
  badge: { alignItems: 'flex-end' },
  credits: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold' },
});

// ─── Claim card ───────────────────────────────────────────────────────────────

function ClaimCard({ colors, onSuccess }: { colors: ReturnType<typeof useColors>; onSuccess: () => void }) {
  const [orderId, setOrderId] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<{ ok: boolean; creditsGranted: number; alreadyClaimed?: boolean } | null>(null);
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
        value={orderId}
        onChangeText={setOrderId}
        placeholder="ID pesanan, mis. INV-20240812-001"
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="none"
        autoCorrect={false}
        style={[cl.input, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
      />
      <TextInput
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
        onPress={() => { setResult(null); setErrMsg(null); mut.mutate(); }}
        disabled={!canSubmit}
        style={({ pressed }) => [
          cl.btn,
          { backgroundColor: colors.primary, opacity: !canSubmit ? 0.5 : pressed ? 0.8 : 1 },
        ]}
      >
        {mut.isPending
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={cl.btnText}>Klaim Kredit</Text>}
      </Pressable>

      {result && !result.alreadyClaimed && (
        <View style={[cl.msg, { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}>
          <Feather name="check-circle" size={14} color="#15803d" />
          <Text style={[cl.msgText, { color: '#15803d' }]}>
            Berhasil! <Text style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>{result.creditsGranted} kredit Exum</Text> ditambahkan.
          </Text>
        </View>
      )}
      {result?.alreadyClaimed && (
        <View style={[cl.msg, { backgroundColor: '#dbeafe', borderColor: '#93c5fd' }]}>
          <Feather name="info" size={14} color="#1d4ed8" />
          <Text style={[cl.msgText, { color: '#1d4ed8' }]}>Pesanan ini sudah dikreditkan sebelumnya.</Text>
        </View>
      )}
      {errMsg && (
        <View style={[cl.msg, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
          <Feather name="alert-circle" size={14} color="#b91c1c" />
          <Text style={[cl.msgText, { color: '#b91c1c' }]}>{errMsg}</Text>
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

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function KreditsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: planData, isLoading: planLoading } = useQuery({
    queryKey: ['my-plan'],
    queryFn: getMyPlan,
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['my-payments'],
    queryFn: getMyPayments,
  });

  function invalidateCredits() {
    qc.invalidateQueries({ queryKey: ['my-plan'] });
    qc.invalidateQueries({ queryKey: ['my-payments'] });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[sc.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
          <Feather name="arrow-left" size={20} color={colors.mutedForeground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[sc.title, { color: colors.foreground }]}>Kredit Exum</Text>
          <Text style={[sc.sub, { color: colors.mutedForeground }]}>Saldo & riwayat pembelian</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Balance card */}
        <View style={[sc.balanceCard, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}>
          {planLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <Text style={[sc.balanceLabel, { color: colors.mutedForeground }]}>Saldo Kredit Exum</Text>
              <Text style={[sc.balanceValue, { color: colors.primary }]}>
                {planData?.exumCredits ?? 0}
              </Text>
              <Text style={[sc.balanceSub, { color: colors.mutedForeground }]}>
                {planData?.exumCredits === 0 && planData?.canGenerate
                  ? 'Masih ada uji coba gratis tersedia'
                  : planData?.exumCredits === 1
                    ? '1 kredit tersisa'
                    : `${planData?.exumCredits ?? 0} kredit tersisa`}
              </Text>
            </>
          )}
        </View>

        {/* Claim card */}
        <ClaimCard colors={colors} onSuccess={invalidateCredits} />

        {/* Payment history */}
        <Text style={[sc.sectionTitle, { color: colors.mutedForeground }]}>Riwayat Pembelian</Text>
        <View style={[sc.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {paymentsLoading ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: 24 }} />
          ) : payments.length === 0 ? (
            <Text style={[sc.empty, { color: colors.mutedForeground }]}>Belum ada riwayat pembelian.</Text>
          ) : (
            payments.map((p) => <PaymentRow key={p.id} p={p} colors={colors} />)
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const sc = StyleSheet.create({
  header: {
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  title: { fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold' },
  sub: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 1 },
  balanceCard: { borderRadius: 16, borderWidth: 1, padding: 20, alignItems: 'center', gap: 4 },
  balanceLabel: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' },
  balanceValue: { fontSize: 52, fontFamily: 'PlusJakartaSans_700Bold', lineHeight: 60 },
  balanceSub: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular' },
  sectionTitle: {
    fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold',
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  historyCard: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, overflow: 'hidden' },
  empty: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center', paddingVertical: 24 },
});
