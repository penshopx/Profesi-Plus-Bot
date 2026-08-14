import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetworkState } from '@/hooks/useNetworkState';
import { OfflineBanner } from '@/components/OfflineBanner';
import {
  listStudioAnalyses,
  runStudioAnalysis,
  listJabkers,
  getMyUsage,
  type StudioAnalysis,
} from '@/lib/api';

// ─── Offline cache ────────────────────────────────────────────────────────────

const CACHE_KEY = 'GUSTAFTA_STUDIO_ANALYSES_CACHE';

async function loadCachedAnalyses(): Promise<StudioAnalysis[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as StudioAnalysis[]) : [];
  } catch {
    return [];
  }
}

async function saveCachedAnalyses(data: StudioAnalysis[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {}
}

// ─── Readiness badge ─────────────────────────────────────────────────────────
// Server uses Indonesian: "kuat" (strong), "cukup" (adequate), "lemah" (weak)
const READINESS_COLOR: Record<string, string> = {
  kuat: '#1AA890',
  cukup: '#D97706',
  lemah: '#EF3B2C',
};

const READINESS_LABEL: Record<string, string> = {
  kuat: 'Kuat',
  cukup: 'Cukup',
  lemah: 'Lemah',
};

function ReadinessBadge({ value }: { value: string }) {
  const label = READINESS_LABEL[value?.toLowerCase()] ?? (value ? value.charAt(0).toUpperCase() + value.slice(1) : '-');
  const color = READINESS_COLOR[value?.toLowerCase()] ?? '#6B7488';
  return (
    <View style={[rb.wrap, { backgroundColor: color + '22', borderColor: color + '55' }]}>
      <Text style={[rb.text, { color }]}>{label}</Text>
    </View>
  );
}

const rb = StyleSheet.create({
  wrap: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  text: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold' },
});

// ─── Analysis card ────────────────────────────────────────────────────────────

function AnalysisCard({ item }: { item: StudioAnalysis }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const date = new Date(item.createdAt).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  // Unit counts from the full result (available after POST /analyze, not in list)
  const units = item.result?.units ?? [];
  const covered = units.filter((u) => u.status === 'covered').length;
  const partial = units.filter((u) => u.status === 'partial').length;
  const gap = units.filter((u) => u.status === 'gap').length;
  const hasUnits = units.length > 0;

  const recommendations = item.result?.recommendations ?? [];
  const hasSummary = Boolean(item.summary);
  const hasRecs = recommendations.length > 0;

  return (
    <Pressable
      style={[ac.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => setExpanded((v) => !v)}
    >
      {/* Top row */}
      <View style={ac.topRow}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[ac.jabker, { color: colors.foreground }]} numberOfLines={1}>
            {item.jabkerName}
          </Text>
          <Text style={[ac.date, { color: colors.mutedForeground }]}>{date}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <ReadinessBadge value={item.readiness} />
          <Text style={[ac.skpk, { color: colors.primary }]}>
            SKPK {item.estimatedSkpk ?? '-'}
          </Text>
        </View>
      </View>

      {/* Summary text (always available from list endpoint) */}
      {hasSummary && (
        <Text style={[ac.summaryText, { color: colors.mutedForeground }]} numberOfLines={expanded ? undefined : 2}>
          {item.summary}
        </Text>
      )}

      {/* Unit counts (only when full result is available) */}
      {hasUnits && (
        <View style={ac.unitRow}>
          <View style={ac.unitChip}>
            <Feather name="check-circle" size={12} color="#1AA890" />
            <Text style={[ac.unitLabel, { color: colors.mutedForeground }]}>
              {covered} terpenuhi
            </Text>
          </View>
          <View style={ac.unitChip}>
            <Feather name="minus-circle" size={12} color="#D97706" />
            <Text style={[ac.unitLabel, { color: colors.mutedForeground }]}>
              {partial} parsial
            </Text>
          </View>
          <View style={ac.unitChip}>
            <Feather name="x-circle" size={12} color="#EF3B2C" />
            <Text style={[ac.unitLabel, { color: colors.mutedForeground }]}>
              {gap} gap
            </Text>
          </View>
        </View>
      )}

      {/* Expanded: recommendations */}
      {expanded && hasRecs && (
        <View style={[ac.recs, { borderTopColor: colors.border }]}>
          <Text style={[ac.recsTitle, { color: colors.foreground }]}>Rekomendasi</Text>
          {recommendations.map((r, i) => (
            <Text key={i} style={[ac.recsText, { color: colors.mutedForeground }]}>
              {`${i + 1}. ${r}`}
            </Text>
          ))}
        </View>
      )}

      <View style={ac.expandRow}>
        <Feather
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={colors.mutedForeground}
        />
      </View>
    </Pressable>
  );
}

const ac = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, gap: 8 },
  jabker: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold' },
  date: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular' },
  skpk: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold' },
  summaryText: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 19 },
  unitRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  unitChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  unitLabel: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular' },
  recs: { borderTopWidth: 1, marginTop: 12, paddingTop: 12, gap: 6 },
  recsTitle: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold' },
  recsText: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 20 },
  expandRow: { alignItems: 'center', marginTop: 8 },
});

