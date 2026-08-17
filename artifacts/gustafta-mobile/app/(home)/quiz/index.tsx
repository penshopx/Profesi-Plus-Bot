/**
 * Quiz list screen — lets users browse all active quizzes proactively,
 * not just via the Exum gap banner.
 *
 * Shows title, type, SKK unit, and pass status (from /quizzes/my-summary).
 * Tapping a quiz opens the existing /(home)/quiz/[id] taking screen.
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import {
  listQuizzes,
  getMyQuizSummary,
  type QuizListItem,
  type MyQuizSummaryEntry,
} from '@/lib/api';

const GREEN = '#15803D';
const AMBER = '#B45309';

/** Pass status for a quiz derived from the user's summary entry. */
function passStatus(entry: MyQuizSummaryEntry | undefined): 'passed' | 'attempted' | 'none' {
  if (!entry) return 'none';
  const passed =
    entry.quizType === 'learning'
      ? entry.post?.passed || entry.pre?.passed
      : entry.proficiency?.passed;
  if (passed) return 'passed';
  const attempted =
    entry.quizType === 'learning'
      ? !!(entry.pre || entry.post)
      : !!entry.proficiency;
  return attempted ? 'attempted' : 'none';
}

function StatusBadge({ status }: { status: 'passed' | 'attempted' | 'none' }) {
  if (status === 'none') return null;
  const passed = status === 'passed';
  return (
    <View
      style={[
        s.badge,
        passed
          ? { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }
          : { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
      ]}
    >
      <Feather
        name={passed ? 'check-circle' : 'clock'}
        size={11}
        color={passed ? GREEN : AMBER}
      />
      <Text style={[s.badgeText, { color: passed ? GREEN : AMBER }]}>
        {passed ? 'Lulus' : 'Belum lulus'}
      </Text>
    </View>
  );
}

export default function QuizListScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isWeb = Platform.OS === 'web';

  const {
    data: quizzes,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({ queryKey: ['quizzes'], queryFn: () => listQuizzes() });

  // Pass status per quiz; non-blocking — the list renders without it.
  const { data: summary } = useQuery({
    queryKey: ['my-quiz-summary'],
    queryFn: getMyQuizSummary,
    staleTime: 60_000,
  });
  const summaryByQuizId = new Map((summary ?? []).map((e) => [e.quizId, e]));

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(home)/(tabs)');
  };

  const renderCard = (quiz: QuizListItem) => {
    const isLearning = quiz.quizType === 'learning';
    return (
      <Pressable
        key={quiz.id}
        onPress={() => router.push(`/(home)/quiz/${quiz.id}`)}
        style={({ pressed }) => [
          s.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Buka kuis ${quiz.title}`}
      >
        <View style={s.cardHeader}>
          <Feather
            name={isLearning ? 'book-open' : 'star'}
            size={14}
            color={isLearning ? '#3B82F6' : '#F59E0B'}
            style={{ marginTop: 2 }}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[s.cardType, { color: colors.mutedForeground }]}>
              {isLearning ? 'Learning Quiz' : 'Proficiency Quiz'}
            </Text>
            <Text style={[s.cardTitle, { color: colors.foreground }]}>{quiz.title}</Text>
            {!!quiz.skkUnitCode && (
              <Text style={[s.cardMeta, { color: colors.mutedForeground }]}>
                Unit: {quiz.skkUnitCode}
                {quiz.skkUnitName ? ` — ${quiz.skkUnitName}` : ''}
              </Text>
            )}
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </View>
        <View style={s.cardFooter}>
          <Text style={[s.cardMeta, { color: colors.mutedForeground }]}>
            Nilai lulus {quiz.passingScore}%
          </Text>
          <StatusBadge status={passStatus(summaryByQuizId.get(quiz.id))} />
        </View>
      </Pressable>
    );
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
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Daftar Kuis</Text>
        <View style={s.backBtn} />
      </View>

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
            {(error as Error)?.message || 'Gagal memuat daftar kuis'}
          </Text>
          <Pressable onPress={() => refetch()}>
            <Text style={[s.linkText, { color: colors.primary }]}>Coba lagi</Text>
          </Pressable>
        </View>
      )}

      {!isLoading && !isError && quizzes && (
        <ScrollView
          contentContainerStyle={s.scroll}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
        >
          {quizzes.length === 0 ? (
            <View style={s.center}>
              <Feather name="inbox" size={40} color={colors.mutedForeground} />
              <Text style={[s.mutedText, { color: colors.mutedForeground, textAlign: 'center' }]}>
                Belum ada kuis yang tersedia saat ini.
              </Text>
            </View>
          ) : (
            <>
              <Text style={[s.mutedText, { color: colors.mutedForeground }]}>
                Kerjakan kuis untuk memvalidasi kompetensimu — hasilnya menjadi bukti saat AI
                membuat Exum.
              </Text>
              {quizzes.map(renderCard)}
            </>
          )}
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
  scroll: { padding: 16, gap: 12, flexGrow: 1 },
  mutedText: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 20 },
  linkText: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', marginTop: 8 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  cardHeader: { flexDirection: 'row', gap: 8 },
  cardType: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold' },
  cardTitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', lineHeight: 20 },
  cardMeta: { fontSize: 11, fontFamily: 'PlusJakartaSans_400Regular' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
