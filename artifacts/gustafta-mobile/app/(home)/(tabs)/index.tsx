import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Platform,
  RefreshControl,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  listConversations,
  createConversation,
  deleteConversation,
  listJabkers,
  getMyPlan,
  type Conversation,
} from '@/lib/api';
import VoiceNoteModal from '@/components/VoiceNoteModal';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useNetworkState } from '@/hooks/useNetworkState';

// ─── Phase badge ─────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  profiling: 'Profiling',
  context: 'Konteks',
  core_interview: 'Wawancara',
  evidence: 'Bukti',
  synthesis: 'Sintesis',
  done: 'Selesai',
};

const PHASE_COLORS: Record<string, string> = {
  profiling: '#6366F1',
  context: '#0B70C1',
  core_interview: '#0891B2',
  evidence: '#D97706',
  synthesis: '#7C3AED',
  done: '#1AA890',
};

const MODE_LABELS: Record<string, string> = {
  A: 'Pengalaman',
  B: 'Pembelajaran',
  Hybrid: 'Hybrid',
};

function PhaseBadge({ phase }: { phase: string }) {
  const label = PHASE_LABELS[phase] ?? phase;
  const color = PHASE_COLORS[phase] ?? '#6B7488';
  return (
    <View style={[badgeStyle.wrap, { backgroundColor: color + '22', borderColor: color + '55' }]}>
      <View style={[badgeStyle.dot, { backgroundColor: color }]} />
      <Text style={[badgeStyle.text, { color }]}>{label}</Text>
    </View>
  );
}

const badgeStyle = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  text: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold' },
});

// ─── Session card ─────────────────────────────────────────────────────────────