// ─── Jabker picker modal ──────────────────────────────────────────────────────

function JabkerPickerModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (jabker: string) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  const { data: jabkers = [], isLoading } = useQuery({
    queryKey: ['jabkers'],
    queryFn: listJabkers,
    enabled: visible,
    staleTime: 5 * 60_000,
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={pm.overlay} onPress={onClose}>
        <Pressable
          style={[
            pm.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: (isWeb ? 34 : insets.bottom) + 16,
            },
          ]}
          onPress={() => {}}
        >
          <View style={[pm.handle, { backgroundColor: colors.border }]} />
          <Text style={[pm.title, { color: colors.foreground }]}>Pilih Jabatan Kerja</Text>

          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 32 }} />
          ) : (
            <FlatList
              data={jabkers}
              keyExtractor={(item) => item}
              style={{ maxHeight: 320 }}
              renderItem={({ item: jk }) => (
                <Pressable
                  style={({ pressed }) => [
                    pm.item,
                    {
                      borderBottomColor: colors.border,
                      backgroundColor: pressed ? colors.muted : 'transparent',
                    },
                  ]}
                  onPress={() => {
                    onSelect(jk);
                    onClose();
                  }}
                >
                  <Text style={[pm.itemText, { color: colors.foreground }]}>{jk}</Text>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={[pm.empty, { color: colors.mutedForeground }]}>
                  Tidak ada jabker
                </Text>
              }
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const pm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 16 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  itemText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', flex: 1 },
  empty: { textAlign: 'center', padding: 32, fontFamily: 'PlusJakartaSans_400Regular' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function StudioScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const isWeb = Platform.OS === 'web';
  const { isOnline } = useNetworkState();

  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedJabker, setSelectedJabker] = useState('');
  // Cached analyses loaded from AsyncStorage on mount; used as fallback when offline.
  const [cachedAnalyses, setCachedAnalyses] = useState<StudioAnalysis[]>([]);
  const [cacheLoaded, setCacheLoaded] = useState(false);

  // Load cache once on mount so offline users see stale data immediately.
  useEffect(() => {
    loadCachedAnalyses().then((data) => {
      setCachedAnalyses(data);
      setCacheLoaded(true);
    });
  }, []);

  const {
    data: liveAnalyses,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['studio-analyses'],
    queryFn: listStudioAnalyses,
    // Don't attempt a network fetch while the cache is loading or when offline.
    enabled: cacheLoaded,
  });

  // Persist successful fetches to AsyncStorage.
  useEffect(() => {
    if (liveAnalyses) {
      setCachedAnalyses(liveAnalyses);
      saveCachedAnalyses(liveAnalyses);
    }
  }, [liveAnalyses]);

  // Show live data when available; fall back to cache when offline or on first load.
  const analyses = liveAnalyses ?? cachedAnalyses;
  // Flag to show a "you're viewing cached data" notice.
  const showingCached = !liveAnalyses && cachedAnalyses.length > 0;

  const { data: usage } = useQuery({
    queryKey: ['my-usage'],
    queryFn: getMyUsage,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const { mutate: runAnalysis, isPending: isAnalyzing, error: analyzeError } =
    useMutation({
      mutationFn: () => runStudioAnalysis(selectedJabker),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['studio-analyses'] });
        queryClient.invalidateQueries({ queryKey: ['my-usage'] });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    });

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 + 84 : 84 + insets.bottom;

  const sorted = [...analyses].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Offline banner */}
      {!isOnline && <OfflineBanner />}

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 8,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Competency Studio
        </Text>
      </View>

      {/* Stale-cache notice */}
      {showingCached && (
        <View style={[styles.cacheBanner, { backgroundColor: '#FFF7ED', borderBottomColor: '#FED7AA' }]}>
          <Feather name="clock" size={12} color="#C2410C" />
          <Text style={[styles.cacheBannerText, { color: '#C2410C' }]}>
            Menampilkan data tersimpan — sambungkan internet untuk memperbarui
          </Text>
        </View>
      )}

      <FlatList
        data={sorted}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <AnalysisCard item={item} />}
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View
            style={[
              styles.analyzeCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.analyzeCardTitle, { color: colors.foreground }]}>
              Analisis Kompetensi
            </Text>
            <Text style={[styles.analyzeCardDesc, { color: colors.mutedForeground }]}>
              Pilih jabatan kerja dan jalankan analisis terhadap project brain Anda
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.jabkerPicker,
                {
                  borderColor: selectedJabker ? colors.primary : colors.border,
                  backgroundColor: pressed ? colors.muted : colors.background,
                },
              ]}
              onPress={() => setPickerVisible(true)}
            >
              <Text
                style={[
                  styles.jabkerPickerText,
                  { color: selectedJabker ? colors.foreground : colors.mutedForeground },
                ]}
              >
                {selectedJabker || 'Pilih jabatan kerja...'}
              </Text>
              <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
            </Pressable>

            {analyzeError ? (
              <Text style={[styles.errText, { color: colors.destructive }]}>
                {(analyzeError as Error).message.includes('402')
                  ? 'Fitur ini memerlukan paket Pro.'
                  : (analyzeError as Error).message}
              </Text>
            ) : null}

            {!isOnline && (
              <View style={[styles.offlineHint, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
                <Feather name="wifi-off" size={13} color="#C2410C" />
                <Text style={[styles.offlineHintText, { color: '#C2410C' }]}>
                  Sambungkan internet untuk menjalankan analisis
                </Text>
              </View>
            )}

            {/* Competency analysis quota */}
            {usage?.competency && (() => {
              const { remaining, limit } = usage.competency;
              const exhausted = remaining <= 0;
              const low = remaining <= 1;
              const bg = exhausted ? '#FEF2F2' : low ? '#FFFBEB' : '#EEF2FF';
              const border = exhausted ? '#FECACA' : low ? '#FDE68A' : '#C7D2FE';
              const textColor = exhausted ? '#DC2626' : low ? '#D97706' : '#4338CA';
              return (
                <View style={[styles.quotaBadge, { backgroundColor: bg, borderColor: border }]}>
                  <Feather name="zap" size={12} color={textColor} />
                  <Text style={[styles.quotaText, { color: textColor }]}>
                    {exhausted
                      ? 'Batas analisis hari ini tercapai'
                      : `${remaining}/${limit} analisis tersisa hari ini`}
                  </Text>
                </View>
              );
            })()}

            <Pressable
              style={[
                styles.runBtn,
                {
                  backgroundColor:
                    !selectedJabker || isAnalyzing || !isOnline ? colors.muted : colors.primary,
                },
              ]}
              onPress={() => runAnalysis()}
              disabled={!selectedJabker || isAnalyzing || !isOnline}
            >
              {isAnalyzing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="zap" size={16} color={selectedJabker && isOnline ? '#fff' : colors.mutedForeground} />
                  <Text
                    style={[
                      styles.runBtnText,
                      {
                        color: !selectedJabker || !isOnline
                          ? colors.mutedForeground
                          : '#fff',
                      },
                    ]}
                  >
                    Jalankan Analisis
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator
              color={colors.primary}
              style={{ marginTop: 32 }}
            />
          ) : isError ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: colors.destructive }]}>
                Gagal memuat analisis
              </Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Feather name="bar-chart-2" size={40} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Belum ada analisis
              </Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
                Pilih jabker dan jalankan analisis pertama Anda
              </Text>
            </View>
          )
        }
      />

      <JabkerPickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={(jk) => {
          setSelectedJabker(jk);
          Haptics.selectionAsync();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  analyzeCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  analyzeCardTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  analyzeCardDesc: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    lineHeight: 20,
  },
  jabkerPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  jabkerPickerText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    flex: 1,
  },
  runBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 13,
  },
  runBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  errText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 20,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    marginTop: 8,
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    textAlign: 'center',
  },
  offlineHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  offlineHintText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    flex: 1,
  },
  quotaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quotaText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    flex: 1,
  },
  cacheBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  cacheBannerText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    flex: 1,
    lineHeight: 16,
  },
});
