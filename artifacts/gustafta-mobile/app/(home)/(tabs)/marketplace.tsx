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
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetworkState } from '@/hooks/useNetworkState';
import { OfflineBanner } from '@/components/OfflineBanner';
import {
  getWatchedCourses,
  markCourseWatched,
  unmarkCourseWatched,
  getMarketplaceCatalog,
  type MarketplaceCatalogCourse,
} from '@/lib/api';

// ─── Offline catalog cache ────────────────────────────────────────────────────

const CATALOG_CACHE_KEY = 'GUSTAFTA_MARKETPLACE_CATALOG_CACHE';

async function loadCachedCatalog(): Promise<MarketplaceCatalogCourse[]> {
  try {
    const raw = await AsyncStorage.getItem(CATALOG_CACHE_KEY);
    return raw ? (JSON.parse(raw) as MarketplaceCatalogCourse[]) : [];
  } catch {
    return [];
  }
}

async function saveCatalogCache(data: MarketplaceCatalogCourse[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(data));
  } catch {}
}

// ─── Offline watched-courses cache ───────────────────────────────────────────
//
// The key is scoped to the authenticated user so that two accounts sharing a
// device never read each other's watch history from disk.

function watchedCacheKey(userId: string): string {
  return `GUSTAFTA_MARKETPLACE_WATCHED_CACHE_${userId}`;
}

