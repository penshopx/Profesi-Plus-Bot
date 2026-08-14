/**
 * Kelola Quiz — Admin-only screen for managing quiz content on mobile.
 *
 * Features:
 * - List all quizzes (active + inactive) with toggle controls
 * - Generate new quiz questions via AI
 * - Save generated questions as a new quiz
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  listAdminQuizzes,
  adminToggleQuiz,
  adminGenerateQuestions,
  adminCreateQuiz,
  type QuizAdminSummary,
  type QuizQuestionAdmin,
} from '@/lib/api';

// ─── Quiz list item ────────────────────────────────────────────────────────────

function QuizRow({
  quiz,
  onToggle,
  toggling,
  colors,
}: {
  quiz: QuizAdminSummary;
  onToggle: (id: number, next: boolean) => void;
  toggling: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const typeLabel = quiz.quizType === 'proficiency' ? 'Proficiency' : 'Learning';
  const typeColor = quiz.quizType === 'proficiency' ? colors.accent : colors.primary;

  return (
    <View style={[qr.row, { borderBottomColor: colors.border }]}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[qr.title, { color: colors.foreground }]} numberOfLines={2}>
          {quiz.title}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Text style={[qr.badge, { backgroundColor: typeColor + '22', color: typeColor }]}>
            {typeLabel}
          </Text>
          {quiz.jabker ? (
            <Text style={[qr.badge, { backgroundColor: colors.muted, color: colors.mutedForeground }]}>
              {quiz.jabker}
            </Text>
          ) : null}
          {quiz.skkUnitCode ? (
            <Text style={[qr.badge, { backgroundColor: colors.muted, color: colors.mutedForeground }]}>
              {quiz.skkUnitCode}
            </Text>
          ) : null}
        </View>
        <Text style={[qr.sub, { color: colors.mutedForeground }]}>
          Lulus ≥ {quiz.passingScore}%
          {Array.isArray(quiz.questions) ? ` · ${quiz.questions.length} soal` : ''}
        </Text>
      </View>
      <Switch
        value={quiz.isActive}
        onValueChange={(v) => onToggle(quiz.id, v)}
        disabled={toggling}
        trackColor={{ false: colors.border, true: colors.primary + '88' }}
        thumbColor={quiz.isActive ? colors.primary : colors.mutedForeground}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}

const qr = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    lineHeight: 20,
  },
  sub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  badge: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
});

// ─── Question preview card ─────────────────────────────────────────────────────

function QuestionCard({
  q,
  index,
  colors,
}: {
  q: QuizQuestionAdmin;
  index: number;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[qc.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[qc.num, { color: colors.mutedForeground }]}>Soal {index + 1}</Text>
      <Text style={[qc.text, { color: colors.foreground }]}>{q.text}</Text>
      <View style={{ gap: 6, marginTop: 8 }}>
        {q.options.map((opt) => (
          <View
            key={opt.id}
            style={[
              qc.option,
              {
                backgroundColor:
                  opt.id === q.correctId ? colors.primary + '18' : colors.muted,
                borderColor:
                  opt.id === q.correctId ? colors.primary + '55' : 'transparent',
              },
            ]}
          >
            <Text
              style={[
                qc.optLabel,
                {
                  color:
                    opt.id === q.correctId ? colors.primary : colors.mutedForeground,
                  fontFamily:
                    opt.id === q.correctId
                      ? 'PlusJakartaSans_600SemiBold'
                      : 'PlusJakartaSans_400Regular',
                },
              ]}
            >
              {opt.id.toUpperCase()}. {opt.text}
            </Text>
          </View>
        ))}
      </View>
      {q.explanation ? (
        <Text style={[qc.explanation, { color: colors.mutedForeground }]}>
          💡 {q.explanation}
        </Text>
      ) : null}
    </View>
  );
}

const qc = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  num: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  text: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    lineHeight: 20,
  },
  option: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  optLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  explanation: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontStyle: 'italic',
    marginTop: 6,
    lineHeight: 17,
  },
});

// ─── Generate form ─────────────────────────────────────────────────────────────

type GenView = 'list' | 'generate' | 'preview';

interface GenForm {
  jabker: string;
  skkUnitCode: string;
  skkUnitName: string;
  quizType: 'learning' | 'proficiency';
  count: number;
}

// ─── Client-side question validation ───────────────────────────────────────────
//
// Mirrors the server-side rules (POST /quizzes) so admins get instant, clear
// feedback before saving: no blank question text, at least 2 non-blank options,
// a chosen correct answer, and no duplicate question IDs or duplicate text.

export function validateQuizQuestions(questions: QuizQuestionAdmin[]): string | null {
  if (!questions.length) return 'Quiz harus memiliki minimal 1 soal.';

  const ids: string[] = [];
  const normalizedTexts: string[] = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const num = i + 1;

    if (!q.text || !q.text.trim()) {
      return `Soal #${num}: teks soal tidak boleh kosong.`;
    }
    const normalized = q.text.trim().replace(/\s+/g, ' ').toLowerCase();
    const dupIdx = normalizedTexts.indexOf(normalized);
    if (dupIdx !== -1) {
      return `Soal #${num}: teks soal sama dengan soal #${dupIdx + 1} (duplikat).`;
    }
    normalizedTexts.push(normalized);

    if (!Array.isArray(q.options) || q.options.length < 2) {
      return `Soal #${num}: minimal harus ada 2 pilihan jawaban.`;
    }
    for (const opt of q.options) {
      if (!opt.text || !opt.text.trim()) {
        return `Soal #${num}: opsi ${(opt.id || '?').toUpperCase()} tidak boleh kosong.`;
      }
    }

    if (!q.correctId) {
      return `Soal #${num}: jawaban benar belum dipilih.`;
    }

    if (q.id) {
      if (ids.includes(q.id)) {
        return `Soal #${num}: ID soal "${q.id}" duplikat.`;
      }
      ids.push(q.id);
    }
  }
  return null;
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function KelolaQuizScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;

  const [view, setView] = useState<GenView>('list');
  const [form, setForm] = useState<GenForm>({
    jabker: '',
    skkUnitCode: '',
    skkUnitName: '',
    quizType: 'learning',
    count: 10,
  });
  const [generatedQuestions, setGeneratedQuestions] = useState<QuizQuestionAdmin[]>([]);
  const [suggestedTitle, setSuggestedTitle] = useState('');
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());

  // ── Queries ──────────────────────────────────────────────────────────────────

  const {
    data: quizzes = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['admin-quizzes'],
    queryFn: listAdminQuizzes,
    retry: 1,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      adminToggleQuiz(id, isActive),
    onMutate: ({ id }) => {
      setTogglingIds((s) => new Set(s).add(id));
    },
    onSettled: (_, __, { id }) => {
      setTogglingIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['admin-quizzes'] });
    },
    onError: (err: Error) => {
      Alert.alert('Gagal', err.message);
    },
  });

  const generateMut = useMutation({
    mutationFn: () =>
      adminGenerateQuestions({
        jabker: form.jabker.trim(),
        skkUnitCode: form.skkUnitCode.trim() || undefined,
        skkUnitName: form.skkUnitName.trim() || undefined,
        quizType: form.quizType,
        count: form.count,
      }),
    onSuccess: (data) => {
      setGeneratedQuestions(data.questions);
      setSuggestedTitle(data.suggestedTitle);
      setView('preview');
    },
    onError: (err: Error) => {
      Alert.alert('Gagal Generate', err.message);
    },
  });

  const saveMut = useMutation({
    mutationFn: (title: string) =>
      adminCreateQuiz({
        title,
        jabker: form.jabker.trim() || undefined,
        skkUnitCode: form.skkUnitCode.trim() || undefined,
        skkUnitName: form.skkUnitName.trim() || undefined,
        quizType: form.quizType,
        passingScore: 70,
        questions: generatedQuestions,
        isActive: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-quizzes'] });
      setView('list');
      setGeneratedQuestions([]);
      setSuggestedTitle('');
      setForm({ jabker: '', skkUnitCode: '', skkUnitName: '', quizType: 'learning', count: 10 });
      Alert.alert('Berhasil', 'Quiz berhasil disimpan dan diaktifkan.');
    },
    onError: (err: Error) => {
      Alert.alert('Gagal Simpan', err.message);
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleToggle = (id: number, next: boolean) => {
    toggleMut.mutate({ id, isActive: next });
  };

  const handleGenerate = () => {
    if (!form.jabker.trim()) {
      Alert.alert('Form Tidak Lengkap', 'Jabatan Kerja wajib diisi.');
      return;
    }
    generateMut.mutate();
  };

  const handleSave = () => {
    if (!suggestedTitle.trim()) {
      Alert.alert('Judul Quiz', 'Judul tidak boleh kosong.');
      return;
    }
    const validationError = validateQuizQuestions(generatedQuestions);
    if (validationError) {
      Alert.alert('Soal Tidak Valid', validationError);
      return;
    }
    saveMut.mutate(suggestedTitle);
  };

  const activeCount = quizzes.filter((q) => q.isActive).length;

  // ── Render: Quiz list ─────────────────────────────────────────────────────────

  if (view === 'list') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View
          style={[
            hdr.bar,
            { paddingTop: topPad + 8, borderBottomColor: colors.border, backgroundColor: colors.background },
          ]}
        >
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[hdr.title, { color: colors.foreground }]}>Kelola Quiz</Text>
          <Pressable
            onPress={() => setView('generate')}
            style={({ pressed }) => [
              hdr.addBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={hdr.addText}>Generate</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[ls.content, { paddingBottom: insets.bottom + 24 }]}
        >
          {/* Stats */}
          <View style={[ls.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={ls.stat}>
              <Text style={[ls.statNum, { color: colors.foreground }]}>{quizzes.length}</Text>
              <Text style={[ls.statLabel, { color: colors.mutedForeground }]}>Total Quiz</Text>
            </View>
            <View style={[ls.statDivider, { backgroundColor: colors.border }]} />
            <View style={ls.stat}>
              <Text style={[ls.statNum, { color: colors.primary }]}>{activeCount}</Text>
              <Text style={[ls.statLabel, { color: colors.mutedForeground }]}>Aktif</Text>
            </View>
            <View style={[ls.statDivider, { backgroundColor: colors.border }]} />
            <View style={ls.stat}>
              <Text style={[ls.statNum, { color: colors.mutedForeground }]}>
                {quizzes.length - activeCount}
              </Text>
              <Text style={[ls.statLabel, { color: colors.mutedForeground }]}>Non-aktif</Text>
            </View>
          </View>

          {/* Quiz list */}
          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : isError ? (
            <View style={{ alignItems: 'center', marginTop: 40, gap: 12 }}>
              <Feather name="alert-circle" size={32} color={colors.destructive} />
              <Text style={[ls.emptyText, { color: colors.mutedForeground }]}>
                Gagal memuat daftar quiz
              </Text>
              <Pressable
                onPress={() => refetch()}
                style={[ls.retryBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.primary, fontFamily: 'PlusJakartaSans_500Medium' }}>
                  Coba Lagi
                </Text>
              </Pressable>
            </View>
          ) : quizzes.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 40, gap: 8 }}>
              <Feather name="inbox" size={40} color={colors.mutedForeground} />
              <Text style={[ls.emptyText, { color: colors.mutedForeground }]}>
                Belum ada quiz
              </Text>
              <Text style={[ls.emptyHint, { color: colors.mutedForeground }]}>
                Tekan "Generate" untuk membuat quiz baru dengan AI
              </Text>
            </View>
          ) : (
            <View style={[ls.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {quizzes.map((q) => (
                <QuizRow
                  key={q.id}
                  quiz={q}
                  onToggle={handleToggle}
                  toggling={togglingIds.has(q.id)}
                  colors={colors}
                />
              ))}
            </View>
          )}

          <Text style={[ls.hint, { color: colors.mutedForeground }]}>
            Toggle switch untuk mengaktifkan atau menonaktifkan quiz. Quiz non-aktif tidak muncul ke pengguna.
          </Text>
        </ScrollView>
      </View>
    );
  }

  // ── Render: Generate form ─────────────────────────────────────────────────────

  if (view === 'generate') {
    const canGenerate = form.jabker.trim().length > 0 && !generateMut.isPending;

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={[
            hdr.bar,
            { paddingTop: topPad + 8, borderBottomColor: colors.border, backgroundColor: colors.background },
          ]}
        >
          <Pressable onPress={() => setView('list')} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[hdr.title, { color: colors.foreground }]}>Generate AI Quiz</Text>
          <View style={{ width: 80 }} />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[gf.content, { paddingBottom: insets.bottom + 24 }]}
        >
          <Text style={[gf.sectionLabel, { color: colors.mutedForeground }]}>
            Informasi Quiz
          </Text>

          <View style={[gf.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[gf.fieldLabel, { color: colors.mutedForeground }]}>
              Jabatan Kerja *
            </Text>
            <TextInput
              value={form.jabker}
              onChangeText={(v) => setForm((f) => ({ ...f, jabker: v }))}
              placeholder="mis. Pelaksana Lapangan Pekerjaan Gedung"
              placeholderTextColor={colors.mutedForeground}
              style={[
                gf.input,
                {
                  color: colors.foreground,
                  backgroundColor: colors.muted,
                  borderColor: colors.border,
                },
              ]}
            />

            <Text style={[gf.fieldLabel, { color: colors.mutedForeground, marginTop: 12 }]}>
              Kode Unit SKK (opsional)
            </Text>
            <TextInput
              value={form.skkUnitCode}
              onChangeText={(v) => setForm((f) => ({ ...f, skkUnitCode: v }))}
              placeholder="mis. F.410100.004.02"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              style={[
                gf.input,
                {
                  color: colors.foreground,
                  backgroundColor: colors.muted,
                  borderColor: colors.border,
                },
              ]}
            />

            <Text style={[gf.fieldLabel, { color: colors.mutedForeground, marginTop: 12 }]}>
              Nama Unit SKK (opsional)
            </Text>
            <TextInput
              value={form.skkUnitName}
              onChangeText={(v) => setForm((f) => ({ ...f, skkUnitName: v }))}
              placeholder="mis. Melaksanakan Pekerjaan Persiapan"
              placeholderTextColor={colors.mutedForeground}
              style={[
                gf.input,
                {
                  color: colors.foreground,
                  backgroundColor: colors.muted,
                  borderColor: colors.border,
                },
              ]}
            />
          </View>

          <Text style={[gf.sectionLabel, { color: colors.mutedForeground, marginTop: 16 }]}>
            Tipe & Jumlah Soal
          </Text>

          <View style={[gf.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Quiz type toggle */}
            <Text style={[gf.fieldLabel, { color: colors.mutedForeground }]}>Tipe Quiz</Text>
            <View style={gf.typeRow}>
              {(['learning', 'proficiency'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setForm((f) => ({ ...f, quizType: t }))}
                  style={[
                    gf.typeBtn,
                    {
                      backgroundColor:
                        form.quizType === t ? colors.primary : colors.muted,
                      borderColor:
                        form.quizType === t ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      gf.typeBtnText,
                      {
                        color: form.quizType === t ? '#fff' : colors.mutedForeground,
                      },
                    ]}
                  >
                    {t === 'learning' ? 'Learning' : 'Proficiency'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={[gf.typeDesc, { color: colors.mutedForeground }]}>
              {form.quizType === 'learning'
                ? 'Soal berbasis materi pembelajaran PKB (konsep, regulasi, teori)'
                : 'Soal berbasis pengalaman kerja (situasi nyata, keputusan teknis)'}
            </Text>

            {/* Count */}
            <Text style={[gf.fieldLabel, { color: colors.mutedForeground, marginTop: 12 }]}>
              Jumlah Soal
            </Text>
            <View style={gf.typeRow}>
              {[5, 10, 15].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setForm((f) => ({ ...f, count: n }))}
                  style={[
                    gf.typeBtn,
                    {
                      backgroundColor:
                        form.count === n ? colors.primary : colors.muted,
                      borderColor:
                        form.count === n ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      gf.typeBtnText,
                      { color: form.count === n ? '#fff' : colors.mutedForeground },
                    ]}
                  >
                    {n}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {generateMut.isError ? (
            <View style={[gf.errorBox, { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '44' }]}>
              <Feather name="alert-circle" size={14} color={colors.destructive} />
              <Text style={[gf.errorText, { color: colors.destructive }]}>
                {(generateMut.error as Error).message}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleGenerate}
            disabled={!canGenerate}
            style={({ pressed }) => [
              gf.generateBtn,
              {
                backgroundColor: canGenerate ? colors.primary : colors.muted,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            {generateMut.isPending ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={gf.generateBtnText}>Membuat soal… (30–60 dtk)</Text>
              </>
            ) : (
              <>
                <Feather name="cpu" size={16} color={canGenerate ? '#fff' : colors.mutedForeground} />
                <Text
                  style={[
                    gf.generateBtnText,
                    { color: canGenerate ? '#fff' : colors.mutedForeground },
                  ]}
                >
                  Generate dengan AI
                </Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ── Render: Preview + save ────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          hdr.bar,
          { paddingTop: topPad + 8, borderBottomColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <Pressable
          onPress={() => setView('generate')}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[hdr.title, { color: colors.foreground }]}>Preview Soal</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView
        contentContainerStyle={[pv.content, { paddingBottom: insets.bottom + 24 }]}
      >
        {/* Title edit */}
        <View style={[pv.titleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[pv.titleLabel, { color: colors.mutedForeground }]}>Judul Quiz</Text>
          <TextInput
            value={suggestedTitle}
            onChangeText={setSuggestedTitle}
            style={[pv.titleInput, { color: colors.foreground, borderBottomColor: colors.border }]}
            placeholder="Judul quiz..."
            placeholderTextColor={colors.mutedForeground}
          />
          <Text style={[pv.meta, { color: colors.mutedForeground }]}>
            {generatedQuestions.length} soal · {form.quizType === 'learning' ? 'Learning' : 'Proficiency'}
            {form.jabker ? ` · ${form.jabker}` : ''}
          </Text>
        </View>

        {/* Questions */}
        {generatedQuestions.map((q, i) => (
          <QuestionCard key={q.id} q={q} index={i} colors={colors} />
        ))}

        {/* Save */}
        <Pressable
          onPress={handleSave}
          disabled={saveMut.isPending}
          style={({ pressed }) => [
            pv.saveBtn,
            { backgroundColor: colors.primary, opacity: pressed || saveMut.isPending ? 0.75 : 1 },
          ]}
        >
          {saveMut.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Feather name="save" size={16} color="#fff" />
          )}
          <Text style={pv.saveBtnText}>
            {saveMut.isPending ? 'Menyimpan…' : 'Simpan Quiz'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setView('generate')}
          disabled={saveMut.isPending}
          style={({ pressed }) => [
            pv.regenBtn,
            { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Feather name="refresh-cw" size={14} color={colors.primary} />
          <Text style={[pv.regenText, { color: colors.primary }]}>Generate Ulang</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ─── Shared header styles ──────────────────────────────────────────────────────

const hdr = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  addText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
});

// ─── List styles ───────────────────────────────────────────────────────────────

const ls = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
  statsRow: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    gap: 2,
  },
  statDivider: { width: 1 },
  statNum: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_400Regular',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    textAlign: 'center',
    maxWidth: 280,
  },
  retryBtn: {
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 10,
  },
  hint: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    textAlign: 'center',
    lineHeight: 17,
  },
});

// ─── Generate form styles ──────────────────────────────────────────────────────

const gf = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  typeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  typeBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  typeDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontStyle: 'italic',
    marginTop: 6,
    lineHeight: 17,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    lineHeight: 18,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 8,
  },
  generateBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
});

// ─── Preview styles ────────────────────────────────────────────────────────────

const pv = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  titleCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  titleLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  titleInput: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    borderBottomWidth: 1,
    paddingBottom: 4,
  },
  meta: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    marginTop: 2,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  regenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 13,
  },
  regenText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
});
