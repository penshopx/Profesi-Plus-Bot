import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  
} from 'react-native';
import { showAlert } from '@/lib/alert';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser, useClerk } from '@clerk/expo';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getMyPlan, listProjectBrain, getMyAplProfile, getMyAplClaims, getMe } from '@/lib/api';
import { buildAplHtml } from '@/lib/apl-html';
import { getAplCompleteness } from '@workspace/apl-fields';
import { clearUserMarketplaceCaches } from '@/lib/marketplaceCache';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

function Initials({ name, email }: { name?: string; email?: string }) {
  const colors = useColors();
  const displayName = name || email || '?';
  const parts = displayName.split(' ');
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : displayName.slice(0, 2).toUpperCase();

  return (
    <View style={[av.wrap, { backgroundColor: colors.primary }]}>
      <Text style={av.text}>{initials}</Text>
    </View>
  );
}

const av = StyleSheet.create({
  wrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 28,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});

function PlanBadge({ plan }: { plan: string }) {
  const colors = useColors();
  const isPro = plan?.toLowerCase() === 'pro';
  return (
    <View
      style={[
        pb.wrap,
        {
          backgroundColor: isPro ? colors.accent + '22' : colors.muted,
          borderColor: isPro ? colors.accent + '55' : colors.border,
        },
      ]}
    >
      {isPro && <MaterialCommunityIcons name="crown" size={14} color={colors.accent} />}
      <Text
        style={[
          pb.text,
          { color: isPro ? colors.accent : colors.mutedForeground },
        ]}
      >
        {isPro ? 'Pro' : 'Gratis'}
      </Text>
    </View>
  );
}

