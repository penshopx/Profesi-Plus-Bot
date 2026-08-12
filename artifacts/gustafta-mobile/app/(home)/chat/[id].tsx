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
import {
  getConversation,
  streamMessage,
  generateExum,
  advancePhase,
  transcribeAudio,
  type Message,
} from '@/lib/api';
import { Audio } from 'expo-av';
import { useAuth } from '@clerk/expo';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Auto-sent on behalf of the user when a brand-new conversation has no messages.
 * Mirrors the web client's AUTO_GREETING to trigger the same server-side flow.
 */
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
};

let msgCounter = 0;
function newId() {
  msgCounter++;
  return `msg-${Date.now()}-${msgCounter}-${Math.random().toString(36).slice(2, 9)}`;
}

function fromApiMessage(m: Message): LocalMsg {
  return { id: String(m.id), role: m.role as 'user' | 'assistant', content: m.content };
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator({
  colors,
}: {
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
}) {
  return (
    <View
      style={[ti.bubble, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
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
            ? { backgroundColor: colors.primary }
            : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
        ]}
      >
        <Text style={[mb.text, { color: isUser ? '#fff' : colors.foreground }]}>
          {msg.content}
        </Text>
      </View>
    </View>
  );
}

const mb = StyleSheet.create({
  wrap: { marginBottom: 6, paddingHorizontal: 16 },
  userWrap: { alignItems: 'flex-end' },
  assistantWrap: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  text: { fontSize: 15, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 22 },
});

// ─── Executive Summary modal ──────────────────────────────────────────────────

function ExumModal({
  visible,
  conversationId,
  existingContent,
  onClose,
  onGenerated,
  colors,
}: {
  visible: boolean;
  conversationId: number;
  existingContent?: string | null;
  onClose: () => void;
  onGenerated?: (content: string) => void;
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
}) {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const [content, setContent] = useState(existingContent || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const doGenerate = useCallback(async () => {
    try {
      setIsGenerating(true);
      setError('');
      const result = await generateExum(conversationId);
      setContent(result.content);
      onGenerated?.(result.content);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsGenerating(false);
    }
  }, [conversationId, onGenerated]);

  // Auto-generate when opened with no existing content
  useEffect(() => {
    if (visible && !content && !isGenerating) {
      doGenerate();
    }
    if (visible && existingContent && !content) {
      setContent(existingContent);
    }
  }, [visible]);

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
        {/* Header */}
        <View style={[em.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} style={em.closeBtn}>
            <Feather name="x" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[em.headerTitle, { color: colors.foreground }]}>
            Ringkasan PKB (Exum)
          </Text>
          <Pressable onPress={doGenerate} style={em.refreshBtn} disabled={isGenerating}>
            <Feather name="refresh-cw" size={18} color={colors.primary} />
          </Pressable>
        </View>

        {/* Content */}
        {isGenerating ? (
          <View style={em.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[em.loadingText, { color: colors.mutedForeground }]}>
              Membuat ringkasan PKB…
            </Text>
          </View>
        ) : error ? (
          <View style={em.center}>
            <Feather name="alert-circle" size={40} color={colors.destructive} />
            <Text style={[em.errText, { color: colors.destructive }]}>{error}</Text>
            <Pressable onPress={doGenerate}>
              <Text
                style={{
                  color: colors.primary,
                  fontFamily: 'PlusJakartaSans_500Medium',
                  marginTop: 12,
                }}
              >
                Coba lagi
              </Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={em.scrollContent}>
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  refreshBtn: { padding: 4 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  loadingText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular' },
  errText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    textAlign: 'center',
  },
  scrollContent: { padding: 20 },
  exumText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    lineHeight: 26,
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
  const totalSteps = PHASE_STEPS.length - 1; // exclude 'done' from visual

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
              <View
                style={[
                  ps.line,
                  { backgroundColor: done ? color : colors.border },
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const ps = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  line: {
    flex: 1,
    height: 2,
    minWidth: 8,
    maxWidth: 24,
  },
});

// ─── Chat screen ──────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = Number(id);
  const queryClient = useQueryClient();
  const isWeb = Platform.OS === 'web';

  const inputRef = useRef<TextInput>(null);
  const autoGreetedRef = useRef(false);

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
  const recordingRef = useRef<Audio.Recording | null>(null);
  const { getToken } = useAuth();

  // Load conversation
  const { isLoading, isError, data: convData } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => getConversation(conversationId),
    enabled: !isNaN(conversationId),
  });

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

  // Auto-send initial greeting for brand-new empty conversations
  useEffect(() => {
    if (!initialLoaded || autoGreetedRef.current || isStreaming) return;
    if (messages.length === 0) {
      autoGreetedRef.current = true;
      const timer = setTimeout(() => {
        doSend(AUTO_GREETING);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [initialLoaded, messages.length]);

  const doSend = useCallback(
    async (text: string) => {
      if (!text || isStreaming) return;

      const userMsg: LocalMsg = { id: newId(), role: 'user', content: text };
      // Don't show the auto-greeting as a visible user bubble (mirrors web behavior)
      if (text !== AUTO_GREETING) {
        setMessages((prev) => [...prev, userMsg]);
      }
      setInputText('');
      setIsStreaming(true);
      setShowTyping(true);
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
                {
                  id: assistantId,
                  role: 'assistant',
                  content: fullContent,
                  streaming: true,
                },
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

        // Mark streaming done, clear typing
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
        if (text !== AUTO_GREETING) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        inputRef.current?.focus();
      } catch (err) {
        setShowTyping(false);
        if (!assistantAdded) {
          setMessages((prev) => [
            ...prev,
            {
              id: assistantId,
              role: 'assistant',
              content: 'Maaf, terjadi kesalahan. Silakan coba lagi.',
            },
          ]);
        }
      } finally {
        setIsStreaming(false);
        setShowTyping(false);
      }
    },
    [isStreaming, conversationId, queryClient],
  );

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (text) doSend(text);
  }, [inputText, doSend]);

  /**
   * Tap mic to start recording; tap again to stop → transcribe → fill input.
   */
  const handleMicPress = useCallback(async () => {
    if (isDone) return;

    if (isRecording) {
      // ── Stop recording ──────────────────────────────────────────────────
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
        }
      } catch {
        Alert.alert('Transkrip gagal', 'Tidak dapat memproses rekaman. Coba lagi.');
      } finally {
        setIsTranscribing(false);
      }
    } else {
      // ── Start recording ─────────────────────────────────────────────────
      try {
        const { granted } = await Audio.requestPermissionsAsync();
        if (!granted) {
          Alert.alert(
            'Izin mikrofon diperlukan',
            'Buka Pengaturan dan izinkan akses mikrofon untuk merekam catatan suara.',
          );
          return;
        }
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
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
    if (isAdvancing || isStreaming) return;
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
  }, [conversationId, isAdvancing, isStreaming, queryClient]);

  const reversed = useMemo(() => [...messages].reverse(), [messages]);

  // Phase logic — mirrors web client
  const isDone = phase === 'done';
  const canGenerate = phase === 'synthesis' || phase === 'done';
  const canAdvance = !isDone && !canGenerate && messages.length > 0;

  const phaseColor = PHASE_COLORS[phase] ?? '#6B7488';
  const phaseLabel = PHASE_LABELS[phase] ?? phase;
  const bottomInset = isWeb ? 34 : insets.bottom;

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

        {/* Exum / Summary button — available from synthesis onwards */}
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

      {/* Messages */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError ? (
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

          {/* Advance-phase action bar (shown when not at synthesis/done) */}
          {canAdvance && !isStreaming && (
            <Pressable
              style={[
                styles.advanceBar,
                {
                  backgroundColor: colors.secondary,
                  borderTopColor: colors.border,
                },
              ]}
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

          {/* Synthesis banner — prompt user to generate Exum */}
          {phase === 'synthesis' && !isStreaming && !exumContent && (
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
                      : 'Ketik pesan…'
              }
              placeholderTextColor={isRecording ? '#EF4444' : colors.mutedForeground}
              multiline
              maxLength={2000}
              editable={!isDone && !isRecording && !isTranscribing}
              blurOnSubmit={false}
              onSubmitEditing={handleSend}
            />
            {/* Mic button — tap to record voice note, tap again to transcribe */}
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
                {
                  backgroundColor:
                    !inputText.trim() || isStreaming || isDone ? colors.muted : colors.primary,
                },
              ]}
              onPress={handleSend}
              disabled={!inputText.trim() || isStreaming || isDone || isRecording}
            >
              {isStreaming ? (
                <ActivityIndicator size="small" color={colors.mutedForeground} />
              ) : (
                <Feather
                  name="send"
                  size={18}
                  color={!inputText.trim() || isDone ? colors.mutedForeground : '#fff'}
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
        }}
        colors={colors}
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
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    textAlign: 'center',
  },
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
  synthesisBannerText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    flex: 1,
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
});
