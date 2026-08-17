/**
 * User-facing quiz screen — opens a single quiz directly via its `id` param.
 *
 * Flow:
 *   intro   — quiz info + attempt-type choice (Pre/Post for learning, single for proficiency)
 *   taking  — answer all questions, then submit
 *   result  — score, pass/fail, per-question feedback
 *
 * Reachable via router.push(`/(home)/quiz/${quizId}`), e.g. from the Exum
 * gap banner ("Mulai kuis").
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import {
  getQuiz,
  submitQuizAttempt,
  type QuizAttemptResult,
} from '@/lib/api';

type AttemptType = 'pre' | 'post' | 'proficiency';

export default function QuizScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const quizId = Number(id);
  const isWeb = Platform.OS === 'web';

  const [attemptType, setAttemptType] = useState<AttemptType | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);

  const {
    data: quiz,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['quiz', quizId],
    queryFn: () => getQuiz(quizId),
    enabled: Number.isFinite(quizId),
  });

  const submitMutation = useMutation({
    mutationFn: () => submitQuizAttempt(quizId, answers, attemptType!),
    onSuccess: (res) => {
      setResult(res);
      Haptics.notificationAsync(
        res.passed
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      );
      // Quiz evidence changed — coverage gaps and summaries may be stale.
      queryClient.invalidateQueries({ queryKey: ['my-quiz-summary'] });
      queryClient.invalidateQueries({ queryKey: ['quiz-coverage'] });
    },
  });

  const answeredCount = useMemo(
    () => (quiz ? quiz.questions.filter((q) => answers[q.id]).length : 0),
    [quiz, answers],
  );
  const allAnswered = quiz ? answeredCount === quiz.questions.length : false;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(home)/(tabs)');
  };

  return (
    <View
      style={[
        s.container,
        {
          backgroundColor: colors.background,
          paddingTop: isWeb ? 67 : insets.top,
          paddingBottom: isWeb ? 34 : insets.bottom,
        },
      ]}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={goBack} style={s.backBtn} accessibilityRole="button">
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
          {quiz?.title ?? 'Kuis'}
        </Text>
        <View style={s.backBtn} />
      </View>

      {/* ── Loading / error ────────────────────────────────────────────── */}
      {isLoading && (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[s.mutedText, { color: colors.mutedForeground }]}>Memuat kuis…</Text>
        </View>
      )}

      {isError && (
        <View style={s.center}>
          <Feather name="alert-circle" size={40} color={colors.destructive} />
          <Text style={[s.mutedText, { color: colors.foreground, textAlign: 'center' }]}>
            {(error as Error)?.message || 'Kuis tidak ditemukan'}
          </Text>
          <Pressable onPress={() => refetch()}>
            <Text style={[s.linkText, { color: colors.primary }]}>Coba lagi</Text>
          </Pressable>
        </View>
      )}

      {/* ── Intro: choose attempt type ─────────────────────────────────── */}
      {quiz && !attemptType && !result && (
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={[s.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.infoRow}>
              <Feather
                name={quiz.quizType === 'learning' ? 'book-open' : 'star'}
                size={18}
                color={colors.primary}
              />
              <Text style={[s.infoType, { color: colors.primary }]}>
                {quiz.quizType === 'learning' ? 'Learning Quiz' : 'Proficiency Quiz'}
              </Text>
            </View>
            <Text style={[s.infoTitle, { color: colors.foreground }]}>{quiz.title}</Text>
            {!!quiz.description && (
              <Text style={[s.mutedText, { color: colors.mutedForeground }]}>
                {quiz.description}
              </Text>
            )}
            {!!quiz.skkUnitCode && (
              <Text style={[s.infoMeta, { color: colors.mutedForeground }]}>
                Unit: {quiz.skkUnitCode}
                {quiz.skkUnitName ? ` — ${quiz.skkUnitName}` : ''}
              </Text>
            )}
            <Text style={[s.infoMeta, { color: colors.mutedForeground }]}>
              {quiz.questions.length} pertanyaan · Nilai lulus {quiz.passingScore}%
            </Text>
          </View>

          <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>
            {quiz.quizType === 'learning'
              ? 'Pilih jenis percobaan'
              : 'Mulai kuis untuk memvalidasi kompetensimu'}
          </Text>

          {quiz.quizType === 'learning' ? (
            <View style={{ gap: 10 }}>
              <Pressable
                onPress={() => setAttemptType('pre')}
                style={[s.primaryBtn, { backgroundColor: colors.primary }]}
              >
                <Feather name="play" size={16} color={colors.primaryForeground} />
                <Text style={[s.primaryBtnText, { color: colors.primaryForeground }]}>
                  Pre-test (sebelum belajar)
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setAttemptType('post')}
                style={[s.outlineBtn, { borderColor: colors.primary }]}
              >
                <Feather name="check-circle" size={16} color={colors.primary} />
                <Text style={[s.primaryBtnText, { color: colors.primary }]}>
                  Post-test (setelah belajar)
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setAttemptType('proficiency')}
              style={[s.primaryBtn, { backgroundColor: colors.primary }]}
            >
              <Feather name="play" size={16} color={colors.primaryForeground} />
              <Text style={[s.primaryBtnText, { color: colors.primaryForeground }]}>
                Mulai kuis
              </Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      {/* ── Taking: answer questions ───────────────────────────────────── */}
      {quiz && attemptType && !result && (
        <>
          <ScrollView contentContainerStyle={s.scroll}>
            {quiz.questions.map((q, idx) => (
              <View
                key={q.id}
                style={[s.questionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Text style={[s.questionNum, { color: colors.mutedForeground }]}>
                  Pertanyaan {idx + 1} / {quiz.questions.length}
                </Text>
                <Text style={[s.questionText, { color: colors.foreground }]}>{q.text}</Text>
                <View style={{ gap: 8 }}>
                  {q.options.map((opt) => {
                    const selected = answers[q.id] === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => setAnswers((a) => ({ ...a, [q.id]: opt.id }))}
                        style={[
                          s.option,
                          {
                            borderColor: selected ? colors.primary : colors.border,
                            backgroundColor: selected ? `${colors.primary}14` : 'transparent',
                          },
                        ]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                      >
                        <Feather
                          name={selected ? 'check-circle' : 'circle'}
                          size={16}
                          color={selected ? colors.primary : colors.mutedForeground}
                        />
                        <Text style={[s.optionText, { color: colors.foreground }]}>{opt.text}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
            {!!submitMutation.error && (
              <Text style={[s.mutedText, { color: colors.destructive, textAlign: 'center' }]}>
                {(submitMutation.error as Error).message}
              </Text>
            )}
          </ScrollView>
          <View style={[s.footer, { borderTopColor: colors.border }]}>
            <Text style={[s.infoMeta, { color: colors.mutedForeground }]}>
              {answeredCount}/{quiz.questions.length} terjawab
            </Text>
            <Pressable
              onPress={() => submitMutation.mutate()}
              disabled={!allAnswered || submitMutation.isPending}
              style={[
                s.primaryBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: !allAnswered || submitMutation.isPending ? 0.5 : 1,
                  flex: 1,
                },
              ]}
            >
              {submitMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Text style={[s.primaryBtnText, { color: colors.primaryForeground }]}>
                  Kirim jawaban
                </Text>
              )}
            </Pressable>
          </View>
        </>
      )}

      {/* ── Result ─────────────────────────────────────────────────────── */}
      {quiz && result && (
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.resultHeader}>
            <Feather
              name={result.passed ? 'award' : 'x-circle'}
              size={48}
              color={result.passed ? '#1AA890' : colors.destructive}
            />
            <Text style={[s.resultScore, { color: colors.foreground }]}>
              {result.scorePercent}%
            </Text>
            <Text
              style={[
                s.resultBadge,
                result.passed
                  ? { backgroundColor: '#D1FAE5', color: '#065F46' }
                  : { backgroundColor: '#FEE2E2', color: '#991B1B' },
              ]}
            >
              {result.passed ? 'Lulus' : `Belum lulus (min. ${result.passingScore}%)`}
            </Text>
          </View>

          {quiz.questions.map((q, idx) => {
            const fb = result.feedback.find((f) => f.questionId === q.id);
            if (!fb) return null;
            return (
              <View
                key={q.id}
                style={[s.questionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={s.feedbackRow}>
                  <Feather
                    name={fb.correct ? 'check-circle' : 'x-circle'}
                    size={16}
                    color={fb.correct ? '#1AA890' : colors.destructive}
                  />
                  <Text style={[s.questionNum, { color: colors.mutedForeground, marginBottom: 0 }]}>
                    Pertanyaan {idx + 1} — {fb.correct ? 'Benar' : 'Salah'}
                  </Text>
                </View>
                <Text style={[s.questionText, { color: colors.foreground }]}>{q.text}</Text>
                {!!fb.explanation && (
                  <Text style={[s.mutedText, { color: colors.mutedForeground }]}>
                    {fb.explanation}
                  </Text>
                )}
              </View>
            );
          })}

          <View style={{ gap: 10, marginTop: 8 }}>
            <Pressable
              onPress={() => {
                setResult(null);
                setAnswers({});
                setAttemptType(null);
                submitMutation.reset();
              }}
              style={[s.outlineBtn, { borderColor: colors.primary }]}
            >
              <Feather name="rotate-ccw" size={16} color={colors.primary} />
              <Text style={[s.primaryBtnText, { color: colors.primary }]}>Ulangi kuis</Text>
            </Pressable>
            <Pressable onPress={goBack} style={[s.primaryBtn, { backgroundColor: colors.primary }]}>
              <Text style={[s.primaryBtnText, { color: colors.primaryForeground }]}>Selesai</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4, width: 30 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  scroll: { padding: 16, gap: 12 },
  mutedText: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 20 },
  linkText: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', marginTop: 8 },
  infoCard: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoType: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold' },
  infoTitle: { fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold' },
  infoMeta: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular' },
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 20,
  },
  primaryBtnText: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold' },
  questionCard: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 8 },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  questionNum: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 2 },
  questionText: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', lineHeight: 21 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  optionText: { flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 19 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  resultHeader: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  resultScore: { fontSize: 36, fontFamily: 'PlusJakartaSans_700Bold' },
  resultBadge: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    overflow: 'hidden',
  },
});
