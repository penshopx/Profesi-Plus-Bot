/**
 * QuizSummaryPanel (mobile)
 *
 * Collapsible "Data Quiz Saya" panel shown in the synthesis phase before Exum
 * generation — mirrors the web panel. Lists the user's best pre/post/proficiency
 * score per quiz with pass/fail status so they can see exactly what data the AI
 * will use when building the Exum.
 */

import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { getMyQuizSummary, type MyQuizSummaryEntry } from '@/lib/api';
import type { useColors } from '@/hooks/useColors';

type Colors = ReturnType<typeof useColors>;

const GREEN = '#16A34A';
const AMBER = '#D97706';
const RED = '#DC2626';

function scoreColor(passed: boolean) {
  return passed ? GREEN : AMBER;
}

function PassBadge({ passed }: { passed: boolean }) {
  return passed ? (
    <View style={[s.badge, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
      <Feather name="check-circle" size={11} color="#15803D" />
      <Text style={[s.badgeText, { color: '#15803D' }]}>Lulus</Text>
    </View>
  ) : (
    <View style={[s.badge, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
      <Feather name="x-circle" size={11} color={RED} />
      <Text style={[s.badgeText, { color: RED }]}>Belum lulus</Text>
    </View>
  );
}

function LearningRow({ entry, colors }: { entry: MyQuizSummaryEntry; colors: Colors }) {
  const { pre, post, passingScore } = entry;
  const delta = pre && post ? post.score - pre.score : null;

  return (
    <View style={s.scoreRow}>
      <Text style={[s.scoreLabel, { color: colors.mutedForeground }]}>Pre</Text>
      <Text style={[s.scoreValue, { color: pre ? scoreColor(pre.passed) : colors.mutedForeground }]}>
        {pre ? `${pre.score}%` : '—'}
      </Text>
      <Feather name="arrow-right" size={11} color={colors.mutedForeground} />
      <Text style={[s.scoreLabel, { color: colors.mutedForeground }]}>Post</Text>
      <Text style={[s.scoreValue, { color: post ? scoreColor(post.passed) : colors.mutedForeground }]}>
        {post ? `${post.score}%` : '—'}
      </Text>
      {delta !== null && (
        <Text style={[s.deltaText, { color: delta > 0 ? GREEN : delta < 0 ? RED : colors.mutedForeground }]}>
          ({delta > 0 ? '+' : ''}{delta}%)
        </Text>
      )}
      <View style={{ flex: 1 }} />
      {post ? (
        <PassBadge passed={post.passed} />
      ) : pre ? (
        <Text style={[s.minText, { color: colors.mutedForeground }]}>Post belum dikerjakan</Text>
      ) : null}
      <Text style={[s.minText, { color: colors.mutedForeground }]}>min. {passingScore}%</Text>
    </View>
  );
}

function ProficiencyRow({ entry, colors }: { entry: MyQuizSummaryEntry; colors: Colors }) {
  const { proficiency, passingScore } = entry;
  if (!proficiency) return null;
  return (
    <View style={s.scoreRow}>
      <Text style={[s.scoreValue, { color: scoreColor(proficiency.passed) }]}>
        {proficiency.score}%
      </Text>
      <PassBadge passed={proficiency.passed} />
      <View style={{ flex: 1 }} />
      <Text style={[s.minText, { color: colors.mutedForeground }]}>min. {passingScore}%</Text>
    </View>
  );
}

function QuizCard({ entry, colors }: { entry: MyQuizSummaryEntry; colors: Colors }) {
  const isLearning = entry.quizType === 'learning';
  const hasData = isLearning ? entry.pre || entry.post : entry.proficiency;
  if (!hasData) return null;

  return (
    <View style={[s.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <View style={s.cardHeader}>
        <Feather
          name={isLearning ? 'book-open' : 'award'}
          size={13}
          color={isLearning ? '#3B82F6' : '#F59E0B'}
          style={{ marginTop: 2 }}
        />
        <View style={{ flex: 1 }}>
          <Text style={[s.cardTitle, { color: colors.foreground }]}>{entry.quizTitle}</Text>
          {entry.skkUnitCode ? (
            <Text style={[s.cardUnit, { color: colors.mutedForeground }]}>{entry.skkUnitCode}</Text>
          ) : null}
        </View>
      </View>
      {isLearning ? (
        <LearningRow entry={entry} colors={colors} />
      ) : (
        <ProficiencyRow entry={entry} colors={colors} />
      )}
    </View>
  );
}

export function QuizSummaryPanel({
  jabker,
  colors,
}: {
  /** Filter to a specific jabker; if null/undefined, shows all quizzes */
  jabker?: string | null;
  colors: Colors;
}) {
  // Collapsed by default on mobile — screen space is scarce above the chat input.
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-quiz-summary'],
    queryFn: getMyQuizSummary,
    staleTime: 60_000,
  });

  const entries = data
    ? jabker
      ? data.filter((e) => !e.jabker || e.jabker === jabker)
      : data
    : [];

  const passed = entries.filter((e) =>
    e.quizType === 'learning' ? e.post?.passed || e.pre?.passed : e.proficiency?.passed,
  ).length;

  return (
    <View style={[s.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={s.panelHeader}
        accessibilityRole="button"
        accessibilityLabel="Tampilkan data quiz saya"
      >
        <Feather name="book-open" size={15} color={colors.primary} />
        <Text style={[s.panelTitle, { color: colors.foreground }]}>Data Quiz Saya</Text>
        {!isLoading && data && (
          <Text style={[s.panelCount, { color: colors.mutedForeground }]}>
            {entries.length === 0 ? 'Belum ada quiz' : `${passed}/${entries.length} lulus`}
          </Text>
        )}
        <View style={{ flex: 1 }} />
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
      </Pressable>

      {open && (
        <View style={s.panelBody}>
          {isLoading && (
            <View style={s.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[s.hintText, { color: colors.mutedForeground }]}>Memuat data quiz…</Text>
            </View>
          )}

          {isError && (
            <Text style={[s.hintText, { color: RED }]}>
              Gagal memuat data quiz. Coba buka ulang halaman.
            </Text>
          )}

          {!isLoading && !isError && entries.length === 0 && (
            <View style={{ gap: 8 }}>
              <Text style={[s.hintText, { color: colors.mutedForeground }]}>
                Kamu belum mengerjakan quiz apapun. Quiz membantu AI memahami kompetensi terukurmu
                saat membuat Exum.
              </Text>
              <Pressable
                onPress={() => router.push('/(home)/quiz' as any)}
                style={s.linkRow}
                accessibilityRole="button"
              >
                <Feather name="external-link" size={13} color={colors.primary} />
                <Text style={[s.linkText, { color: colors.primary }]}>
                  Lihat daftar kuis yang tersedia
                </Text>
              </Pressable>
            </View>
          )}

          {!isLoading && !isError && entries.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={[s.hintText, { color: colors.mutedForeground }]}>
                AI akan menggunakan data ini saat membuat Exum-mu. Skor yang ditampilkan adalah
                hasil terbaikmu.
              </Text>
              {entries.map((entry) => (
                <QuizCard key={entry.quizId} entry={entry} colors={colors} />
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderRadius: 12,
    marginHorizontal: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  panelTitle: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold' },
  panelCount: { fontSize: 11, fontFamily: 'PlusJakartaSans_400Regular' },
  panelBody: { paddingHorizontal: 14, paddingBottom: 12 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  hintText: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 17 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 2 },
  linkText: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' },
  card: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  cardHeader: { flexDirection: 'row', gap: 7 },
  cardTitle: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', lineHeight: 18 },
  cardUnit: { fontSize: 11, fontFamily: 'PlusJakartaSans_400Regular' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  scoreLabel: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular' },
  scoreValue: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold' },
  deltaText: { fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium' },
  minText: { fontSize: 10, fontFamily: 'PlusJakartaSans_400Regular' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium' },
});
