/**
 * Quiz Statistics — Admin-only screen showing performance stats for one quiz:
 * total attempts, pass rate, average score, and per-question failure rates
 * (sorted most-failed first by the server) so admins can spot weak questions.
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { getAdminQuizStats, type QuizQuestionStats } from '@/lib/api';

function failColor(rate: number, colors: ReturnType<typeof useColors>): string {
  if (rate >= 60) return colors.destructive;
  if (rate >= 30) return colors.accent;
  return colors.primary;
}

function QuestionStatCard({
  q,
  index,
  totalAttempts,
  colors,
}: {
  q: QuizQuestionStats;
  index: number;
  totalAttempts: number;
  colors: ReturnType<typeof useColors>;
}) {
  const barColor = failColor(q.failRate, colors);

  return (
    <View style={[qs.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={qs.headerRow}>
        <Text style={[qs.num, { color: colors.mutedForeground }]}>Soal {index + 1}</Text>
        <View style={[qs.rateBadge, { backgroundColor: barColor + '22' }]}>
          <Text style={[qs.rateText, { color: barColor }]}>{q.failRate}% gagal</Text>
        </View>
      </View>

      <Text style={[qs.text, { color: colors.foreground }]}>{q.text}</Text>

      {/* Failure rate bar */}
      <View style={[qs.barTrack, { backgroundColor: colors.muted }]}>
        <View
          style={[
            qs.barFill,
            { backgroundColor: barColor, width: `${Math.min(q.failRate, 100)}%` },
          ]}
        />
      </View>

      {/* Option answer distribution */}
      <View style={{ gap: 6, marginTop: 8 }}>
        {q.options.map((opt) => {
          const isCorrect = opt.id === q.correctId;
          const chosen = q.optionCounts[opt.id] ?? 0;
          return (
            <View
              key={opt.id}
              style={[
                qs.option,
                {
                  backgroundColor: isCorrect ? colors.primary + '18' : colors.muted,
                  borderColor: isCorrect ? colors.primary + '55' : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  qs.optLabel,
                  {
                    flex: 1,
                    color: isCorrect ? colors.primary : colors.mutedForeground,
                    fontFamily: isCorrect
                      ? 'PlusJakartaSans_600SemiBold'
                      : 'PlusJakartaSans_400Regular',
                  },
                ]}
              >
                {opt.id.toUpperCase()}. {opt.text}
              </Text>
              <Text
                style={[
                  qs.optCount,
                  { color: isCorrect ? colors.primary : colors.mutedForeground },
                ]}
              >
                {chosen}×
              </Text>
            </View>
          );
        })}
      </View>

      {totalAttempts === 0 ? (
        <Text style={[qs.noData, { color: colors.mutedForeground }]}>
          Belum ada percobaan untuk soal ini.
        </Text>
      ) : null}
    </View>
  );
}

export default function QuizStatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const quizId = Number(id);

  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;

  const {
    data: stats,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-quiz-stats', quizId],
    queryFn: () => getAdminQuizStats(quizId),
    enabled: Number.isFinite(quizId),
    retry: 1,
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={[
          st.bar,
          { paddingTop: topPad + 8, borderBottomColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[st.title, { color: colors.foreground }]} numberOfLines={1}>
          Statistik Quiz
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : isError || !stats ? (
        <View style={{ alignItems: 'center', marginTop: 40, gap: 12, paddingHorizontal: 24 }}>
          <Feather name="alert-circle" size={32} color={colors.destructive} />
          <Text style={[st.emptyText, { color: colors.mutedForeground }]}>
            {(error as Error | null)?.message || 'Gagal memuat statistik quiz'}
          </Text>
          <Pressable onPress={() => refetch()} style={[st.retryBtn, { borderColor: colors.border }]}>
            <Text style={{ color: colors.primary, fontFamily: 'PlusJakartaSans_500Medium' }}>
              Coba Lagi
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[st.content, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={[st.quizTitle, { color: colors.foreground }]}>{stats.title}</Text>

          {/* Summary stats */}
          <View style={[st.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={st.stat}>
              <Text style={[st.statNum, { color: colors.foreground }]}>{stats.totalAttempts}</Text>
              <Text style={[st.statLabel, { color: colors.mutedForeground }]}>Percobaan</Text>
            </View>
            <View style={[st.statDivider, { backgroundColor: colors.border }]} />
            <View style={st.stat}>
              <Text style={[st.statNum, { color: colors.primary }]}>{stats.passRate}%</Text>
              <Text style={[st.statLabel, { color: colors.mutedForeground }]}>Lulus</Text>
            </View>
            <View style={[st.statDivider, { backgroundColor: colors.border }]} />
            <View style={st.stat}>
              <Text style={[st.statNum, { color: colors.mutedForeground }]}>{stats.avgScore}</Text>
              <Text style={[st.statLabel, { color: colors.mutedForeground }]}>Rata-rata</Text>
            </View>
          </View>

          {stats.totalAttempts === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 24, gap: 8 }}>
              <Feather name="bar-chart-2" size={40} color={colors.mutedForeground} />
              <Text style={[st.emptyText, { color: colors.mutedForeground }]}>
                Belum ada percobaan
              </Text>
              <Text style={[st.emptyHint, { color: colors.mutedForeground }]}>
                Statistik per soal akan muncul setelah pengguna mengerjakan quiz ini.
              </Text>
            </View>
          ) : (
            <>
              <Text style={[st.sectionLabel, { color: colors.mutedForeground }]}>
                Tingkat kegagalan per soal — tertinggi di atas
              </Text>
              {stats.questions.map((q, i) => (
                <QuestionStatCard
                  key={q.id}
                  q={q}
                  index={i}
                  totalAttempts={stats.totalAttempts}
                  colors={colors}
                />
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_700Bold',
    textAlign: 'center',
  },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  quizTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    lineHeight: 21,
  },
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
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
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
});

const qs = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  num: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  rateText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  text: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    lineHeight: 20,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  optLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  optCount: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  noData: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontStyle: 'italic',
    marginTop: 4,
  },
});