const pb = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  text: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold' },
});

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const [printingApl, setPrintingApl] = React.useState(false);
  const [claimNudgeDismissed, setClaimNudgeDismissed] = React.useState(false);

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 + 84 : 84 + insets.bottom;

  const { data: planData, isLoading: planLoading } = useQuery({
    queryKey: ['my-plan'],
    queryFn: getMyPlan,
    retry: 1,
  });

  const { data: projectBrains = [], isLoading: pbLoading } = useQuery({
    queryKey: ['project-brain'],
    queryFn: listProjectBrain,
    retry: 1,
  });

  const { data: aplProfile } = useQuery({
    queryKey: ['apl-profile'],
    queryFn: getMyAplProfile,
    retry: 1,
  });

  const { data: aplClaims = [] } = useQuery({
    queryKey: ['apl-claims'],
    queryFn: getMyAplClaims,
    retry: 1,
  });

  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    retry: 1,
  });

  const isAdmin = meData?.role === 'admin';

  // Completeness — shared field list with web CompletenessBar (@workspace/apl-fields)
  const aplCompleteness = React.useMemo(
    () => (aplProfile ? getAplCompleteness(aplProfile) : null),
    [aplProfile],
  );

  const handleSignOut = async () => {
    // Clear user-scoped marketplace caches so watch history never leaks to
    // the next account signing in on this device.
    if (user?.id) await clearUserMarketplaceCaches(user.id);
    // Drop the in-memory React Query cache too (watched history, plan,
    // profile, …) so the next account starts from a clean slate.
    queryClient.clear();
    await signOut();
    router.replace('/(auth)/sign-in');
  };

  const handlePrintApl = async () => {
    if (!aplProfile) return;
    setPrintingApl(true);
    try {
      const userName =
        user?.fullName ||
        [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
        user?.primaryEmailAddress?.emailAddress ||
        '';
      const email = user?.primaryEmailAddress?.emailAddress ?? '';
      const html = buildAplHtml(aplProfile, aplClaims, userName, email);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Simpan atau Bagikan APL',
          UTI: 'com.adobe.pdf',
        });
      } else {
        await Print.printAsync({ uri });
      }
    } catch (err) {
      console.error('APL print error:', err);
      showAlert(
        'Gagal membuat PDF',
        'Coba lagi atau periksa penyimpanan perangkat.'
      );
    } finally {
      setPrintingApl(false);
    }
  };

  const fullName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const email = user?.primaryEmailAddress?.emailAddress;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: topPad + 8, paddingBottom: bottomPad },
      ]}
    >
      {/* Header */}
      <Text style={[styles.headerTitle, { color: colors.foreground }]}>Profil</Text>

      {/* Avatar + name */}
      <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.avatarRow}>
          {!isLoaded ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Initials name={fullName} email={email} />
          )}
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
              {fullName || email || '—'}
            </Text>
            <Text style={[styles.email, { color: colors.mutedForeground }]} numberOfLines={1}>
              {email || '—'}
            </Text>
            {planData ? <PlanBadge plan={planData.plan} /> : null}
          </View>
        </View>
      </View>

      {/* PKB status */}
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
        PKB
      </Text>
      <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable onPress={() => router.push('/(home)/project-brain')} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <InfoRow
            icon="book-open"
            label="Project Brain"
            value={
              pbLoading
                ? '…'
                : projectBrains.length === 0
                  ? 'Tambah entri →'
                  : `${projectBrains.length} entri →`
            }
            colors={colors}
          />
        </Pressable>
        {planLoading ? (
          <ActivityIndicator color={colors.primary} style={{ paddingVertical: 12 }} />
        ) : (
          <>
            <InfoRow
              icon="zap"
              label="Paket"
              value={
                planData?.plan
                  ? planData.plan.charAt(0).toUpperCase() + planData.plan.slice(1)
                  : 'Gratis'
              }
              colors={colors}
            />
            <InfoRow
              icon="award"
              label="Kredit Exum"
              value={
                (planData as any)?.exumCredits !== undefined
                  ? (planData as any).exumCredits === 0 && (planData as any).canGenerate
                    ? 'Sisa uji coba gratis'
                    : `${(planData as any).exumCredits} kredit`
                  : '—'
              }
              colors={colors}
            />
          </>
        )}
      </View>

      {/* Kegiatan PKB shortcut */}
      <Pressable
        onPress={() => router.push('/(home)/kegiatan')}
        style={({ pressed }) => [
          styles.infoCard,
          { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <InfoRow
          icon="file-text"
          label="Dokumentasi Kegiatan PKB"
          value="Buka →"
          colors={colors}
        />
      </Pressable>

      {/* Quiz list shortcut */}
      <Pressable
        testID="btn-goto-quiz-list"
        onPress={() => router.push('/(home)/quiz' as any)}
        style={({ pressed }) => [
          styles.infoCard,
          { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <InfoRow
          icon="help-circle"
          label="Kuis Kompetensi"
          value="Lihat semua kuis →"
          colors={colors}
          chevron
        />
      </Pressable>

      {/* APL 01 edit */}
      <Pressable
        testID="btn-edit-apl"
        onPress={() => router.push('/(home)/apl-edit' as any)}
        style={({ pressed }) => [
          styles.infoCard,
          { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <InfoRow
          icon="edit-3"
          label="Edit Profil APL 01"
          value="Isi / Perbarui →"
          colors={colors}
          chevron
        />
      </Pressable>

      {/* APL form print */}
      <Pressable
        onPress={handlePrintApl}
        disabled={printingApl}
        style={({ pressed }) => [
          styles.infoCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: pressed || printingApl ? 0.6 : 1,
          },
        ]}
      >
        <InfoRow
          icon="printer"
          label={printingApl ? 'Membuat PDF…' : 'Cetak Formulir APL 01 & 02'}
          value={aplProfile ? 'Simpan / Bagikan PDF →' : 'Memuat profil…'}
          colors={colors}
          chevron
        />
        {aplCompleteness !== null && (
          <View style={styles.completenessWrap}>
            <View style={styles.completenessHeader}>
              <Text style={[styles.completenessLabel, { color: colors.mutedForeground }]}>
                Kelengkapan APL 01
              </Text>
              <Text
                style={[
                  styles.completenessPct,
                  { color: aplCompleteness === 100 ? '#16a34a' : '#d97706' },
                ]}
              >
                {aplCompleteness}%
              </Text>
            </View>
            <View style={[styles.completenessTrack, { backgroundColor: colors.muted }]}>
              <View
                style={[
                  styles.completenessFill,
                  {
                    width: `${aplCompleteness}%`,
                    backgroundColor: aplCompleteness === 100 ? '#22c55e' : '#f59e0b',
                  },
                ]}
              />
            </View>
            {aplCompleteness < 100 && (
              <Text style={[styles.completenessHint, { color: colors.mutedForeground }]}>
                Profil belum lengkap — {aplCompleteness}% terisi
              </Text>
            )}
          </View>
        )}
      </Pressable>

      {/* Kredit shortcuts */}
      <Pressable
        testID="btn-goto-kredits"
        onPress={() => router.push('/(home)/kredits')}
        style={({ pressed }) => [
          styles.infoCard,
          { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <InfoRow
          icon="award"
          label="Kredit & Riwayat Pembelian"
          value="Lihat →"
          colors={colors}
        />
      </Pressable>

      {/* Klaim Kredit nudge — only shown when credits are zero and no free trial */}
      {!planLoading &&
        (planData as any)?.exumCredits === 0 &&
        !(planData as any)?.canGenerate &&
        !claimNudgeDismissed && (
          <View
            style={[
              styles.claimShortcut,
              { borderColor: colors.primary },
            ]}
          >
            <Feather name="download-cloud" size={16} color={colors.primary} />
            <Pressable
              onPress={() => router.push('/(home)/kredits')}
              style={{ flex: 1 }}
            >
              <Text style={[styles.claimShortcutText, { color: colors.primary }]}>
                Klaim Pesanan? Tap di sini untuk mengklaim kredit dari pesanan kamu.
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setClaimNudgeDismissed(true)}
              hitSlop={8}
              style={{ padding: 2 }}
            >
              <Feather name="x" size={15} color={colors.mutedForeground} />
            </Pressable>
          </View>
        )}

      {/* Admin: Kelola Quiz */}
      {isAdmin ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            Admin
          </Text>
          <Pressable
            onPress={() => router.push('/(home)/kelola-quiz' as any)}
            style={({ pressed }) => [
              styles.infoCard,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <InfoRow
              icon="list"
              label="Kelola Quiz"
              value="Buka →"
              colors={colors}
              chevron
            />
          </Pressable>
        </>
      ) : null}

      {/* Info */}
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
        Informasi
      </Text>
      <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <InfoRow
          icon="info"
          label="Versi Aplikasi"
          value="1.0.0"
          colors={colors}
        />
        <InfoRow
          icon="server"
          label="Backend"
          value="Gustafta PKB API"
          colors={colors}
        />
      </View>

      {/* Sign out */}
      <Pressable
        style={({ pressed }) => [
          styles.signOutBtn,
          {
            backgroundColor: colors.destructive + (pressed ? 'dd' : '18'),
            borderColor: colors.destructive + '44',
          },
        ]}
        onPress={handleSignOut}
      >
        <Feather name="log-out" size={18} color={colors.destructive} />
        <Text style={[styles.signOutText, { color: colors.destructive }]}>
          Keluar
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  colors,
  chevron,
}: {
  icon: string;
  label: string;
  value: string;
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
  chevron?: boolean;
}) {
  return (
    <View style={[ir.row, { borderBottomColor: colors.border }]}>
      <Feather name={icon as any} size={16} color={colors.mutedForeground} />
      <Text style={[ir.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[ir.value, { color: colors.foreground }]}>{value}</Text>
      {chevron ? (
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} style={{ marginLeft: 4 }} />
      ) : null}
    </View>
  );
}

const ir = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  label: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    flex: 1,
  },
  value: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
});

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 16 },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_700Bold',
    marginBottom: 4,
  },
  profileCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  name: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  email: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 15,
    borderWidth: 1,
    marginTop: 8,
  },
  signOutText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  completenessWrap: {
    paddingBottom: 14,
    paddingTop: 2,
    gap: 6,
  },
  completenessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  completenessLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  completenessPct: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  completenessTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  completenessFill: {
    height: '100%',
    borderRadius: 4,
  },
  completenessHint: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  claimShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderStyle: 'dashed',
  },
  claimShortcutText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
});
