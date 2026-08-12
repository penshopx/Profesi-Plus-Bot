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
import { useQuery } from '@tanstack/react-query';
import { useUser, useClerk } from '@clerk/expo';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getMyPlan, listProjectBrain } from '@/lib/api';

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
  const router = useRouter();
  const isWeb = Platform.OS === 'web';

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

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/sign-in');
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
        <InfoRow
          icon="book-open"
          label="Project Brain"
          value={
            pbLoading
              ? '…'
              : projectBrains.length === 0
                ? 'Belum ada'
                : `${projectBrains.length} entri`
          }
          colors={colors}
        />
        {planLoading ? (
          <ActivityIndicator color={colors.primary} style={{ paddingVertical: 12 }} />
        ) : (
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
        )}
      </View>

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
}: {
  icon: string;
  label: string;
  value: string;
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
}) {
  return (
    <View style={[ir.row, { borderBottomColor: colors.border }]}>
      <Feather name={icon as any} size={16} color={colors.mutedForeground} />
      <Text style={[ir.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[ir.value, { color: colors.foreground }]}>{value}</Text>
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
});
