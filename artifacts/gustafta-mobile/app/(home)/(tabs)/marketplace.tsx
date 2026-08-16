/**
 * Marketplace PKB — Mobile Screen
 *
 * Browse, share, and mark PKB modules as watched directly from the mobile app.
 * Catalog data fetched from backend via GET /api/marketplace/courses.
 * Watch-status is synced to the backend per session.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Share,
  Linking,
  RefreshControl,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/expo';
import { useRouter, useFocusEffect } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  loadCachedCatalog,
  saveCatalogCache,
  loadCachedWatched,
  saveWatchedCache,
  loadCachedPkbLogged,
  savePkbLoggedCache,
  currentSignOutEpoch,
} from '@/lib/marketplaceCache';
import { useNetworkState } from '@/hooks/useNetworkState';
import { OfflineBanner } from '@/components/OfflineBanner';
import {
  getWatchedCourses,
  markCourseWatched,
  unmarkCourseWatched,
  getMarketplaceCatalog,
  type MarketplaceCatalogCourse,
} from '@/lib/api';
import { mapApiCourse, type Course, type ContentType } from '@/lib/marketplaceMapping';
import { getMarketplaceListState } from '@/lib/marketplaceLoadingState';

// ─── Offline caches ───────────────────────────────────────────────────────────
//
// Cache read/write helpers live in lib/marketplaceCache.ts so they can be
// unit-tested (cold-start load, toggle persistence, sign-out clearing).
// Watched / PKB-logged keys are scoped per user id so two accounts sharing a
// device never read each other's watch history from disk; the profile screen
// additionally clears them on sign-out via clearUserMarketplaceCaches().

// How long a fetched catalog is considered fresh. Kept short (1 min) so
// courses added/edited/removed by an admin appear quickly on mobile.
const CATALOG_STALE_MS = 60 * 1000;

// Course model and API→Course mapping live in lib/marketplaceMapping.ts so
// they can be unit-tested without pulling in React Native modules.

// ─── Constants ─────────────────────────────────────────────────────────────────

const JABKER_LABELS: Record<string, string> = {
  ahli_k3_konstruksi: 'Ahli K3',
  pengawas_k3_konstruksi: 'Pengawas K3',
  quantity_surveyor: 'Quantity Surveyor',
  pengawas_lapangan: 'Pengawas Lapangan',
  ahli_struktur: 'Ahli Struktur',
  ahli_mekanikal_elektrikal: 'Ahli MEP',
  ahli_plumbing: 'Ahli Plumbing',
  manajer_proyek: 'Manajer Proyek',
};

const TYPE_LABELS: Record<ContentType, string> = {
  video: 'Video',
  webinar: 'Webinar',
  diklatkerja: 'Diklatkerja',
  modul: 'Modul',
};

const TYPE_ICON: Record<ContentType, string> = {
  video: 'play-circle',
  webinar: 'monitor',
  diklatkerja: 'book-open',
  modul: 'file-text',
};

// Icons for curriculum item types. Falls back to 'file-text' for unknown types.
const CURRICULUM_ICON: Record<string, string> = {
  video: 'play-circle',
  quiz: 'help-circle',
  reading: 'book-open',
  praktik: 'tool',
  webinar: 'monitor',
  modul: 'file-text',
  dokumen: 'file-text',
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} mnt`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} j ${m} mnt` : `${h} jam`;
}

function formatPrice(idr: number): string {
  return `Rp ${idr.toLocaleString('id-ID')}`;
}

// ─── Course detail modal ───────────────────────────────────────────────────────

function CourseDetailModal({
  course,
  watched,
  pkbLogged,
  onClose,
  onToggleWatch,
  onShare,
  onOpen,
  onCatatPkb,
}: {
  course: Course;
  watched: boolean;
  pkbLogged: boolean;
  onClose: () => void;
  onToggleWatch: () => void;
  onShare: () => void;
  onOpen: () => void;
  onCatatPkb: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[dm.root, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
        {/* Header strip */}
        <View style={[dm.headerStrip, { backgroundColor: course.gradientStart }]}>
          <Pressable style={dm.closeBtn} onPress={onClose} hitSlop={12}>
            <Feather name="x" size={20} color="#fff" />
          </Pressable>
          <Text style={dm.providerEmoji}>{course.providerLogo}</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={dm.scrollContent}>
          {/* Badges row */}
          <View style={dm.badgeRow}>
            <View style={[dm.badge, { backgroundColor: colors.muted }]}>
              <Feather name={TYPE_ICON[course.type] as any} size={11} color={colors.mutedForeground} />
              <Text style={[dm.badgeText, { color: colors.mutedForeground }]}>{TYPE_LABELS[course.type]}</Text>
            </View>
            <View style={[dm.badge, { backgroundColor: course.price === 'gratis' ? '#D1FAE5' : '#FEF9C3' }]}>
              <Text style={[dm.badgeText, { color: course.price === 'gratis' ? '#065F46' : '#78350F' }]}>
                {course.price === 'gratis' ? 'Gratis' : formatPrice(course.priceIdr ?? 0)}
              </Text>
            </View>
            {course.isBestSeller && (
              <View style={[dm.badge, { backgroundColor: '#FEF08A' }]}>
                <Text style={[dm.badgeText, { color: '#713F12' }]}>🏆 Best Seller</Text>
              </View>
            )}
            {course.isNew && (
              <View style={[dm.badge, { backgroundColor: '#D1FAE5' }]}>
                <Text style={[dm.badgeText, { color: '#065F46' }]}>✨ Baru</Text>
              </View>
            )}
            {pkbLogged && (
              <View style={[dm.badge, { backgroundColor: '#DBEAFE' }]}>
                <Text style={[dm.badgeText, { color: '#1E40AF' }]}>📋 Dicatat PKB</Text>
              </View>
            )}
          </View>

          <Text style={[dm.title, { color: colors.foreground }]}>{course.title}</Text>
          <Text style={[dm.provider, { color: colors.mutedForeground }]}>{course.provider}</Text>

          {/* Stats row */}
          <View style={dm.statsRow}>
            <Feather name="star" size={13} color="#F59E0B" />
            <Text style={[dm.stat, { color: colors.mutedForeground }]}>
              {course.rating.toFixed(1)} ({course.ratingCount.toLocaleString()})
            </Text>
            <Text style={[dm.statDot, { color: colors.border }]}>·</Text>
            <Text style={[dm.stat, { color: colors.mutedForeground }]}>{formatDuration(course.durationMinutes)}</Text>
            <Text style={[dm.statDot, { color: colors.border }]}>·</Text>
            <Text style={[dm.stat, { color: colors.mutedForeground }]}>{course.videoCount} video</Text>
            {course.hasCertificate && (
              <>
                <Text style={[dm.statDot, { color: colors.border }]}>·</Text>
                <Feather name="award" size={12} color="#10B981" />
                <Text style={[dm.stat, { color: '#10B981' }]}>Sertifikat</Text>
              </>
            )}
          </View>

          {/* Action buttons */}
          <View style={dm.actions}>
            <Pressable
              style={[dm.actionBtn, { backgroundColor: colors.primary }]}
              onPress={onOpen}
            >
              <Feather name="play" size={15} color="#fff" />
              <Text style={dm.actionBtnText}>Buka Kursus</Text>
            </Pressable>
            <Pressable
              style={[dm.actionBtn, { backgroundColor: '#059669' }]}
              onPress={onCatatPkb}
            >
              <Feather name="check-circle" size={15} color="#fff" />
              <Text style={dm.actionBtnText}>Catat PKB</Text>
            </Pressable>
          </View>

          <Pressable
            style={[dm.watchToggle, {
              backgroundColor: watched ? '#D1FAE5' : colors.muted,
              borderColor: watched ? '#6EE7B7' : colors.border,
            }]}
            onPress={onToggleWatch}
          >
            <Feather
              name={watched ? 'check-circle' : 'circle'}
              size={16}
              color={watched ? '#065F46' : colors.mutedForeground}
            />
            <Text style={[dm.watchToggleText, { color: watched ? '#065F46' : colors.mutedForeground }]}>
              {watched ? '✓ Sudah Ditonton — Ketuk untuk hapus' : 'Tandai Sudah Ditonton'}
            </Text>
          </Pressable>

          {/* Share */}
          <Pressable style={[dm.shareBtn, { borderColor: colors.border }]} onPress={onShare}>
            <Feather name="share-2" size={14} color={colors.mutedForeground} />
            <Text style={[dm.shareBtnText, { color: colors.mutedForeground }]}>Bagikan Modul Ini</Text>
          </Pressable>

          {/* Description */}
          <Text style={[dm.sectionTitle, { color: colors.foreground }]}>Deskripsi</Text>
          <Text style={[dm.description, { color: colors.mutedForeground }]}>{course.description}</Text>

          {/* Highlights */}
          <Text style={[dm.sectionTitle, { color: colors.foreground }]}>Yang Anda Dapatkan</Text>
          {course.highlights.map((h, i) => (
            <View key={i} style={dm.highlightRow}>
              <Feather name="check-circle" size={14} color="#10B981" style={{ marginTop: 2 }} />
              <Text style={[dm.highlightText, { color: colors.mutedForeground }]}>{h}</Text>
            </View>
          ))}

          {/* Curriculum */}
          {course.curriculum.length > 0 && (
            <>
              <Text style={[dm.sectionTitle, { color: colors.foreground }]}>Kurikulum</Text>
              {course.curriculum.map((item, i) => (
                <View
                  key={i}
                  style={[dm.curriculumRow, { backgroundColor: colors.muted, borderColor: colors.border }]}
                >
                  <Feather
                    name={(CURRICULUM_ICON[item.type] ?? 'file-text') as any}
                    size={15}
                    color={colors.primary}
                  />
                  <Text style={[dm.curriculumTitle, { color: colors.foreground }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={[dm.curriculumDuration, { color: colors.mutedForeground }]}>
                    {item.duration}
                  </Text>
                </View>
              ))}
            </>
          )}

          {/* AI platform reviews */}
          {course.aiReviews.length > 0 && (
            <>
              <Text style={[dm.sectionTitle, { color: colors.foreground }]}>Ulasan AI Platform</Text>
              {course.aiReviews.map((r, i) => (
                <View
                  key={`${r.platform}-${i}`}
                  style={[dm.reviewCard, { backgroundColor: colors.muted, borderColor: colors.border }]}
                >
                  <View style={dm.reviewHeader}>
                    <Text style={[dm.reviewPlatform, { color: colors.foreground }]}>
                      {r.platformIcon ? `${r.platformIcon} ` : ''}{r.platform}
                    </Text>
                    <View style={dm.reviewMeta}>
                      <Feather name="star" size={12} color="#F59E0B" />
                      <Text style={[dm.reviewMetaText, { color: colors.mutedForeground }]}>
                        {r.rating.toFixed(1)}
                      </Text>
                      <Text style={[dm.statDot, { color: colors.border }]}>·</Text>
                      <Text style={[dm.reviewMetaText, { color: colors.mutedForeground }]}>
                        Relevansi {r.relevanceScore}%
                      </Text>
                    </View>
                  </View>
                  <Text style={[dm.reviewComment, { color: colors.mutedForeground }]}>{r.comment}</Text>
                </View>
              ))}
            </>
          )}

          {/* ASKOM expert review */}
          {course.askomReview && (
            <>
              <Text style={[dm.sectionTitle, { color: colors.foreground }]}>Ulasan Ahli ASKOM</Text>
              <View style={[dm.reviewCard, { backgroundColor: '#ECFDF5', borderColor: '#6EE7B7' }]}>
                <View style={dm.reviewHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[dm.reviewPlatform, { color: '#065F46' }]}>
                      {course.askomReview.reviewerName}
                    </Text>
                    <Text style={[dm.reviewCredential, { color: '#047857' }]}>
                      {course.askomReview.credential} · {course.askomReview.institution}
                    </Text>
                  </View>
                </View>
                <View style={[dm.recommendationPill, { backgroundColor: '#D1FAE5' }]}>
                  <Feather name="thumbs-up" size={12} color="#065F46" />
                  <Text style={dm.recommendationText}>{course.askomReview.recommendation}</Text>
                </View>
                <Text style={[dm.reviewComment, { color: '#065F46' }]}>{course.askomReview.comment}</Text>
                {course.askomReview.strengths.length > 0 && (
                  <View style={dm.strengthsBlock}>
                    <Text style={[dm.strengthsTitle, { color: '#065F46' }]}>Keunggulan</Text>
                    {course.askomReview.strengths.map((s, i) => (
                      <View key={i} style={dm.highlightRow}>
                        <Feather name="check" size={13} color="#059669" style={{ marginTop: 2 }} />
                        <Text style={[dm.highlightText, { color: '#047857' }]}>{s}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </>
          )}

          {/* SKK Tags */}
          <Text style={[dm.sectionTitle, { color: colors.foreground }]}>Unit SKK yang Didukung</Text>
          {course.skkTags.map((t) => (
            <View key={t.code} style={[dm.skkRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Text style={[dm.skkCode, { color: colors.primary }]}>{t.code}</Text>
              <Text style={[dm.skkName, { color: colors.foreground }]}>{t.name}</Text>
            </View>
          ))}

          {/* Jabker */}
          <Text style={[dm.sectionTitle, { color: colors.foreground }]}>Relevan untuk Jabker</Text>
          <View style={dm.jabkerRow}>
            {course.jabker.map((j) => (
              <View key={j} style={[dm.jabkerPill, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Text style={[dm.jabkerPillText, { color: colors.foreground }]}>{JABKER_LABELS[j] ?? j}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const dm = StyleSheet.create({
  root: { flex: 1 },
  headerStrip: {
    height: 120,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  closeBtn: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerEmoji: { fontSize: 48 },
  scrollContent: { padding: 20, gap: 0 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold' },
  title: { fontSize: 20, fontFamily: 'PlusJakartaSans_700Bold', lineHeight: 28, marginBottom: 4 },
  provider: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 10 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 20, flexWrap: 'wrap' },
  stat: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular' },
  statDot: { fontSize: 12, marginHorizontal: 1 },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionBtnText: { color: '#fff', fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
  watchToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  watchToggleText: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', flex: 1 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  shareBtnText: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' },
  sectionTitle: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 8, marginTop: 4 },
  description: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 20, marginBottom: 16 },
  highlightRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  curriculumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  curriculumTitle: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', flex: 1 },
  curriculumDuration: { fontSize: 11, fontFamily: 'PlusJakartaSans_400Regular', fontVariant: ['tabular-nums'] },
  highlightText: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', flex: 1, lineHeight: 20 },
  skkRow: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 6,
  },
  skkCode: { fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', fontVariant: ['tabular-nums'], marginBottom: 2 },
  skkName: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular' },
  jabkerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  jabkerPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  jabkerPillText: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium' },
  reviewCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  reviewPlatform: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold' },
  reviewCredential: { fontSize: 11, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 },
  reviewMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reviewMetaText: { fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium' },
  reviewComment: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 18 },
  recommendationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 6,
  },
  recommendationText: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#065F46' },
  strengthsBlock: { marginTop: 8 },
  strengthsTitle: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 6 },
});

// ─── Course card ──────────────────────────────────────────────────────────────

function CourseCard({
  course,
  watched,
  pkbLogged,
  onPress,
  onToggleWatch,
  onShare,
}: {
  course: Course;
  watched: boolean;
  pkbLogged: boolean;
  onPress: () => void;
  onToggleWatch: () => void;
  onShare: () => void;
}) {
  const colors = useColors();

  return (
    <Pressable
      style={[cc.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
    >
      {/* Color accent strip */}
      <View style={[cc.accent, { backgroundColor: course.gradientStart }]}>
        <Text style={cc.accentEmoji}>{course.providerLogo}</Text>
        <View style={cc.accentBadges}>
          {course.isBestSeller && (
            <View style={cc.accentBadge}>
              <Text style={cc.accentBadgeText}>🏆</Text>
            </View>
          )}
          {course.isNew && (
            <View style={cc.accentBadge}>
              <Text style={cc.accentBadgeText}>✨ Baru</Text>
            </View>
          )}
          {watched && (
            <View style={[cc.accentBadge, { backgroundColor: 'rgba(16,185,129,0.85)' }]}>
              <Text style={cc.accentBadgeText}>✓ Ditonton</Text>
            </View>
          )}
          {pkbLogged && (
            <View style={[cc.accentBadge, { backgroundColor: 'rgba(59,130,246,0.85)' }]}>
              <Text style={cc.accentBadgeText}>📋 Dicatat PKB</Text>
            </View>
          )}
        </View>
      </View>

      <View style={cc.body}>
        {/* Type + price row */}
        <View style={cc.metaRow}>
          <View style={[cc.typeTag, { backgroundColor: colors.muted }]}>
            <Feather name={TYPE_ICON[course.type] as any} size={10} color={colors.mutedForeground} />
            <Text style={[cc.typeTagText, { color: colors.mutedForeground }]}>{TYPE_LABELS[course.type]}</Text>
          </View>
          <Text
            style={[
              cc.price,
              { color: course.price === 'gratis' ? '#10B981' : colors.foreground },
            ]}
          >
            {course.price === 'gratis' ? 'Gratis' : formatPrice(course.priceIdr ?? 0)}
          </Text>
        </View>

        <Text style={[cc.title, { color: colors.foreground }]} numberOfLines={2}>
          {course.title}
        </Text>
        <Text style={[cc.provider, { color: colors.mutedForeground }]} numberOfLines={1}>
          {course.provider}
        </Text>

        {/* Stats row */}
        <View style={cc.statsRow}>
          <Feather name="star" size={12} color="#F59E0B" />
          <Text style={[cc.stat, { color: colors.mutedForeground }]}>
            {course.rating.toFixed(1)} ({course.ratingCount.toLocaleString()})
          </Text>
          <Text style={[cc.statDot, { color: colors.border }]}>·</Text>
          <Text style={[cc.stat, { color: colors.mutedForeground }]}>
            {formatDuration(course.durationMinutes)}
          </Text>
          {course.hasCertificate && (
            <>
              <Text style={[cc.statDot, { color: colors.border }]}>·</Text>
              <Feather name="award" size={11} color="#10B981" />
              <Text style={[cc.stat, { color: '#10B981' }]}>Sertifikat</Text>
            </>
          )}
        </View>

        {/* Jabker pills — show first 2 */}
        <View style={cc.jabkerRow}>
          {course.jabker.slice(0, 2).map((j) => (
            <View key={j} style={[cc.jabkerPill, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Text style={[cc.jabkerPillText, { color: colors.secondaryForeground }]}>
                {JABKER_LABELS[j] ?? j}
              </Text>
            </View>
          ))}
          {course.jabker.length > 2 && (
            <Text style={[cc.jabkerMore, { color: colors.mutedForeground }]}>
              +{course.jabker.length - 2}
            </Text>
          )}
        </View>

        {/* Action row */}
        <View style={[cc.actionRow, { borderTopColor: colors.border }]}>
          <Pressable
            style={cc.actionBtn}
            onPress={(e) => { e.stopPropagation?.(); onShare(); }}
            hitSlop={12}
          >
            <Feather name="share-2" size={15} color={colors.mutedForeground} />
            <Text style={[cc.actionText, { color: colors.mutedForeground }]}>Share</Text>
          </Pressable>
          <Pressable
            style={cc.actionBtn}
            onPress={(e) => { e.stopPropagation?.(); onToggleWatch(); }}
            hitSlop={12}
          >
            <Feather
              name={watched ? 'check-circle' : 'circle'}
              size={15}
              color={watched ? '#10B981' : colors.mutedForeground}
            />
            <Text style={[cc.actionText, { color: watched ? '#10B981' : colors.mutedForeground }]}>
              {watched ? 'Ditonton' : 'Tandai Ditonton'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const cc = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  accent: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  accentEmoji: { fontSize: 28 },
  accentBadges: { flexDirection: 'row', gap: 4 },
  accentBadge: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  accentBadgeText: { fontSize: 11, color: '#fff', fontFamily: 'PlusJakartaSans_600SemiBold' },
  body: { padding: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  typeTagText: { fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium' },
  price: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold' },
  title: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', lineHeight: 22, marginBottom: 3 },
  provider: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 8 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  stat: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular' },
  statDot: { fontSize: 12, marginHorizontal: 1 },
  jabkerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  jabkerPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  jabkerPillText: { fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium' },
  jabkerMore: { fontSize: 11, fontFamily: 'PlusJakartaSans_400Regular', alignSelf: 'center' },
  actionRow: {
    flexDirection: 'row',
    gap: 0,
    paddingTop: 10,
    borderTopWidth: 1,
    justifyContent: 'space-between',
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function MarketplaceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { isOnline } = useNetworkState();
  const { userId } = useAuth();

  const [search, setSearch] = useState('');
  const [filterJabker, setFilterJabker] = useState('');
  const [filterPrice, setFilterPrice] = useState<'' | 'gratis' | 'berbayar'>('');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  // ── Offline catalog cache ──────────────────────────────────────────────────
  const [cachedCatalog, setCachedCatalog] = useState<MarketplaceCatalogCourse[]>([]);
  const [cacheLoaded, setCacheLoaded] = useState(false);

  // ── Offline watched-courses cache ─────────────────────────────────────────
  //
  // Local watched/PKB state is tagged with the user id that owns it. Rendering
  // derives from it ONLY when the owner matches the currently signed-in user,
  // so an identity switch can never flash or leak another account's history —
  // not even for the single render before effects run.
  type OwnedIds = { owner: string | null; ids: string[] };
  const NO_IDS: OwnedIds = { owner: null, ids: [] };
  const [cachedWatched, setCachedWatched] = useState<OwnedIds>(NO_IDS);
  const [cachedPkbLogged, setCachedPkbLogged] = useState<OwnedIds>(NO_IDS);
  const [watchedCacheLoaded, setWatchedCacheLoaded] = useState(false);

  const cachedWatchedIds = cachedWatched.owner === userId ? cachedWatched.ids : [];
  const cachedPkbLoggedIds = cachedPkbLogged.owner === userId ? cachedPkbLogged.ids : [];

  useEffect(() => {
    loadCachedCatalog().then((data) => {
      setCachedCatalog(data);
      setCacheLoaded(true);
    });
    // Reset in-memory watched state whenever the signed-in user changes so a
    // prior account's data never renders transiently on a shared device.
    setCachedWatched(NO_IDS);
    setCachedPkbLogged(NO_IDS);
    setWatchedCacheLoaded(false);
    // Guard against a stale async disk read: if the signed-in user changes
    // while a previous user's read is still in flight, that read must never
    // write into the new user's state.
    let cancelled = false;
    if (userId) {
      loadCachedWatched(userId).then((ids) => {
        if (cancelled) return;
        setCachedWatched({ owner: userId, ids });
        setWatchedCacheLoaded(true);
      });
      loadCachedPkbLogged(userId).then((ids) => {
        if (!cancelled) setCachedPkbLogged({ owner: userId, ids });
      });
    } else {
      // No authenticated user — skip disk read, allow query to proceed unfenced
      setWatchedCacheLoaded(true);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Fetch catalog from backend; short stale time so admin-added courses
  // show up quickly when the user opens the marketplace tab.
  const {
    data: liveCatalog,
    isLoading: catalogLoading,
    isError: catalogError,
    refetch: refetchCatalog,
  } = useQuery({
    queryKey: ['marketplace-catalog'],
    queryFn: getMarketplaceCatalog,
    staleTime: CATALOG_STALE_MS,
    enabled: cacheLoaded,
  });

  // Refetch the catalog whenever the marketplace screen gains focus and the
  // cached data is older than CATALOG_STALE_MS, so courses added/edited/removed
  // by an admin appear without requiring a manual pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      const state = queryClient.getQueryState(['marketplace-catalog']);
      if (!state?.dataUpdatedAt || Date.now() - state.dataUpdatedAt > CATALOG_STALE_MS) {
        refetchCatalog();
      }
    }, [queryClient, refetchCatalog]),
  );

  // Persist successful fetches to AsyncStorage
  useEffect(() => {
    if (liveCatalog && liveCatalog.length > 0) {
      setCachedCatalog(liveCatalog);
      saveCatalogCache(liveCatalog);
    }
  }, [liveCatalog]);

  // Use live data when available; fall back to cache when offline
  const rawCatalog = liveCatalog ?? cachedCatalog;
  const showingCachedCatalog = !liveCatalog && cachedCatalog.length > 0;

  // Map API shape to mobile Course shape (compute gradient colors from thumbnail class)
  const courses = useMemo(() => rawCatalog.map(mapApiCourse), [rawCatalog]);

  // Derive jabker list from fetched catalog
  const allJabker = useMemo(
    () => Array.from(new Set(courses.flatMap((c) => c.jabker))),
    [courses],
  );

  // Fetch watched status from backend (wait for cache to load first).
  // The key is scoped per user id so the in-memory React Query cache can
  // never serve one account's watch history to another account that signs
  // in within the stale window on the same device.
  const { data: watchedData, isLoading: watchedLoading, refetch: refetchWatched } = useQuery({
    queryKey: ['marketplace-watched', userId],
    queryFn: getWatchedCourses,
    staleTime: 1000 * 60,
    enabled: watchedCacheLoaded && !!userId,
  });

  // Persist successful watched fetches to AsyncStorage
  useEffect(() => {
    if (watchedData?.watchedIds && userId) {
      setCachedWatched({ owner: userId, ids: watchedData.watchedIds });
      saveWatchedCache(userId, watchedData.watchedIds);
    }
    if (watchedData?.pkbLoggedIds && userId) {
      setCachedPkbLogged({ owner: userId, ids: watchedData.pkbLoggedIds });
      savePkbLoggedCache(userId, watchedData.pkbLoggedIds);
    }
  }, [watchedData, userId]);

  // Use live data when available; fall back to cached list when offline
  const watchedIds = useMemo(
    () => new Set(watchedData?.watchedIds ?? cachedWatchedIds),
    [watchedData, cachedWatchedIds],
  );

  // Map courseId → watchedAt ISO timestamp (only available from live data)
  const watchedAtByCourse = useMemo(() => {
    const map = new Map<string, string>();
    for (const rec of watchedData?.watched ?? []) {
      if (rec.watchedAt) map.set(rec.courseId, rec.watchedAt);
    }
    return map;
  }, [watchedData]);

  // Courses with a linked Kegiatan PKB record ("Dicatat PKB")
  const pkbLoggedIds = useMemo(
    () => new Set(watchedData?.pkbLoggedIds ?? cachedPkbLoggedIds),
    [watchedData, cachedPkbLoggedIds],
  );

  const toggleWatch = useMutation({
    mutationFn: async ({ course, isWatched }: { course: Course; isWatched: boolean; ownerId: string | null; epoch: number }) => {
      if (isWatched) {
        await unmarkCourseWatched(course.id);
      } else {
        await markCourseWatched(course.id, {
          courseTitle: course.title,
          provider:    course.provider,
        });
      }
    },
    onMutate: async ({ course, isWatched, ownerId }) => {
      await queryClient.cancelQueries({ queryKey: ['marketplace-watched', ownerId] });
      const prev = queryClient.getQueryData(['marketplace-watched', ownerId]);
      queryClient.setQueryData(['marketplace-watched', ownerId], (old: any) => {
        if (!old) return old;
        const ids: string[] = old.watchedIds ?? [];
        const newIds = isWatched ? ids.filter((id: string) => id !== course.id) : [...ids, course.id];
        return { ...old, watchedIds: newIds };
      });
      return { prev };
    },
    onError: (_err, { ownerId }, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(['marketplace-watched', ownerId], ctx.prev);
    },
    onSuccess: async (_data, { course, isWatched, ownerId, epoch }) => {
      // Keep AsyncStorage in sync after a successful toggle. All writes are
      // keyed to the user who INITIATED the toggle (ownerId), not whoever is
      // signed in when the request settles — if the identity switched while
      // the request was in flight, the disk cache for the initiating user is
      // still updated, but in-memory state is only touched when it still
      // belongs to that same user (owner-tag check inside the updater).
      if (!ownerId) return;
      // Sign-out fence: if the user signed out after starting this toggle,
      // sign-out already wiped their disk cache — persisting now would
      // silently recreate the watch history that was just cleared.
      if (epoch !== currentSignOutEpoch()) return;
      const ids = await loadCachedWatched(ownerId);
      const newIds = isWatched
        ? ids.filter((id) => id !== course.id)
        : Array.from(new Set([...ids, course.id]));
      // Re-check after the async read: sign-out may have happened meanwhile.
      if (epoch !== currentSignOutEpoch()) return;
      await saveWatchedCache(ownerId, newIds);
      setCachedWatched((prev) =>
        prev.owner === ownerId ? { owner: ownerId, ids: newIds } : prev,
      );
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-watched', vars.ownerId] });
    },
  });

  const handleToggleWatch = useCallback(
    (course: Course) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const isWatched = watchedIds.has(course.id);
      toggleWatch.mutate({
        course,
        isWatched,
        ownerId: userId ?? null,
        epoch: currentSignOutEpoch(),
      });
    },
    [watchedIds, toggleWatch, userId],
  );

  const handleShare = useCallback(async (course: Course) => {
    const jabkerStr = course.jabker.map((j) => JABKER_LABELS[j] ?? j).join(', ');
    const message = [
      `📚 *${course.title}*`,
      `🏫 ${course.provider}`,
      `👷 Relevan untuk: ${jabkerStr}`,
      `⏱️ Durasi: ${formatDuration(course.durationMinutes)}`,
      course.price === 'gratis' ? '✅ Gratis' : `💰 ${formatPrice(course.priceIdr ?? 0)}`,
      '',
      `🔗 ${course.url}`,
      '',
      'Bagikan melalui Gustafta — aplikasi PKB untuk TKK Indonesia 🇮🇩',
    ].join('\n');

    try {
      await Share.share({ message, url: course.url });
    } catch {
      // User cancelled or share failed — ignore
    }
  }, []);

  // Filter courses based on search, jabker, price
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return courses.filter((c) => {
      if (filterJabker && !c.jabker.includes(filterJabker)) return false;
      if (filterPrice && c.price !== filterPrice) return false;
      if (q && !c.title.toLowerCase().includes(q) && !c.provider.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [courses, search, filterJabker, filterPrice]);

  const watchedCount = courses.filter((c) => watchedIds.has(c.id)).length;
  // Decide what the list area renders. Spinner appears only on a true first
  // load (cache read finished empty + initial fetch in flight); the brief
  // AsyncStorage read window renders a neutral blank so remounting with a
  // persisted cache never flashes a spinner; background re-fetches
  // (stale-while-revalidate on tab focus) never interrupt the list —
  // consistent with the Studio tab.
  const listState = getMarketplaceListState({
    cacheLoaded,
    catalogCount: rawCatalog.length,
    catalogLoading,
    watchedLoading,
    catalogError,
  });

  return (
    <View style={[ms.root, { backgroundColor: colors.background }]}>
      {/* Offline banner */}
      {!isOnline && <OfflineBanner />}

      {/* Stale-cache notice */}
      {showingCachedCatalog && (
        <View style={[ms.cacheBanner, { backgroundColor: '#FFF7ED', borderBottomColor: '#FED7AA' }]}>
          <Feather name="clock" size={12} color="#C2410C" />
          <Text style={[ms.cacheBannerText, { color: '#C2410C' }]}>
            Menampilkan katalog tersimpan — sambungkan internet untuk memperbarui
          </Text>
        </View>
      )}

      {/* Header */}
      <View style={[ms.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <View style={ms.headerTop}>
          <View>
            <Text style={[ms.headerTitle, { color: colors.foreground }]}>Marketplace PKB</Text>
            <Text style={[ms.headerSub, { color: colors.mutedForeground }]}>
              {watchedCount > 0
                ? `${watchedCount} modul sudah ditonton`
                : 'Kursus & webinar untuk TKK'}
            </Text>
          </View>
          <View style={[ms.watchedBadge, { backgroundColor: colors.muted }]}>
            <Feather name="check-circle" size={14} color={watchedCount > 0 ? '#10B981' : colors.mutedForeground} />
            <Text style={[ms.watchedBadgeText, { color: watchedCount > 0 ? '#10B981' : colors.mutedForeground }]}>
              {watchedCount}/{courses.length}
            </Text>
          </View>
        </View>

        {/* Search */}
        <View style={[ms.searchBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            style={[ms.searchInput, { color: colors.foreground }]}
            placeholder="Cari kursus..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Feather name="x" size={15} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={ms.filterScroll}
        style={[ms.filterBar, { borderBottomColor: colors.border }]}
      >
        {/* Jabker: All */}
        <Pressable
          style={[ms.filterPill, filterJabker === '' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
          onPress={() => setFilterJabker('')}
        >
          <Text style={[ms.filterPillText, filterJabker === '' && { color: '#fff' }]}>
            Semua Jabker
          </Text>
        </Pressable>
        {allJabker.map((j) => (
          <Pressable
            key={j}
            style={[
              ms.filterPill,
              { borderColor: colors.border },
              filterJabker === j && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setFilterJabker(filterJabker === j ? '' : j)}
          >
            <Text
              style={[
                ms.filterPillText,
                { color: filterJabker === j ? '#fff' : colors.foreground },
              ]}
            >
              {JABKER_LABELS[j] ?? j}
            </Text>
          </Pressable>
        ))}
        <View style={ms.filterDivider} />
        {/* Price filters */}
        {(['', 'gratis', 'berbayar'] as const).map((p) => (
          <Pressable
            key={p || 'all-price'}
            style={[
              ms.filterPill,
              { borderColor: colors.border },
              filterPrice === p && { backgroundColor: colors.accent, borderColor: colors.accent },
            ]}
            onPress={() => setFilterPrice(p)}
          >
            <Text
              style={[
                ms.filterPillText,
                { color: filterPrice === p ? '#fff' : colors.foreground },
              ]}
            >
              {p === '' ? 'Semua Harga' : p === 'gratis' ? 'Gratis' : 'Berbayar'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* List */}
      {listState === 'awaiting-cache' ? (
        /* Disk cache still being read — neutral blank, no spinner flash */
        <View style={ms.loadingBox} />
      ) : listState === 'loading' ? (
        /* True first load: cache read finished empty, initial fetch in flight */
        <View style={ms.loadingBox}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[ms.loadingText, { color: colors.mutedForeground }]}>
            {catalogLoading ? 'Memuat katalog kursus...' : 'Memuat status...'}
          </Text>
        </View>
      ) : listState === 'error' ? (
        /* Show error only when there is no cached data to fall back to */
        <View style={ms.loadingBox}>
          <Feather name="wifi-off" size={32} color={colors.mutedForeground} />
          <Text style={[ms.loadingText, { color: colors.mutedForeground }]}>
            Gagal memuat katalog
          </Text>
          <Pressable onPress={() => refetchCatalog()} style={{ marginTop: 8 }}>
            <Text style={{ color: colors.primary, fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
              Coba lagi
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <CourseCard
              course={item}
              watched={watchedIds.has(item.id)}
              pkbLogged={pkbLoggedIds.has(item.id)}
              onPress={() => setSelectedCourse(item)}
              onToggleWatch={() => handleToggleWatch(item)}
              onShare={() => handleShare(item)}
            />
          )}
          contentContainerStyle={ms.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => { refetchCatalog(); refetchWatched(); }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={ms.emptyBox}>
              <Text style={ms.emptyEmoji}>🔍</Text>
              <Text style={[ms.emptyTitle, { color: colors.foreground }]}>Tidak ada kursus</Text>
              <Text style={[ms.emptyText, { color: colors.mutedForeground }]}>
                Coba ganti filter atau kata kunci pencarian.
              </Text>
            </View>
          }
        />
      )}

      {/* Detail modal */}
      {selectedCourse && (
        <CourseDetailModal
          course={selectedCourse}
          watched={watchedIds.has(selectedCourse.id)}
          pkbLogged={pkbLoggedIds.has(selectedCourse.id)}
          onClose={() => setSelectedCourse(null)}
          onToggleWatch={() => handleToggleWatch(selectedCourse)}
          onShare={() => handleShare(selectedCourse)}
          onOpen={() => Linking.openURL(selectedCourse.url).catch(() => {})}
          onCatatPkb={() => {
            const c = selectedCourse;
            setSelectedCourse(null);
            router.push({
              pathname: '/kegiatan',
              params: {
                marketplaceId:    c.id,
                courseTitle:      c.title,
                courseProvider:   c.provider,
                courseJabkerList: JSON.stringify(c.jabker),
                courseSkkTagsList: JSON.stringify(c.skkTags.map((t) => t.code)),
                courseWatchedAt:   watchedAtByCourse.get(c.id) ?? '',
              },
            } as any);
          }}
        />
      )}
    </View>
  );
}

const ms = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 22, fontFamily: 'PlusJakartaSans_700Bold' },
  headerSub: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 },
  watchedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  watchedBadgeText: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    padding: 0,
  },
  filterBar: { borderBottomWidth: 1, flexGrow: 0 },
  filterScroll: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D8DCE8',
  },
  filterPillText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold' },
  filterDivider: { width: 1, backgroundColor: '#D8DCE8', marginHorizontal: 4 },
  listContent: { paddingTop: 12, paddingBottom: 100 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular' },
  emptyBox: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 6 },
  emptyText: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center' },
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