function SessionCard({
  item,
  onPress,
  onDelete,
  deleteDisabled,
}: {
  item: Conversation;
  onPress: () => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
}) {
  const colors = useColors();
  const date = new Date(item.createdAt).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Pressable
      style={({ pressed }) => [
        cardStyle.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
      onPress={onPress}
    >
      <View style={cardStyle.top}>
        <Text
          style={[cardStyle.title, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <Pressable onPress={deleteDisabled ? undefined : onDelete} hitSlop={8} disabled={deleteDisabled}>
          <Feather
            name="trash-2"
            size={16}
            color={deleteDisabled ? colors.border : colors.mutedForeground}
          />
        </Pressable>
      </View>
      <View style={cardStyle.row}>
        <PhaseBadge phase={item.phase} />
        {item.jabker ? (
          <Text style={[cardStyle.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
            {item.jabker}
          </Text>
        ) : null}
      </View>
      <View style={cardStyle.bottom}>
        <Text style={[cardStyle.mode, { color: colors.mutedForeground }]}>
          Mode {MODE_LABELS[item.mode] ?? item.mode}
        </Text>
        <Text style={[cardStyle.date, { color: colors.mutedForeground }]}>{date}</Text>
      </View>
    </Pressable>
  );
}

const cardStyle = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    gap: 10,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  meta: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', flex: 1 },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mode: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular' },
  date: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular' },
});

// ─── New session modal ────────────────────────────────────────────────────────

const MODES = [
  { key: 'A', label: 'Pengalaman Kerja', desc: 'Mode A' },
  { key: 'B', label: 'Hasil Belajar', desc: 'Mode B' },
  { key: 'Hybrid', label: 'Hybrid', desc: 'A + B' },
];

function NewSessionModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  const [mode, setMode] = useState('A');
  const [jabker, setJabker] = useState('');
  const [step, setStep] = useState<'mode' | 'jabker'>('mode');

  const { data: jabkers = [], isLoading: jabkerLoading } = useQuery({
    queryKey: ['jabkers'],
    queryFn: listJabkers,
    enabled: visible && step === 'jabker',
    staleTime: 5 * 60_000,
  });

  const queryClient = useQueryClient();
  const { mutate: createSession, isPending } = useMutation({
    mutationFn: async () => {
      const title = jabker
        ? `${jabker} – ${new Date().toLocaleDateString('id-ID')}`
        : `Sesi ${new Date().toLocaleDateString('id-ID')}`;
      return createConversation({ title, mode, jabker: jabker || undefined });
    },
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      onCreated(conv.id);
    },
  });

  const handleClose = () => {
    setStep('mode');
    setMode('A');
    setJabker('');
    onClose();
  };

  const bottomPad = isWeb ? 34 : insets.bottom;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <Pressable style={modalStyle.overlay} onPress={handleClose}>
        <Pressable
          style={[
            modalStyle.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: bottomPad + 16,
            },
          ]}
          onPress={() => {}}
        >
          {/* Handle */}
          <View style={[modalStyle.handle, { backgroundColor: colors.border }]} />

          {step === 'mode' ? (
            <>
              <Text style={[modalStyle.sheetTitle, { color: colors.foreground }]}>
                Pilih Mode Sesi
              </Text>
              <View style={modalStyle.modeList}>
                {MODES.map((m) => (
                  <Pressable
                    key={m.key}
                    style={({ pressed }) => [
                      modalStyle.modeBtn,
                      {
                        borderColor: mode === m.key ? colors.primary : colors.border,
                        backgroundColor:
                          mode === m.key
                            ? colors.primary + '18'
                            : pressed
                              ? colors.muted
                              : colors.background,
                      },
                    ]}
                    onPress={() => setMode(m.key)}
                  >
                    <Text
                      style={[
                        modalStyle.modeBtnLabel,
                        {
                          color: mode === m.key ? colors.primary : colors.foreground,
                        },
                      ]}
                    >
                      {m.label}
                    </Text>
                    <Text style={[modalStyle.modeBtnDesc, { color: colors.mutedForeground }]}>
                      {m.desc}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                style={[modalStyle.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={() => setStep('jabker')}
              >
                <Text style={modalStyle.primaryBtnText}>Lanjut →</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={modalStyle.sheetTopRow}>
                <Pressable onPress={() => setStep('mode')}>
                  <Feather name="arrow-left" size={20} color={colors.foreground} />
                </Pressable>
                <Text style={[modalStyle.sheetTitle, { color: colors.foreground, flex: 1, textAlign: 'center' }]}>
                  Pilih Jabatan Kerja
                </Text>
                <View style={{ width: 20 }} />
              </View>

              {jabkerLoading ? (
                <ActivityIndicator
                  color={colors.primary}
                  style={{ marginVertical: 32 }}
                />
              ) : jabkers.length === 0 ? (
                <Text style={[modalStyle.emptyText, { color: colors.mutedForeground }]}>
                  Tidak ada jabker tersedia
                </Text>
              ) : (
                <FlatList
                  data={jabkers}
                  keyExtractor={(item) => item}
                  style={{ maxHeight: 280 }}
                  renderItem={({ item: jk }) => (
                    <Pressable
                      style={({ pressed }) => [
                        modalStyle.jabkerItem,
                        {
                          borderBottomColor: colors.border,
                          backgroundColor:
                            jabker === jk
                              ? colors.primary + '18'
                              : pressed
                                ? colors.muted
                                : 'transparent',
                        },
                      ]}
                      onPress={() => setJabker(jk)}
                    >
                      <Text
                        style={[
                          modalStyle.jabkerText,
                          {
                            color: jabker === jk ? colors.primary : colors.foreground,
                            fontFamily:
                              jabker === jk
                                ? 'PlusJakartaSans_600SemiBold'
                                : 'PlusJakartaSans_400Regular',
                          },
                        ]}
                      >
                        {jk}
                      </Text>
                      {jabker === jk && (
                        <Feather name="check" size={16} color={colors.primary} />
                      )}
                    </Pressable>
                  )}
                />
              )}

              <Pressable
                style={[
                  modalStyle.primaryBtn,
                  {
                    backgroundColor: isPending ? colors.muted : colors.primary,
                    marginTop: 16,
                  },
                ]}
                onPress={() => createSession()}
                disabled={isPending}
              >
                {isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={modalStyle.primaryBtnText}>
                    {jabker ? `Mulai dengan ${jabker}` : 'Mulai tanpa Jabker'}
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const modalStyle = StyleSheet.create({
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
  sheetTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    marginBottom: 16,
  },
  sheetTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  modeList: { gap: 10, marginBottom: 20 },
  modeBtn: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
  },
  modeBtnLabel: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    marginBottom: 2,
  },
  modeBtnDesc: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular' },
  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  jabkerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  jabkerText: { fontSize: 14, flex: 1 },
  emptyText: {
    textAlign: 'center',
    padding: 32,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SessionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isWeb = Platform.OS === 'web';
  const { isOnline } = useNetworkState();

  const [modalVisible, setModalVisible] = useState(false);
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);

  const handleVoiceNote = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVoiceModalVisible(true);
  }, []);

  const {
    data: conversations = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['conversations'],
    queryFn: listConversations,
  });

  const { data: planData } = useQuery({
    queryKey: ['my-plan'],
    queryFn: getMyPlan,
  });

  const { mutate: doDelete } = useMutation({
    mutationFn: deleteConversation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  });

  const handleDelete = useCallback(
    (id: number) => {
      if (!isOnline) {
        Alert.alert('Offline', 'Tidak dapat menghapus sesi saat offline.');
        return;
      }
      Alert.alert('Hapus sesi?', 'Sesi ini akan dihapus permanen.', [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => doDelete(id),
        },
      ]);
    },
    [doDelete, isOnline],
  );

  const handleNewSession = useCallback(() => {
    if (!isOnline) {
      Alert.alert('Offline', 'Tidak dapat membuat sesi baru saat offline.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalVisible(true);
  }, [isOnline]);

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 + 84 : 84 + insets.bottom;

  // Sort newest first
  const sorted = [...conversations].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
          Sesi PKB
        </Text>
        {planData && (
          <Pressable
            style={({ pressed }) => [
              styles.creditChip,
              {
                backgroundColor: colors.primary + '14',
                borderColor: colors.primary + '30',
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            onPress={() => router.push('/(home)/kredits')}
          >
            <Feather name="zap" size={13} color={colors.primary} />
            <Text style={[styles.creditChipText, { color: colors.primary }]}>
              {planData.exumCredits ?? 0} kredit
            </Text>
          </Pressable>
        )}
        <Pressable
          style={({ pressed }) => [
            styles.addBtn,
            {
              backgroundColor: isOnline ? colors.primary : colors.muted,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          onPress={handleNewSession}
        >
          <Feather name="plus" size={20} color={isOnline ? '#fff' : colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Offline banner */}
      {!isOnline && <OfflineBanner />}

      {/* List */}
      {isLoading && conversations.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError && conversations.length === 0 ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={40} color={colors.destructive} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Gagal memuat sesi
          </Text>
          <Pressable onPress={() => refetch()}>
            <Text style={{ color: colors.primary, fontFamily: 'PlusJakartaSans_500Medium', marginTop: 8 }}>
              Coba lagi
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <SessionCard
              item={item}
              onPress={() => router.push(`/(home)/chat/${item.id}`)}
              onDelete={() => handleDelete(item.id)}
              deleteDisabled={!isOnline}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: bottomPad },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
              enabled={isOnline}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="clipboard" size={48} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Belum ada sesi
              </Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
                Mulai wawancara Gustafta pertama Anda
              </Text>
              {isOnline && (
                <Pressable
                  style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
                  onPress={handleNewSession}
                >
                  <Text style={styles.emptyBtnText}>Mulai Sesi Baru</Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}

      {/* Mic FAB: always visible so users can record even before creating a session */}
      <Pressable
        style={[
          styles.fab,
          {
            backgroundColor: '#EF4444',
            bottom: bottomPad - 20,
            right: conversations.length > 0 ? 88 : 20,
          },
        ]}
        onPress={handleVoiceNote}
      >
        <Feather name="mic" size={22} color="#fff" />
      </Pressable>

      {/* Plus FAB: only when there are existing sessions */}
      {conversations.length > 0 && (
        <Pressable
          style={[
            styles.fab,
            {
              backgroundColor: isOnline ? colors.primary : colors.muted,
              bottom: bottomPad - 20,
              right: 20,
            },
          ]}
          onPress={handleNewSession}
        >
          <Feather name="plus" size={24} color={isOnline ? '#fff' : colors.mutedForeground} />
        </Pressable>
      )}

      <NewSessionModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onCreated={(id) => {
          setModalVisible(false);
          router.push(`/(home)/chat/${id}`);
        }}
      />

      <VoiceNoteModal
        visible={voiceModalVisible}
        onClose={() => setVoiceModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  creditChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6,
    marginRight: 10,
  },
  creditChipText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold' },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { padding: 16 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    textAlign: 'center',
  },
  emptyBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  emptyBtnText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
