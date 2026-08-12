/**
 * VoiceNoteModal
 *
 * Full flow: idle → recording → transcribing → preview/edit → saving → done
 *
 * Uses expo-av for microphone capture, the server /api/transcribe endpoint
 * for Whisper speech-to-text (Indonesian), and POST /api/project-brain to
 * persist the entry.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { Audio } from 'expo-av';
import { useAuth } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { transcribeAudio, createProjectBrainEntry } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'preview'
  | 'saving'
  | 'done';

// ─── Duration formatter ───────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// ─── Pulsing record indicator ─────────────────────────────────────────────────

function PulsingDot({ active }: { active: boolean }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!active) {
      setScale(1);
      return;
    }
    let up = true;
    const interval = setInterval(() => {
      setScale(up ? 1.25 : 1);
      up = !up;
    }, 500);
    return () => clearInterval(interval);
  }, [active]);

  return (
    <View
      style={[
        dot.circle,
        { transform: [{ scale }], opacity: active ? 1 : 0.3 },
      ]}
    />
  );
}

const dot = StyleSheet.create({
  circle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
  },
});

// ─── Main component ───────────────────────────────────────────────────────────

interface VoiceNoteModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function VoiceNoteModal({
  visible,
  onClose,
}: VoiceNoteModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const isWeb = Platform.OS === 'web';

  const [stage, setStage] = useState<Stage>('idle');
  const [durationMs, setDurationMs] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [title, setTitle] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopTimer();
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  // ── Reset when modal opens ──────────────────────────────────────────────────

  useEffect(() => {
    if (visible) {
      resetState();
    }
  }, [visible]);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function resetState() {
    setStage('idle');
    setDurationMs(0);
    setTranscript('');
    setTitle('');
    setErrorMsg('');
  }

  // ── Start recording ─────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    setErrorMsg('');
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Izin mikrofon diperlukan untuk merekam suara.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;

      startTimeRef.current = Date.now();
      setDurationMs(0);
      setStage('recording');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      timerRef.current = setInterval(() => {
        setDurationMs(Date.now() - startTimeRef.current);
      }, 200);
    } catch (err) {
      console.error('startRecording error', err);
      setErrorMsg('Gagal memulai perekaman. Coba lagi.');
    }
  }, []);

  // ── Stop + transcribe ───────────────────────────────────────────────────────

  const stopAndTranscribe = useCallback(async () => {
    stopTimer();
    setStage('transcribing');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const recording = recordingRef.current;
      if (!recording) throw new Error('Tidak ada rekaman aktif');

      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const uri = recording.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error('URI rekaman tidak tersedia');

      const token = await getToken();
      if (!token) throw new Error('Sesi habis, silakan login kembali');

      const text = await transcribeAudio(uri, token);

      // Task #21 — guard against empty transcripts (Whisper returned nothing).
      // Go back to idle with a clear message so the user can retry rather than
      // accidentally saving an entry with no description.
      if (!text.trim()) {
        setErrorMsg(
          'Tidak ada suara yang berhasil ditranskripsi. Pastikan mikrofon tidak terhalang, lalu coba rekam ulang.',
        );
        setStage('idle');
        return;
      }

      const autoTitle =
        text.trim().slice(0, 50) ||
        `Catatan Suara ${new Date().toLocaleDateString('id-ID')}`;

      setTranscript(text);
      setTitle(autoTitle);
      setStage('preview');
    } catch (err: unknown) {
      console.error('transcription error', err);
      const msg =
        err instanceof Error ? err.message : 'Gagal mentranskrip audio.';
      setErrorMsg(msg);
      setStage('idle');
    }
  }, [getToken]);

  // ── Save entry ──────────────────────────────────────────────────────────────

  const saveEntry = useCallback(async () => {
    if (!transcript.trim() && !title.trim()) return;
    setStage('saving');
    try {
      await createProjectBrainEntry({
        title: title.trim() || `Catatan Suara ${new Date().toLocaleDateString('id-ID')}`,
        description: transcript.trim(),
        kind: 'project',
      });
      queryClient.invalidateQueries({ queryKey: ['project-brain'] });
      setStage('done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Auto-close after brief success moment
      setTimeout(() => {
        onClose();
        resetState();
      }, 1200);
    } catch (err: unknown) {
      console.error('saveEntry error', err);
      const msg =
        err instanceof Error ? err.message : 'Gagal menyimpan catatan.';
      setErrorMsg(msg);
      setStage('preview');
    }
  }, [transcript, title, queryClient, onClose]);

  // ── Discard ─────────────────────────────────────────────────────────────────

  const handleDiscard = useCallback(() => {
    if (stage === 'recording') {
      Alert.alert('Hentikan Rekaman?', 'Rekaman akan dibuang.', [
        { text: 'Lanjut Rekam', style: 'cancel' },
        {
          text: 'Buang',
          style: 'destructive',
          onPress: async () => {
            stopTimer();
            try {
              await recordingRef.current?.stopAndUnloadAsync();
              await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
              recordingRef.current = null;
            } catch {}
            onClose();
            resetState();
          },
        },
      ]);
    } else {
      onClose();
      resetState();
    }
  }, [stage, onClose]);

  // ── Retry (go back to idle from preview) ────────────────────────────────────

  const handleRetry = useCallback(() => {
    resetState();
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  const bottomPad = isWeb ? 34 : insets.bottom;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleDiscard}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={s.overlay} onPress={stage === 'idle' ? handleDiscard : undefined}>
          <Pressable
            style={[
              s.sheet,
              {
                backgroundColor: colors.card,
                paddingBottom: bottomPad + 16,
              },
            ]}
            onPress={() => {}}
          >
            {/* Handle */}
            <View style={[s.handle, { backgroundColor: colors.border }]} />

            {/* Header row */}
            <View style={s.headerRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Feather name="mic" size={18} color={colors.primary} />
                <Text style={[s.title, { color: colors.foreground }]}>
                  Catatan Suara
                </Text>
              </View>
              <Pressable onPress={handleDiscard} hitSlop={12}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* Error */}
            {errorMsg ? (
              <View style={[s.errorBox, { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '44' }]}>
                <Feather name="alert-circle" size={14} color={colors.destructive} />
                <Text style={[s.errorText, { color: colors.destructive }]}>
                  {errorMsg}
                </Text>
              </View>
            ) : null}

            {/* ── IDLE stage ────────────────────────────────────────────── */}
            {stage === 'idle' && (
              <View style={s.stageWrap}>
                <Text style={[s.hint, { color: colors.mutedForeground }]}>
                  Tekan tombol dan mulai berbicara. Rekaman akan ditranskrip secara otomatis.
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    s.recordBtn,
                    { backgroundColor: '#EF4444', opacity: pressed ? 0.85 : 1 },
                  ]}
                  onPress={startRecording}
                >
                  <Feather name="mic" size={28} color="#fff" />
                </Pressable>
                <Text style={[s.hintSm, { color: colors.mutedForeground }]}>
                  Ketuk untuk mulai merekam
                </Text>
              </View>
            )}

            {/* ── RECORDING stage ───────────────────────────────────────── */}
            {stage === 'recording' && (
              <View style={s.stageWrap}>
                <View style={s.recordingRow}>
                  <PulsingDot active />
                  <Text style={[s.duration, { color: '#EF4444' }]}>
                    {formatDuration(durationMs)}
                  </Text>
                  <Text style={[s.recordingLabel, { color: colors.mutedForeground }]}>
                    Merekam…
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    s.stopBtn,
                    {
                      backgroundColor: colors.muted,
                      borderColor: colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                  onPress={stopAndTranscribe}
                >
                  <Feather name="square" size={20} color={colors.foreground} />
                  <Text style={[s.stopBtnText, { color: colors.foreground }]}>
                    Hentikan & Transkrip
                  </Text>
                </Pressable>
              </View>
            )}

            {/* ── TRANSCRIBING stage ────────────────────────────────────── */}
            {stage === 'transcribing' && (
              <View style={s.stageWrap}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[s.hint, { color: colors.mutedForeground, textAlign: 'center' }]}>
                  Sedang mentranskrip…
                </Text>
              </View>
            )}

            {/* ── PREVIEW / EDIT stage ──────────────────────────────────── */}
            {stage === 'preview' && (
              <ScrollView
                style={{ maxHeight: 340 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={s.previewWrap}>
                  <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>
                    Judul
                  </Text>
                  <TextInput
                    style={[
                      s.titleInput,
                      {
                        color: colors.foreground,
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                      },
                    ]}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Judul catatan"
                    placeholderTextColor={colors.mutedForeground}
                    returnKeyType="done"
                  />

                  <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginTop: 12 }]}>
                    Transkrip
                  </Text>
                  <TextInput
                    style={[
                      s.transcriptInput,
                      {
                        color: colors.foreground,
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                      },
                    ]}
                    value={transcript}
                    onChangeText={setTranscript}
                    placeholder="Teks transkrip…"
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    textAlignVertical="top"
                  />

                  <View style={s.previewActions}>
                    <Pressable
                      style={({ pressed }) => [
                        s.secondaryBtn,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.muted,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                      onPress={handleRetry}
                    >
                      <Feather name="rotate-ccw" size={15} color={colors.foreground} />
                      <Text style={[s.secondaryBtnText, { color: colors.foreground }]}>
                        Rekam Ulang
                      </Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        s.primaryBtn,
                        {
                          backgroundColor: colors.primary,
                          opacity: pressed ? 0.85 : 1,
                          flex: 1,
                        },
                      ]}
                      onPress={saveEntry}
                      disabled={!transcript.trim() && !title.trim()}
                    >
                      <Feather name="save" size={15} color="#fff" />
                      <Text style={s.primaryBtnText}>Simpan ke PKB</Text>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            )}

            {/* ── SAVING stage ─────────────────────────────────────────── */}
            {stage === 'saving' && (
              <View style={s.stageWrap}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[s.hint, { color: colors.mutedForeground, textAlign: 'center' }]}>
                  Menyimpan…
                </Text>
              </View>
            )}

            {/* ── DONE stage ───────────────────────────────────────────── */}
            {stage === 'done' && (
              <View style={s.stageWrap}>
                <View style={[s.doneCircle, { backgroundColor: '#1AA890' + '22' }]}>
                  <Feather name="check" size={32} color="#1AA890" />
                </View>
                <Text style={[s.hint, { color: colors.foreground, textAlign: 'center', fontFamily: 'PlusJakartaSans_600SemiBold' }]}>
                  Catatan disimpan!
                </Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
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
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    flex: 1,
  },
  stageWrap: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 16,
  },
  hint: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    paddingHorizontal: 8,
  },
  hintSm: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  recordBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  duration: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 1,
  },
  recordingLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 20,
  },
  stopBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  previewWrap: {
    paddingTop: 4,
    paddingBottom: 8,
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  titleInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  transcriptInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    minHeight: 100,
    maxHeight: 160,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 13,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  doneCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
