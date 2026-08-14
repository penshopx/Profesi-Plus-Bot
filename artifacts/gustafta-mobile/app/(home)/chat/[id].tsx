import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getConversation,
  streamMessage,
  generateExum,
  advancePhase,
  transcribeAudio,
  getMyUsage,
  checkCompetencyAnalysisForJabker,
  getQuizCoverage,
  type Message,
  type QuizCoverageGap,
} from '@/lib/api';
import { Audio } from 'expo-av';
import { useAuth } from '@clerk/expo';
import { OfflineBanner } from '@/components/OfflineBanner';
import { QuizSummaryPanel } from '@/components/QuizSummaryPanel';
import { useNetworkState } from '@/hooks/useNetworkState';

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTO_GREETING = 'Halo, saya siap memulai sesi PKB.';

const PHASE_STEPS = ['profiling', 'context', 'core_interview', 'evidence', 'synthesis', 'done'];

const PHASE_LABELS: Record<string, string> = {
  profiling: 'Profiling',
  context: 'Konteks',
  core_interview: 'Wawancara',
  evidence: 'Bukti',
  synthesis: 'Sintesis',
  done: 'Selesai ✓',
};

const PHASE_COLORS: Record<string, string> = {
  profiling: '#6366F1',
  context: '#0B70C1',
  core_interview: '#0891B2',
  evidence: '#D97706',
  synthesis: '#7C3AED',
  done: '#1AA890',
};

// ─── Local message type ───────────────────────────────────────────────────────

type LocalMsg = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  /** True when saved to the outbox and not yet delivered */
  queued?: boolean;
};

// ─── Outbox types and helpers ─────────────────────────────────────────────────

type OutboxItem = { id: string; content: string };

let msgCounter = 0;
function newId() {
  msgCounter++;
  return `msg-${Date.now()}-${msgCounter}-${Math.random().toString(36).slice(2, 9)}`;
}

function fromApiMessage(m: Message): LocalMsg {
  return { id: String(m.id), role: m.role as 'user' | 'assistant', content: m.content };
}

function draftKey(cid: number) { return `GUSTAFTA_DRAFT_${cid}`; }
function outboxKey(cid: number) { return `GUSTAFTA_OUTBOX_${cid}`; }

async function saveDraft(cid: number, text: string) {
  try {
    if (text) {
      await AsyncStorage.setItem(draftKey(cid), text);
    } else {
      await AsyncStorage.removeItem(draftKey(cid));
    }
  } catch {}
}

async function loadDraft(cid: number): Promise<string> {
  try { return (await AsyncStorage.getItem(draftKey(cid))) ?? ''; } catch { return ''; }
}

