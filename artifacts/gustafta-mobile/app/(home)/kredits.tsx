import React from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { getMyPlan, getMyPayments, SCALEV_CHECKOUT_URL, type PaymentRecord } from '@/lib/api';
import { ClaimCard } from '@/components/ClaimCard';

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
              <Text testID="text-credit-balance" style={[sc.balanceValue, { color: colors.primary }]}>
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

        {/* Buy credits */}
        {SCALEV_CHECKOUT_URL !== '' && (
          <Pressable
            style={({ pressed }) => [
              sc.buyBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={async () => {
              await WebBrowser.openBrowserAsync(SCALEV_CHECKOUT_URL);
              // Refresh balance & history when the user returns from checkout —
              // the Scalev webhook may already have granted credits.
              invalidateCredits();
            }}
          >
            <Feather name="shopping-bag" size={16} color="#fff" />
            <Text style={sc.buyBtnText}>Beli Kredit Exum</Text>
          </Pressable>
        )}

        {/* Claim card */}
        <ClaimCard onSuccess={invalidateCredits} />

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
  buyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, paddingVertical: 13,
  },
  buyBtnText: { color: '#fff', fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
  sectionTitle: {
    fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold',
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  historyCard: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, overflow: 'hidden' },
  empty: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center', paddingVertical: 24 },
});