async function loadCachedWatched(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(watchedCacheKey(userId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function saveWatchedCache(userId: string, ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(watchedCacheKey(userId), JSON.stringify(ids));
  } catch {}
}

// Cache for courses that already have a linked Kegiatan PKB ("Dicatat PKB")
function pkbLoggedCacheKey(userId: string): string {
  return `GUSTAFTA_MARKETPLACE_PKB_LOGGED_CACHE_${userId}`;
}

async function loadCachedPkbLogged(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(pkbLoggedCacheKey(userId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function savePkbLoggedCache(userId: string, ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(pkbLoggedCacheKey(userId), JSON.stringify(ids));
  } catch {}
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentType = 'video' | 'webinar' | 'diklatkerja' | 'modul';
type PriceType = 'gratis' | 'berbayar';

interface SkkTag {
  code: string;
  name: string;
}

interface Course {
  id: string;
  title: string;
  provider: string;
  providerLogo: string;
  gradientStart: string;
  gradientEnd: string;
  type: ContentType;
  price: PriceType;
  priceIdr?: number;
  rating: number;
  ratingCount: number;
  durationMinutes: number;
  videoCount: number;
  hasCertificate: boolean;
  jabker: string[];
  skkTags: SkkTag[];
  description: string;
  highlights: string[];
  url: string;
  isBestSeller?: boolean;
  isNew?: boolean;
  isFeatured?: boolean;
}

// ─── Thumbnail → gradient mapping ─────────────────────────────────────────────
// API stores thumbnail as a Tailwind CSS class; map to solid hex for the accent strip.

const THUMBNAIL_TO_HEX: Record<string, [string, string]> = {
  'from-orange-500 to-red-500':    ['#F97316', '#EF4444'],
  'from-blue-500 to-cyan-500':     ['#3B82F6', '#06B6D4'],
  'from-emerald-500 to-teal-500':  ['#10B981', '#14B8A6'],
  'from-violet-500 to-purple-500': ['#8B5CF6', '#A855F7'],
  'from-rose-500 to-pink-500':     ['#F43F5E', '#EC4899'],
  'from-amber-500 to-orange-500':  ['#F59E0B', '#F97316'],
  'from-red-500 to-orange-600':    ['#EF4444', '#EA580C'],
  'from-cyan-500 to-sky-500':      ['#06B6D4', '#0EA5E9'],
  'from-indigo-500 to-blue-600':   ['#6366F1', '#2563EB'],
};

function mapApiCourse(c: MarketplaceCatalogCourse): Course {
  const [gradientStart, gradientEnd] = THUMBNAIL_TO_HEX[c.thumbnail] ?? ['#6366F1', '#2563EB'];
  return {
    id:              c.id,
    title:           c.title,
    provider:        c.provider,
    providerLogo:    c.providerLogo,
    gradientStart,
    gradientEnd,
    type:            c.type as ContentType,
    price:           c.price as PriceType,
    priceIdr:        c.priceIdr ?? undefined,
    rating:          c.rating,
    ratingCount:     c.ratingCount,
    durationMinutes: c.durationMinutes,
    videoCount:      c.videoCount,
    hasCertificate:  c.hasCertificate,
    jabker:          c.jabker,
    skkTags:         c.skkTags,
    description:     c.description,
    highlights:      c.highlights,
    url:             c.url,
    isBestSeller:    c.isBestSeller,
    isNew:           c.isNew,
    isFeatured:      c.isFeatured,
  };
}

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
  const [cachedWatchedIds, setCachedWatchedIds] = useState<string[]>([]);
  const [cachedPkbLoggedIds, setCachedPkbLoggedIds] = useState<string[]>([]);
  const [watchedCacheLoaded, setWatchedCacheLoaded] = useState(false);

  useEffect(() => {
    loadCachedCatalog().then((data) => {
      setCachedCatalog(data);
      setCacheLoaded(true);
    });
    if (userId) {
      loadCachedWatched(userId).then((ids) => {
        setCachedWatchedIds(ids);
        setWatchedCacheLoaded(true);
      });
      loadCachedPkbLogged(userId).then(setCachedPkbLoggedIds);
    } else {
      // No authenticated user — skip disk read, allow query to proceed unfenced
      setWatchedCacheLoaded(true);
    }
  }, [userId]);

  // Fetch catalog from backend; stale time 10 min (catalog changes rarely)
  const {
    data: liveCatalog,
    isLoading: catalogLoading,
    isError: catalogError,
    refetch: refetchCatalog,
  } = useQuery({
    queryKey: ['marketplace-catalog'],
    queryFn: getMarketplaceCatalog,
    staleTime: 10 * 60 * 1000,
    enabled: cacheLoaded,
  });

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

  // Fetch watched status from backend (wait for cache to load first)
  const { data: watchedData, isLoading: watchedLoading, refetch: refetchWatched } = useQuery({
    queryKey: ['marketplace-watched'],
    queryFn: getWatchedCourses,
    staleTime: 1000 * 60,
    enabled: watchedCacheLoaded,
  });

  // Persist successful watched fetches to AsyncStorage
  useEffect(() => {
    if (watchedData?.watchedIds && userId) {
      setCachedWatchedIds(watchedData.watchedIds);
      saveWatchedCache(userId, watchedData.watchedIds);
    }
    if (watchedData?.pkbLoggedIds && userId) {
      setCachedPkbLoggedIds(watchedData.pkbLoggedIds);
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
    mutationFn: async ({ course, isWatched }: { course: Course; isWatched: boolean }) => {
      if (isWatched) {
        await unmarkCourseWatched(course.id);
      } else {
        await markCourseWatched(course.id, {
          courseTitle: course.title,
          provider:    course.provider,
        });
      }
    },
    onMutate: async ({ course, isWatched }) => {
      await queryClient.cancelQueries({ queryKey: ['marketplace-watched'] });
      const prev = queryClient.getQueryData(['marketplace-watched']);
      queryClient.setQueryData(['marketplace-watched'], (old: any) => {
        if (!old) return old;
        const ids: string[] = old.watchedIds ?? [];
        const newIds = isWatched ? ids.filter((id: string) => id !== course.id) : [...ids, course.id];
        return { ...old, watchedIds: newIds };
      });
      return { prev };
    },
    onError: (_err, _vars, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(['marketplace-watched'], ctx.prev);
    },
    onSuccess: (_data, { course, isWatched }) => {
      // Keep AsyncStorage in sync after a successful toggle
      if (userId) {
        setCachedWatchedIds((prev) => {
          const newIds = isWatched
            ? prev.filter((id) => id !== course.id)
            : [...prev, course.id];
          saveWatchedCache(userId, newIds);
          return newIds;
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-watched'] });
    },
  });

  const handleToggleWatch = useCallback(
    (course: Course) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const isWatched = watchedIds.has(course.id);
      toggleWatch.mutate({ course, isWatched });
    },
    [watchedIds, toggleWatch],
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
  const isLoading = catalogLoading || watchedLoading;

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
      {/* Show spinner only when loading with no cached data to display yet */}
      {isLoading && rawCatalog.length === 0 ? (
        <View style={ms.loadingBox}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[ms.loadingText, { color: colors.mutedForeground }]}>
            {catalogLoading ? 'Memuat katalog kursus...' : 'Memuat status...'}
          </Text>
        </View>
      ) : catalogError && rawCatalog.length === 0 ? (
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