async function loadOutbox(cid: number): Promise<OutboxItem[]> {
  try {
    const raw = await AsyncStorage.getItem(outboxKey(cid));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/**
 * Writes the outbox array to AsyncStorage.
 * Does NOT swallow errors — callers decide whether to surface or ignore them.
 */
async function saveOutbox(cid: number, items: OutboxItem[]): Promise<void> {
  await AsyncStorage.setItem(outboxKey(cid), JSON.stringify(items));
}

// ─── Outbox mutex ─────────────────────────────────────────────────────────────
//
// All read-modify-write operations on the same outbox key are serialized through
// a per-key promise chain so that rapid concurrent offline sends cannot
// overwrite each other.
//
// withOutboxLock stores a *recovered* promise in _outboxLocks so that one
// failed write does not permanently block later callers. It returns the *raw*
// execution promise so errors propagate normally to the direct caller.

const _outboxLocks: Record<string, Promise<void>> = {};

function withOutboxLock(cid: number, fn: () => Promise<void>): Promise<void> {
  const key = outboxKey(cid);
  const prev = _outboxLocks[key] ?? Promise.resolve();
  const execution = prev.then(fn);
  // Stored chain recovers silently so later callers are never blocked by one failure
  _outboxLocks[key] = execution.catch(() => {});
  // Return the raw promise — errors propagate to the direct caller
  return execution;
}

/**
 * Atomically appends one item to the persisted outbox.
 * Uses the per-key mutex so rapid concurrent offline sends stay serialized.
 * Throws if the AsyncStorage write fails — the caller must verify success
 * before adding a queued bubble to the UI.
 */
async function appendOutbox(cid: number, item: OutboxItem): Promise<void> {
  await withOutboxLock(cid, async () => {
    const queue = await loadOutbox(cid);
    queue.push(item);
    await saveOutbox(cid, queue); // throws on write failure — propagated to caller
  });
}

/**
 * Removes exactly one item by ID from the persisted outbox.
 * Uses the same mutex to prevent races with concurrent appends.
 * Non-fatal: a failed removal may cause one re-send on the next drain,
 * which is preferable to silently dropping the message.
 */
async function removeOutboxItem(cid: number, id: string): Promise<void> {
  await withOutboxLock(cid, async () => {
    const queue = await loadOutbox(cid);
    await saveOutbox(cid, queue.filter((i) => i.id !== id));
  }).catch(() => {
    // Best-effort — re-send on next drain is acceptable; data loss is not
  });
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator({
  colors,
}: {
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
}) {
  return (
    <View style={[ti.bubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[ti.dots, { color: colors.mutedForeground }]}>● ● ●</Text>
    </View>
  );
}

const ti = StyleSheet.create({
  bubble: {
    alignSelf: 'flex-start',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  dots: { fontSize: 12, letterSpacing: 6 },
});

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  colors,
}: {
  msg: LocalMsg;
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
}) {
  const isUser = msg.role === 'user';
  return (
    <View style={[mb.wrap, isUser ? mb.userWrap : mb.assistantWrap]}>
      <View
        style={[
          mb.bubble,
          isUser
            ? { backgroundColor: msg.queued ? colors.muted : colors.primary }
            : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
        ]}
      >
        <Text style={[mb.text, { color: isUser ? '#fff' : colors.foreground }]}>
          {msg.content}
        </Text>
        {msg.queued && (
          <View style={mb.queuedRow}>
            <Feather name="clock" size={10} color={colors.mutedForeground} />
            <Text style={[mb.queuedText, { color: colors.mutedForeground }]}>
              Menunggu koneksi…
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const mb = StyleSheet.create({
  wrap: { marginBottom: 6, paddingHorizontal: 16 },
  userWrap: { alignItems: 'flex-end' },
  assistantWrap: { alignItems: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  text: { fontSize: 15, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 22 },
  queuedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  queuedText: { fontSize: 10, fontFamily: 'PlusJakartaSans_400Regular' },
});

// ─── Executive Summary modal ──────────────────────────────────────────────────

/**
 * ExumModal phases:
 *   checking_coverage — fetching quiz gap data (spinner shown, no generation yet)
 *   gap_warning       — gaps found; user must confirm before generation starts
 *   coverage_error    — gap fetch failed; user chooses to proceed or cancel
 *   generating        — generateExum in flight
 *   done              — content ready (gap banner shown informatively inline)
 *   gen_error         — generateExum failed
 *
 * For an already-generated Exum (existingContent set), we skip the gate and
 * jump straight to 'done', then load gaps informatively in the background.
 */
type ExumPhase =
  | 'checking_coverage'
  | 'gap_warning'
  | 'coverage_error'
  | 'generating'
  | 'done'
  | 'gen_error';

function ExumModal({
  visible,
  conversationId,
  existingContent,
  onClose,
  onGenerated,
  colors,
  exumQuota,
}: {
  visible: boolean;
  conversationId: number;
  existingContent?: string | null;
  onClose: () => void;
  onGenerated?: (content: string) => void;
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
  /** Daily Exum generation quota — shown so users know how many generations remain. */
  exumQuota?: { remaining: number; limit: number } | null;
}) {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const router = useRouter();

  const [phase, setPhase] = useState<ExumPhase>('checking_coverage');
  const [content, setContent] = useState(existingContent || '');
  const [genError, setGenError] = useState('');
  const [coverageGaps, setCoverageGaps] = useState<QuizCoverageGap[]>([]);
  const [gapsExpanded, setGapsExpanded] = useState(false);
  /** True while the background coverage check for an already-generated Exum is in flight.
   * Refresh is disabled until this resolves so the gap gate cannot be bypassed. */
  const [coverageLoading, setCoverageLoading] = useState(false);

  // ── Core generation call (called only after user has seen/acknowledged gaps)
  const doGenerate = useCallback(async () => {
    try {
      setPhase('generating');
      setGenError('');
      const result = await generateExum(conversationId);
      setContent(result.content);
      onGenerated?.(result.content);
      setPhase('done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setGenError((e as Error).message);
      setPhase('gen_error');
    }
  }, [conversationId, onGenerated]);

  // ── Coverage gate: fetch gaps, then decide next phase
  const checkCoverage = useCallback(async () => {
    setPhase('checking_coverage');
    try {
      const result = await getQuizCoverage();
      setCoverageGaps(result.gaps);
      if (result.gaps.length > 0) {
        setPhase('gap_warning');
      } else {
        // No gaps — proceed straight to generation
        await doGenerate();
      }
    } catch {
      setPhase('coverage_error');
    }
  }, [doGenerate]);

  // ── Refresh: if gaps are known, confirm before regenerating
  const handleRefresh = useCallback(() => {
    if (coverageGaps.length > 0) {
      Alert.alert(
        'Unit tanpa bukti kuis',
        `${coverageGaps.length} unit yang diklaim belum punya percobaan kuis yang lulus. Ringkasan akan tetap dibuat, namun bukti untuk unit-unit tersebut mungkin lebih tipis.\n\nLanjutkan?`,
        [
          { text: 'Batalkan', style: 'cancel' },
          { text: 'Buat ulang', style: 'destructive', onPress: doGenerate },
        ],
      );
    } else {
      doGenerate();
    }
  }, [coverageGaps, doGenerate]);

  // ── On open: if content already exists, jump to done + load gaps informatively
  //            otherwise start the coverage gate
  useEffect(() => {
    if (!visible) return;
    if (existingContent) {
      setContent(existingContent);
      setPhase('done');
      // Load gaps in background for the informational banner.
      // Refresh is blocked (coverageLoading=true) until this settles so the
      // gap gate cannot be bypassed by tapping refresh before data arrives.
      setCoverageLoading(true);
      getQuizCoverage()
        .then((r) => setCoverageGaps(r.gaps))
        .catch(() => {/* informational only — ignore */})
        .finally(() => setCoverageLoading(false));
    } else {
      setContent('');
      setCoverageGaps([]);
      setGapsExpanded(false);
      checkCoverage();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Gap list sub-component (reused in gap_warning + done phases)
  const GapList = () => (
    <View style={[em.gapBanner, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }]}>
      <Pressable
        onPress={() => setGapsExpanded((v) => !v)}
        style={em.gapBannerHeader}
        accessibilityRole="button"
        accessibilityLabel="Tampilkan unit tanpa bukti kuis"
      >
        <Feather name="alert-triangle" size={16} color="#92400E" />
        <Text style={em.gapBannerTitle}>
          {coverageGaps.length} unit tanpa bukti kuis
        </Text>
        <Feather
          name={gapsExpanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="#92400E"
        />
      </Pressable>
      {gapsExpanded && (
        <View style={em.gapList}>
          <Text style={em.gapHint}>
            Unit berikut diklaim di APL 02 tetapi belum ada percobaan kuis yang lulus.
            Ikuti kuis yang relevan agar bukti kompetensimu lebih kuat.
          </Text>
          {coverageGaps.map((gap) => (
            <View key={gap.skkUnitCode} style={em.gapRow}>
              <Feather name="circle" size={6} color="#92400E" style={{ marginTop: 6 }} />
              <View style={{ flex: 1 }}>
                <Text style={em.gapCode}>{gap.skkUnitCode}</Text>
                <Text style={em.gapName}>{gap.skkUnitName}</Text>
                {gap.quizTitle && (
                  <Text style={em.gapQuizHint}>Kuis tersedia: {gap.quizTitle}</Text>
                )}
                {gap.quizId != null && (
                  <Pressable
                    onPress={() => {
                      // Close the modal first, then navigate to the quiz screen.
                      onClose();
                      router.push(`/(home)/quiz/${gap.quizId}` as never);
                    }}
                    style={em.gapQuizBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Mulai kuis ${gap.quizTitle ?? gap.skkUnitCode}`}
                  >
                    <Feather name="play" size={12} color="#92400E" />
                    <Text style={em.gapQuizBtnText}>Mulai kuis</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View
        style={[
          em.container,
          {
            backgroundColor: colors.background,
            paddingTop: isWeb ? 67 : insets.top,
            paddingBottom: isWeb ? 34 : insets.bottom,
          },
        ]}
      >
        <View style={[em.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} style={em.closeBtn}>
            <Feather name="x" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[em.headerTitle, { color: colors.foreground }]}>Ringkasan PKB (Exum)</Text>
          {/* Refresh only visible on done/gen_error phases.
              Disabled while coverageLoading so the gap gate cannot be
              bypassed by tapping refresh before gap data arrives. */}
          {(phase === 'done' || phase === 'gen_error') ? (
            coverageLoading ? (
              <View style={em.refreshBtn}>
                <ActivityIndicator size="small" color={colors.mutedForeground} />
              </View>
            ) : (
              <Pressable onPress={handleRefresh} style={em.refreshBtn}>
                <Feather name="refresh-cw" size={18} color={colors.primary} />
              </Pressable>
            )
          ) : (
            <View style={em.refreshBtn} />
          )}
        </View>

        {/* ── Exum generation quota badge ─────────────────────────────── */}
        {exumQuota && phase !== 'done' && (
          <View style={[
            em.quotaBadge,
            {
              backgroundColor: exumQuota.remaining <= 0 ? '#FEF2F2' : exumQuota.remaining <= 1 ? '#FFFBEB' : '#EEF2FF',
              borderColor:     exumQuota.remaining <= 0 ? '#FECACA' : exumQuota.remaining <= 1 ? '#FDE68A' : '#C7D2FE',
            },
          ]}>
            <Feather
              name="zap"
              size={12}
              color={exumQuota.remaining <= 0 ? '#DC2626' : exumQuota.remaining <= 1 ? '#D97706' : '#4338CA'}
            />
            <Text style={[em.quotaText, {
              color: exumQuota.remaining <= 0 ? '#DC2626' : exumQuota.remaining <= 1 ? '#D97706' : '#4338CA',
            }]}>
              {exumQuota.remaining <= 0
                ? 'Batas Exum hari ini tercapai'
                : `${exumQuota.remaining}/${exumQuota.limit} Exum tersisa hari ini`}
            </Text>
          </View>
        )}

        {/* ── Checking coverage ───────────────────────────────────────── */}
        {phase === 'checking_coverage' && (
          <View style={em.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[em.loadingText, { color: colors.mutedForeground }]}>
              Memeriksa kelengkapan bukti kuis…
            </Text>
          </View>
        )}

        {/* ── Gap warning — user must acknowledge before generation ─────── */}
        {phase === 'gap_warning' && (
          <ScrollView contentContainerStyle={em.scrollContent}>
            <View style={em.center}>
              <Feather name="alert-triangle" size={44} color="#D97706" />
              <Text style={[em.gapWarningTitle, { color: colors.foreground }]}>
                Ada unit tanpa bukti kuis
              </Text>
              <Text style={[em.gapWarningBody, { color: colors.mutedForeground }]}>
                {coverageGaps.length} unit yang kamu klaim di APL 02 belum punya percobaan kuis yang lulus.
                Exum akan tetap dibuat, namun bagian-bagian tersebut mungkin kurang kuat secara bukti.
              </Text>
            </View>
            <GapList />
            <View style={em.gapActions}>
              <Pressable
                onPress={doGenerate}
                style={[em.gapActionBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[em.gapActionBtnText, { color: colors.primaryForeground }]}>
                  Buat Exum tetap
                </Text>
              </Pressable>
              <Pressable onPress={onClose} style={em.gapCancelBtn}>
                <Text style={[em.gapCancelText, { color: colors.mutedForeground }]}>
                  Kembali — ikuti kuis dulu
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        )}

        {/* ── Coverage fetch error — explicit choice ───────────────────── */}
        {phase === 'coverage_error' && (
          <View style={em.center}>
            <Feather name="wifi-off" size={40} color={colors.mutedForeground} />
            <Text style={[em.errText, { color: colors.foreground }]}>
              Tidak bisa memeriksa kelengkapan bukti kuis
            </Text>
            <Text style={[em.loadingText, { color: colors.mutedForeground, textAlign: 'center' }]}>
              Terjadi kesalahan saat mengambil data kuis. Kamu bisa tetap membuat Exum atau coba lagi.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <Pressable onPress={checkCoverage}>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'PlusJakartaSans_500Medium' }}>
                  Coba lagi
                </Text>
              </Pressable>
              <Pressable onPress={doGenerate} style={[em.gapActionBtn, { backgroundColor: colors.primary, paddingVertical: 8 }]}>
                <Text style={[em.gapActionBtnText, { color: colors.primaryForeground }]}>
                  Buat Exum tetap
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── Generating ───────────────────────────────────────────────── */}
        {phase === 'generating' && (
          <View style={em.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[em.loadingText, { color: colors.mutedForeground }]}>
              Membuat ringkasan PKB…
            </Text>
          </View>
        )}

        {/* ── Generation failed ────────────────────────────────────────── */}
        {phase === 'gen_error' && (
          <View style={em.center}>
            <Feather name="alert-circle" size={40} color={colors.destructive} />
            <Text style={[em.errText, { color: colors.destructive }]}>{genError}</Text>
            <Pressable onPress={doGenerate}>
              <Text style={{ color: colors.primary, fontFamily: 'PlusJakartaSans_500Medium', marginTop: 12 }}>
                Coba lagi
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── Done — content with optional informational gap banner ────── */}
        {phase === 'done' && (
          <ScrollView contentContainerStyle={em.scrollContent}>
            {coverageGaps.length > 0 && <GapList />}
            <Text style={[em.exumText, { color: colors.foreground }]}>
              {content || 'Tidak ada konten.'}
            </Text>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const em = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  closeBtn: { padding: 4 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold' },
  refreshBtn: { padding: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  loadingText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular' },
  errText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center' },
  scrollContent: { padding: 20 },
  exumText: { fontSize: 15, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 26 },
  // ── Quota badge ─────────────────────────────────────────────────────────────
  quotaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quotaText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    flex: 1,
  },
  // ── Gap banner ──────────────────────────────────────────────────────────────
  gapBanner: {
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 16,
    overflow: 'hidden',
  },
  gapBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  gapBannerTitle: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#92400E',
  },
  gapList: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  gapHint: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#92400E',
    marginBottom: 8,
    lineHeight: 18,
  },
  gapRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  gapCode: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#92400E',
  },
  gapName: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#92400E',
    lineHeight: 18,
  },
  gapQuizHint: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#B45309',
    marginTop: 2,
    fontStyle: 'italic',
  },
  gapQuizBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#F59E0B',
    backgroundColor: '#FDE68A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  gapQuizBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#92400E',
  },
  // ── Gap warning phase (full-screen confirmation before generation) ────────────
  gapWarningTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  gapWarningBody: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  gapActions: {
    gap: 10,
    marginTop: 4,
  },
  gapActionBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  gapActionBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  gapCancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  gapCancelText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
});

// ─── Phase stepper (mini) ─────────────────────────────────────────────────────

function PhaseStepper({
  phase,
  colors,
}: {
  phase: string;
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
}) {
  const currentIdx = PHASE_STEPS.indexOf(phase);
  const totalSteps = PHASE_STEPS.length - 1;
  return (
    <View style={ps.row}>
      {PHASE_STEPS.slice(0, totalSteps).map((step, i) => {
        const done = currentIdx > i;
        const active = currentIdx === i;
        const color = done || active ? PHASE_COLORS[step] ?? colors.primary : colors.border;
        return (
          <React.Fragment key={step}>
            <View style={[ps.dot, { backgroundColor: color }]} />
            {i < totalSteps - 1 && (
              <View style={[ps.line, { backgroundColor: done ? color : colors.border }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const ps = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  line: { flex: 1, height: 2, minWidth: 8, maxWidth: 24 },
});

// ─── Chat screen ──────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, openExum } = useLocalSearchParams<{ id: string; openExum?: string }>();
  const conversationId = Number(id);
  const queryClient = useQueryClient();
  const isWeb = Platform.OS === 'web';
  const { isOnline } = useNetworkState();
  const isOnlineRef = useRef(isOnline);
  const prevOnlineRef = useRef(isOnline);

  const inputRef = useRef<TextInput>(null);
  const autoGreetedRef = useRef(false);
  /** Guards against concurrent drain runs */
  const isDrainingRef = useRef(false);
  /** Tracks streaming state without stale-closure issues */
  const isStreamingRef = useRef(false);

  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<LocalMsg[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [phase, setPhase] = useState('profiling');
  const [title, setTitle] = useState('');
  const [exumContent, setExumContent] = useState<string | null>(null);
  const [exumVisible, setExumVisible] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [hasPendingQueue, setHasPendingQueue] = useState(false);
  /** True once the initial AsyncStorage draft load has completed. Gates persistence
   *  so that the persistence effect cannot overwrite a saved draft before it loads. */
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [studioBannerDismissed, setStudioBannerDismissedRaw] = useState(false);

  // ─── Rate-limit usage indicator ──────────────────────────────────────────
  const { data: usageInfo } = useQuery({
    queryKey: ['my-usage'],
    queryFn: getMyUsage,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // Countdown timer — uses serverNow so it's accurate even when device clock differs (#91 + #92)
  const [countdown, setCountdown] = useState<string | null>(null);
  const usageFetchedAt = useRef<number>(0);
  useEffect(() => {
    if (!usageInfo?.resetAt || !usageInfo.serverNow) { setCountdown(null); return; }
    usageFetchedAt.current = Date.now();
    const resetDelay =
      new Date(usageInfo.resetAt).getTime() - new Date(usageInfo.serverNow).getTime();
    const tick = () => {
      const msLeft = Math.max(0, resetDelay - (Date.now() - usageFetchedAt.current));
      if (msLeft <= 0) { setCountdown(null); return; }
      const totalSec = Math.ceil(msLeft / 1000);
      const mm = Math.floor(totalSec / 60).toString().padStart(2, '0');
      const ss = (totalSec % 60).toString().padStart(2, '0');
      setCountdown(`${mm}:${ss}`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [usageInfo?.resetAt, usageInfo?.serverNow]);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const { getToken } = useAuth();

  // Keep isOnlineRef in sync for use inside callbacks without stale closure
  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  // Load conversation
  const { isLoading, isError, data: convData } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => getConversation(conversationId),
    enabled: !isNaN(conversationId),
  });

  // ─── Studio Kompetensi nudge ──────────────────────────────────────────────
  const jabker = convData?.jabker ?? null;
  const { data: hasAnalysisForJabker, status: analysisCheckStatus } = useQuery({
    queryKey: ['competency-analysis-check', jabker],
    queryFn: () => checkCompetencyAnalysisForJabker(jabker!),
    enabled: !!jabker,
    staleTime: 5 * 60 * 1000,
  });

  const showStudioBanner =
    !!jabker &&
    analysisCheckStatus === 'success' &&
    hasAnalysisForJabker === false &&
    !studioBannerDismissed;

  const dismissStudioBanner = useCallback(async () => {
    if (jabker) {
      try { await AsyncStorage.setItem(`STUDIO_NUDGE_DISMISSED_${jabker}`, '1'); } catch {}
    }
    setStudioBannerDismissedRaw(true);
  }, [jabker]);

  // Sync dismissal state from AsyncStorage whenever the jabker changes
  useEffect(() => {
    if (!jabker) { setStudioBannerDismissedRaw(false); return; }
    AsyncStorage.getItem(`STUDIO_NUDGE_DISMISSED_${jabker}`)
      .then((val) => setStudioBannerDismissedRaw(val === '1'))
      .catch(() => setStudioBannerDismissedRaw(false));
  }, [jabker]);

  // Sync conversation data into local state
  useEffect(() => {
    if (!convData) return;
    if (!initialLoaded) {
      setMessages(convData.messages.map(fromApiMessage));
      setInitialLoaded(true);
    }
    setPhase(convData.phase);
    setTitle(convData.title);
    if (convData.exumContent) setExumContent(convData.exumContent);
  }, [convData, initialLoaded]);

  // ─── doSend ────────────────────────────────────────────────────────────────
  //
  // Streams one message to the server and updates the UI.
  //
  // `suppressUserBubble` — set true when draining the outbox so we don't add a
  //   duplicate user bubble (the queued placeholder is already in the list).
  //
  // Returns true on success, false on any failure.

  const doSend = useCallback(
    async (text: string, suppressUserBubble = false): Promise<boolean> => {
      if (!text || isStreamingRef.current) return false;

      isStreamingRef.current = true;
      setIsStreaming(true);
      setShowTyping(true);

      // Track the ID of the user bubble so we can promote it to the outbox
      // if the send fails partway through a live connection.
      let userMsgId: string | null = null;

      if (!suppressUserBubble && text !== AUTO_GREETING) {
        userMsgId = newId();
        setMessages((prev) => [...prev, { id: userMsgId!, role: 'user', content: text }]);
      }

      if (text !== AUTO_GREETING) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      let fullContent = '';
      let assistantAdded = false;
      const assistantId = newId();

      try {
        await streamMessage(
          conversationId,
          text,
          (chunk) => {
            fullContent += chunk;
            if (!assistantAdded) {
              setShowTyping(false);
              setMessages((prev) => [
                ...prev,
                { id: assistantId, role: 'assistant', content: fullContent, streaming: true },
              ]);
              assistantAdded = true;
            } else {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.id === assistantId) {
                  updated[updated.length - 1] = { ...last, content: fullContent };
                }
                return updated;
              });
            }
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
          },
        );

        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.id === assistantId) {
            updated[updated.length - 1] = { ...last, streaming: false };
          }
          return updated;
        });

        queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.invalidateQueries({ queryKey: ['my-usage'] });
        queryClient.invalidateQueries({ queryKey: ['my-plan'] });
        if (text !== AUTO_GREETING) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        inputRef.current?.focus();
        return true;
      } catch {
        setShowTyping(false);

        if (!suppressUserBubble && userMsgId) {
          // The user tapped Send on a live connection that subsequently failed.
          // Promote the user message to the outbox so it is retried when
          // connectivity returns, rather than silently discarding it.
          try {
            const outboxItem: OutboxItem = { id: userMsgId, content: text };
            await appendOutbox(conversationId, outboxItem);
            // Turn the user bubble into a queued indicator
            setMessages((prev) =>
              prev.map((m) => (m.id === userMsgId ? { ...m, queued: true } : m)),
            );
            setHasPendingQueue(true);
          } catch {
            // Outbox write itself failed — fall back to an error message so
            // the user knows they need to retry manually.
            if (!assistantAdded) {
              setMessages((prev) => [
                ...prev,
                { id: assistantId, role: 'assistant', content: 'Maaf, terjadi kesalahan. Silakan coba lagi.' },
              ]);
            }
          }
        } else if (!assistantAdded) {
          // Called from drainOutbox (suppressUserBubble=true) — the drain
          // loop handles re-queuing; just leave the placeholder bubble.
        }

        return false;
      } finally {
        isStreamingRef.current = false;
        setIsStreaming(false);
        setShowTyping(false);
      }
    },
    [conversationId, queryClient],
  );

  // ─── Outbox drain ──────────────────────────────────────────────────────────
  //
  // Processes the outbox sequentially. Each item is only removed from
  // AsyncStorage AFTER confirmed delivery — a failure stops the loop and
  // leaves all remaining items in the queue intact.

  const drainOutbox = useCallback(async () => {
    if (isDrainingRef.current) return;
    isDrainingRef.current = true;
    try {
      const queue = await loadOutbox(conversationId);
      if (queue.length === 0) return;

      for (const item of queue) {
        // Optimistically mark this bubble as "delivering" (remove queued flag)
        setMessages((prev) =>
          prev.map((m) => (m.id === item.id && m.queued ? { ...m, queued: false } : m)),
        );

        // suppressUserBubble=true: the queued placeholder already acts as the user bubble
        const success = await doSend(item.content, true);

        if (success) {
          // Remove only this item from the persisted queue
          await removeOutboxItem(conversationId, item.id);
          // Remove the placeholder bubble — doSend added the definitive assistant reply
          setMessages((prev) => prev.filter((m) => m.id !== item.id));
        } else {
          // Restore queued state for this item and stop; do not touch remaining items
          setMessages((prev) =>
            prev.map((m) => (m.id === item.id ? { ...m, queued: true } : m)),
          );
          break;
        }
      }

      // Update badge visibility
      const remaining = await loadOutbox(conversationId);
      setHasPendingQueue(remaining.length > 0);
    } finally {
      isDrainingRef.current = false;
    }
  }, [conversationId, doSend]);

  // ─── Restore queued messages on mount ─────────────────────────────────────
  //
  // Runs once after the conversation has been loaded. Appends any outbox
  // items to the message list as queued indicators, then drains the queue
  // immediately if the device is already online.

  useEffect(() => {
    if (!initialLoaded || isNaN(conversationId)) return;

    (async () => {
      const queue = await loadOutbox(conversationId);
      if (queue.length === 0) return;

      setHasPendingQueue(true);
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const toAdd = queue
          .filter((item) => !existingIds.has(item.id))
          .map<LocalMsg>((item) => ({
            id: item.id,
            role: 'user',
            content: item.content,
            queued: true,
          }));
        return [...prev, ...toAdd];
      });

      if (isOnlineRef.current) {
        drainOutbox();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLoaded, conversationId]);

  // ─── Detect connectivity restore → drain ──────────────────────────────────

  useEffect(() => {
    const wasOffline = !prevOnlineRef.current;
    prevOnlineRef.current = isOnline;
    if (isOnline && wasOffline) {
      drainOutbox();
    }
  }, [isOnline, drainOutbox]);

  // ─── Restore draft ─────────────────────────────────────────────────────────
  //
  // Load first, then enable persistence. Without the gate the persistence
  // effect runs with inputText='' on mount and can overwrite the saved draft
  // before the async load resolves.

  useEffect(() => {
    if (isNaN(conversationId)) return;
    loadDraft(conversationId).then((saved) => {
      if (saved) setInputText(saved);
      setDraftLoaded(true);
    });
  }, [conversationId]);

  // Persist draft text on every change — gated until the initial load completes
  useEffect(() => {
    if (!draftLoaded || isNaN(conversationId)) return;
    const handle = requestAnimationFrame(() => { saveDraft(conversationId, inputText); });
    return () => cancelAnimationFrame(handle);
  }, [inputText, conversationId, draftLoaded]);

  // ─── Handle user send ──────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;

    if (!isOnlineRef.current) {
      // Persist the message to the outbox BEFORE updating UI so we never
      // show a queued bubble for a message that failed to persist.
      const item: OutboxItem = { id: newId(), content: text };
      try {
        await appendOutbox(conversationId, item);
      } catch {
        Alert.alert('Tidak dapat menyimpan pesan', 'Coba lagi atau periksa penyimpanan perangkat.');
        return;
      }
      setMessages((prev) => [...prev, { ...item, role: 'user', queued: true }]);
      setInputText('');
      saveDraft(conversationId, '');
      setHasPendingQueue(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    setInputText('');
    saveDraft(conversationId, '');
    doSend(text);
  }, [inputText, doSend, conversationId]);

  // Auto-send initial greeting for brand-new empty conversations
  useEffect(() => {
    if (!initialLoaded || autoGreetedRef.current || isStreamingRef.current) return;
    if (!isOnlineRef.current) return; // don't auto-greet offline
    if (messages.length === 0) {
      autoGreetedRef.current = true;
      const timer = setTimeout(() => { doSend(AUTO_GREETING); }, 400);
      return () => clearTimeout(timer);
    }
  }, [initialLoaded, messages.length, doSend]);

  // Deep-link from push notification: open the Exum modal automatically.
  // Runs once after the conversation has loaded so the modal has context to display.
  useEffect(() => {
    if (!initialLoaded || openExum !== 'true') return;
    setExumVisible(true);
  }, [initialLoaded, openExum]);

  // Phase logic
  const isDone = phase === 'done';
  const canGenerate = phase === 'synthesis' || phase === 'done';
  const canAdvance = !isDone && !canGenerate && messages.length > 0;

  // ─── Mic / recording ──────────────────────────────────────────────────────

  const handleMicPress = useCallback(async () => {
    if (isDone) return;

    if (isRecording) {
      try {
        const rec = recordingRef.current;
        if (!rec) return;
        await rec.stopAndUnloadAsync();
        const uri = rec.getURI();
        recordingRef.current = null;
        setIsRecording(false);
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        if (!uri) return;
        setIsTranscribing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const token = await getToken();
        if (!token) return;
        const text = await transcribeAudio(uri, token);
        if (text.trim()) {
          setInputText((prev) => (prev ? `${prev} ${text.trim()}` : text.trim()));
        } else {
          // Whisper returned an empty transcript — warn the user so they know
          // the recording didn't capture anything and can try again.
          Alert.alert(
            'Rekaman tidak terdeteksi',
            'Tidak ada suara yang berhasil ditranskripsi. Pastikan mikrofon tidak terhalang dan coba rekam ulang.',
          );
        }
      } catch {
        Alert.alert('Transkrip gagal', 'Tidak dapat memproses rekaman. Coba lagi.');
      } finally {
        setIsTranscribing(false);
      }
    } else {
      try {
        const { granted } = await Audio.requestPermissionsAsync();
        if (!granted) {
          Alert.alert('Izin mikrofon diperlukan', 'Buka Pengaturan dan izinkan akses mikrofon.');
          return;
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const rec = new Audio.Recording();
        await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        await rec.startAsync();
        recordingRef.current = rec;
        setIsRecording(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        Alert.alert('Gagal memulai rekaman', 'Pastikan mikrofon tersedia.');
      }
    }
  }, [isDone, isRecording, getToken]);

  const handleAdvancePhase = useCallback(async () => {
    if (isAdvancing || isStreamingRef.current) return;
    setIsAdvancing(true);
    try {
      const result = await advancePhase(conversationId);
      setPhase(result.phase);
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Gagal', 'Tidak dapat melanjutkan fase saat ini.');
    } finally {
      setIsAdvancing(false);
    }
  }, [conversationId, isAdvancing, queryClient]);

  const reversed = useMemo(() => [...messages].reverse(), [messages]);
  const phaseColor = PHASE_COLORS[phase] ?? '#6B7488';
  const phaseLabel = PHASE_LABELS[phase] ?? phase;
  const bottomInset = isWeb ? 34 : insets.bottom;
  const sendDisabled = !inputText.trim() || isStreaming || isDone || isRecording;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: isWeb ? 67 : insets.top,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>

        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            {title || 'Sesi PKB'}
          </Text>
          <View style={styles.phaseRow}>
            <PhaseStepper phase={phase} colors={colors} />
            <View style={[styles.phaseDot, { backgroundColor: phaseColor, marginLeft: 6 }]} />
            <Text style={[styles.phaseLabel, { color: phaseColor }]}>{phaseLabel}</Text>
          </View>
        </View>

        {canGenerate && (
          <Pressable
            style={({ pressed }) => [
              styles.exumBtn,
              { backgroundColor: pressed ? colors.accent + 'cc' : colors.accent },
            ]}
            onPress={() => setExumVisible(true)}
          >
            <Feather name="file-text" size={14} color="#fff" />
            <Text style={styles.exumBtnText}>Ringkasan</Text>
          </Pressable>
        )}
      </View>

      {/* Offline banner */}
      {!isOnline && <OfflineBanner />}

      {/* Pending queue banner (online but still delivering) */}
      {isOnline && hasPendingQueue && (
        <View style={[styles.queueBanner, { backgroundColor: colors.secondary, borderBottomColor: colors.border }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.queueBannerText, { color: colors.foreground }]}>
            Mengirim pesan yang tertunda…
          </Text>
        </View>
      )}

      {/* Messages */}
      {isLoading && messages.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError && messages.length === 0 ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={40} color={colors.destructive} />
          <Text style={[styles.errText, { color: colors.destructive }]}>
            Gagal memuat percakapan
          </Text>
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
          <FlatList
            data={reversed}
            keyExtractor={(item) => item.id}
            inverted={messages.length > 0}
            renderItem={({ item }) => <MessageBubble msg={item} colors={colors} />}
            ListHeaderComponent={showTyping ? <TypingIndicator colors={colors} /> : null}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 8 }}
            ListEmptyComponent={
              !isStreaming ? (
                <View style={styles.emptyChat}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    Memulai sesi…
                  </Text>
                </View>
              ) : null
            }
          />

          {canAdvance && !isStreaming && isOnline && (
            <Pressable
              style={[styles.advanceBar, { backgroundColor: colors.secondary, borderTopColor: colors.border }]}
              onPress={handleAdvancePhase}
              disabled={isAdvancing}
            >
              {isAdvancing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Feather name="skip-forward" size={15} color={colors.primary} />
                  <Text style={[styles.advanceText, { color: colors.primary }]}>
                    Lanjut ke fase berikutnya
                  </Text>
                  <Feather name="chevron-right" size={15} color={colors.primary} />
                </>
              )}
            </Pressable>
          )}

          {phase === 'synthesis' && !isStreaming && !exumContent && isOnline && (
            <QuizSummaryPanel jabker={jabker} colors={colors} />
          )}

          {phase === 'synthesis' && !isStreaming && !exumContent && isOnline && (
            <Pressable
              style={[
                styles.synthesisBanner,
                { backgroundColor: colors.accent + '22', borderColor: colors.accent + '55' },
              ]}
              onPress={() => setExumVisible(true)}
            >
              <Feather name="zap" size={16} color={colors.accent} />
              <Text style={[styles.synthesisBannerText, { color: colors.accent }]}>
                Sesi siap — Buat Ringkasan PKB (Exum)
              </Text>
              <Feather name="chevron-right" size={15} color={colors.accent} />
            </Pressable>
          )}

          {/* Studio Kompetensi nudge banner */}
          {showStudioBanner && (
            <View style={[styles.studioBanner, { backgroundColor: '#FFFBEB', borderTopColor: '#FDE68A' }]}>
              <Feather name="bar-chart-2" size={14} color="#B45309" style={{ flexShrink: 0 }} />
              <Text style={[styles.studioBannerText, { color: '#78350F' }]}>
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>Tingkatkan kualitas saran AI</Text>
                {' — jalankan Studio Kompetensi untuk jabker '}
                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>{jabker}</Text>
              </Text>
              <Pressable
                onPress={() => router.push('/(home)/(tabs)/studio')}
                style={[styles.studioBannerBtn, { borderColor: '#FCD34D', backgroundColor: '#fff' }]}
              >
                <Text style={{ color: '#B45309', fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                  Buka Studio
                </Text>
              </Pressable>
              <Pressable onPress={dismissStudioBanner} style={{ padding: 4, flexShrink: 0 }}>
                <Feather name="x" size={14} color="#B45309" />
              </Pressable>
            </View>
          )}

          {/* Rate-limit usage indicator */}
          {usageInfo && (
            <View
              style={[
                styles.usageBar,
                { backgroundColor: colors.background, borderTopColor: colors.border },
              ]}
            >
              {usageInfo.remaining <= 5 && (
                <Feather
                  name="alert-circle"
                  size={11}
                  color={usageInfo.remaining <= 2 ? '#EF4444' : '#F59E0B'}
                  style={{ marginRight: 4 }}
                />
              )}
              <Text
                style={[
                  styles.usageText,
                  {
                    color:
                      usageInfo.remaining <= 2
                        ? '#EF4444'
                        : usageInfo.remaining <= 5
                          ? '#F59E0B'
                          : colors.mutedForeground,
                  },
                ]}
              >
                {usageInfo.remaining}/{usageInfo.limit} pesan/jam
                {usageInfo.remaining <= 0 && countdown
                  ? ` · reset dalam ${countdown}`
                  : usageInfo.resetAt
                    ? (() => {
                        const d = new Date(usageInfo.resetAt);
                        const hh = d.getHours().toString().padStart(2, '0');
                        const mm = d.getMinutes().toString().padStart(2, '0');
                        return ` · reset ${hh}:${mm}`;
                      })()
                    : null}
              </Text>
            </View>
          )}

          {/* Input row */}
          <View
            style={[
              styles.inputRow,
              {
                borderTopColor: colors.border,
                backgroundColor: colors.background,
                paddingBottom: bottomInset + 8,
              },
            ]}
          >
            <TextInput
              ref={inputRef}
              style={[
                styles.textInput,
                {
                  color: isDone ? colors.mutedForeground : colors.foreground,
                  backgroundColor: colors.card,
                  borderColor: isRecording ? '#EF4444' : colors.border,
                },
              ]}
              value={inputText}
              onChangeText={setInputText}
              placeholder={
                isDone
                  ? 'Sesi selesai'
                  : isRecording
                    ? '🎙 Merekam… ketuk mic untuk berhenti'
                    : isTranscribing
                      ? '⏳ Mentranskrip…'
                      : !isOnline
                        ? 'Offline — pesan akan dikirim saat online'
                        : 'Ketik pesan…'
              }
              placeholderTextColor={isRecording ? '#EF4444' : colors.mutedForeground}
              multiline
              maxLength={2000}
              editable={!isDone && !isRecording && !isTranscribing}
              blurOnSubmit={false}
              onSubmitEditing={handleSend}
            />

            {!isDone && (
              <Pressable
                style={[
                  styles.sendBtn,
                  {
                    backgroundColor: isRecording
                      ? '#EF4444'
                      : isTranscribing
                        ? colors.muted
                        : colors.secondary,
                  },
                ]}
                onPress={handleMicPress}
                disabled={isTranscribing}
              >
                {isTranscribing ? (
                  <ActivityIndicator size="small" color={colors.mutedForeground} />
                ) : (
                  <Feather
                    name={isRecording ? 'mic-off' : 'mic'}
                    size={18}
                    color={isRecording ? '#fff' : colors.foreground}
                  />
                )}
              </Pressable>
            )}

            <Pressable
              style={[
                styles.sendBtn,
                { backgroundColor: sendDisabled ? colors.muted : colors.primary },
              ]}
              onPress={handleSend}
              disabled={sendDisabled}
            >
              {isStreaming ? (
                <ActivityIndicator size="small" color={colors.mutedForeground} />
              ) : (
                <Feather
                  name={!isOnline ? 'clock' : 'send'}
                  size={18}
                  color={sendDisabled ? colors.mutedForeground : '#fff'}
                />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      <ExumModal
        visible={exumVisible}
        conversationId={conversationId}
        existingContent={exumContent}
        onClose={() => setExumVisible(false)}
        onGenerated={(content) => {
          setExumContent(content);
          setPhase('done');
          queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          // Refresh the quota counter immediately so the remaining count drops.
          queryClient.invalidateQueries({ queryKey: ['my-usage'] });
        }}
        colors={colors}
        exumQuota={usageInfo?.exum ?? null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold' },
  phaseRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  phaseDot: { width: 6, height: 6, borderRadius: 3 },
  phaseLabel: { fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium' },
  exumBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  exumBtnText: { color: '#fff', fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  errText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular' },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center' },
  advanceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  advanceText: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', flex: 1 },
  synthesisBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  synthesisBannerText: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', flex: 1 },
  studioBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderTopWidth: 1,
  },
  studioBannerText: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', flex: 1, lineHeight: 16 },
  studioBannerBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexShrink: 0,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    maxHeight: 120,
    minHeight: 40,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  queueBannerText: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium' },
  usageBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  usageText: { fontSize: 11, fontFamily: 'PlusJakartaSans_400Regular' },
});
