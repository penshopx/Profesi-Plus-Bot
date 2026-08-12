/**
 * Marketplace PKB — Mobile Screen
 *
 * Browse, share, and mark PKB modules as watched directly from the mobile app.
 * Data mirrors the web marketplace catalog; watch-status is synced to the backend.
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
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  getWatchedCourses,
  markCourseWatched,
  unmarkCourseWatched,
} from '@/lib/api';

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

// ─── Catalog ──────────────────────────────────────────────────────────────────

const COURSES: Course[] = [
  {
    id: 'k3-dasar-pupr',
    title: 'K3 Konstruksi Dasar — Standar PUPR & BNSP',
    provider: 'Kemnaker Diklatkerja',
    providerLogo: '🏛️',
    gradientStart: '#F97316',
    gradientEnd: '#EF4444',
    type: 'diklatkerja',
    price: 'gratis',
    rating: 4.8,
    ratingCount: 1240,
    durationMinutes: 480,
    videoCount: 28,
    hasCertificate: true,
    jabker: ['ahli_k3_konstruksi', 'pengawas_k3_konstruksi'],
    skkTags: [
      { code: 'F.45.2.0.0.0.0.0.01', name: 'Menerapkan SMK3 pada Proyek Konstruksi' },
      { code: 'F.45.2.0.0.0.0.0.02', name: 'Melaksanakan Inspeksi K3 di Lapangan' },
    ],
    description:
      'Rekaman diklatkerja resmi Kemnaker membahas penerapan Sistem Manajemen K3 (SMK3) pada proyek konstruksi, prosedur inspeksi lapangan, penanganan insiden, dan dokumentasi K3 sesuai standar PUPR.',
    highlights: [
      'Modul SMK3 berbasis ISO 45001 & PP 50/2012',
      'Studi kasus insiden konstruksi nyata',
      'Formulir inspeksi K3 siap pakai',
      'Relevan untuk ujian SKK Jenjang 6–8',
    ],
    url: 'https://www.diklatkerja.kemnaker.go.id',
    isBestSeller: true,
    isFeatured: true,
  },
  {
    id: 'qs-bop-perhitungan',
    title: 'Perhitungan BOP & RAB Konstruksi Gedung',
    provider: 'Skill Academy Pro',
    providerLogo: '🎓',
    gradientStart: '#3B82F6',
    gradientEnd: '#06B6D4',
    type: 'video',
    price: 'berbayar',
    priceIdr: 199000,
    rating: 4.9,
    ratingCount: 876,
    durationMinutes: 510,
    videoCount: 32,
    hasCertificate: true,
    jabker: ['quantity_surveyor'],
    skkTags: [
      { code: 'M.711000.003.01', name: 'Menghitung Volume Pekerjaan Konstruksi' },
      { code: 'M.711000.005.01', name: 'Menyusun Rencana Anggaran Biaya (RAB)' },
    ],
    description:
      'Kelas komprehensif menghitung Bill of Quantity, RAB, dan analisa harga satuan untuk proyek gedung bertingkat. Dilengkapi template Excel dan studi kasus proyek nyata.',
    highlights: [
      'Template Excel BOQ & RAB langsung pakai',
      'SNI harga satuan terbaru 2024',
      'Studi kasus gedung 5 lantai',
    ],
    url: 'https://skillacademy.com',
    isBestSeller: true,
  },
  {
    id: 'pengawas-lapangan-mutu',
    title: 'Pengendalian Mutu Pekerjaan Struktur Beton',
    provider: 'LPJK Webinar Series',
    providerLogo: '🏗️',
    gradientStart: '#10B981',
    gradientEnd: '#14B8A6',
    type: 'webinar',
    price: 'gratis',
    rating: 4.7,
    ratingCount: 2341,
    durationMinutes: 240,
    videoCount: 12,
    hasCertificate: true,
    jabker: ['pengawas_lapangan', 'ahli_struktur'],
    skkTags: [
      { code: 'F.45.2.0.1.1.0.76.II.01', name: 'Melakukan Pengendalian Mutu Beton' },
    ],
    description:
      'Webinar resmi LPJK membahas prosedur pengendalian mutu beton di lapangan — mulai dari mix design, slump test, pengujian silinder beton, hingga acceptance criteria sesuai SNI.',
    highlights: [
      'Prosedur slump test & uji kuat tekan beton',
      'Formulir pengendalian mutu lapangan',
      'Rekaman webinar LPJK (dapat sebagai bukti CPD)',
    ],
    url: 'https://lpjk.pu.go.id',
    isNew: true,
  },
  {
    id: 'mep-koordinasi-bim',
    title: 'Koordinasi MEP dengan BIM — Revit MEP Dasar',
    provider: 'Autodesk Learning',
    providerLogo: '💻',
    gradientStart: '#8B5CF6',
    gradientEnd: '#A855F7',
    type: 'video',
    price: 'berbayar',
    priceIdr: 350000,
    rating: 4.8,
    ratingCount: 543,
    durationMinutes: 600,
    videoCount: 38,
    hasCertificate: true,
    jabker: ['ahli_mekanikal_elektrikal', 'ahli_plumbing'],
    skkTags: [
      { code: 'F.45.2.0.4.0.0.19.II.01', name: 'Merencanakan Sistem Mekanikal Bangunan' },
    ],
    description:
      'Panduan lengkap penggunaan Revit MEP untuk koordinasi sistem mekanikal, elektrikal, dan plumbing pada proyek gedung. Termasuk clash detection dan pembuatan shop drawing MEP.',
    highlights: [
      'Revit MEP 2024 — lisensi student gratis tersedia',
      'Clash detection & resolusi koordinasi',
      'Sertifikat Autodesk diakui internasional',
    ],
    url: 'https://learn.autodesk.com',
    isFeatured: true,
  },
  {
    id: 'manpro-wbs-schedule',
    title: 'Membuat WBS & Jadwal Proyek dengan MS Project',
    provider: 'YouTube — Pak Budi Konstruksi',
    providerLogo: '📺',
    gradientStart: '#F43F5E',
    gradientEnd: '#EC4899',
    type: 'video',
    price: 'gratis',
    rating: 4.6,
    ratingCount: 4200,
    durationMinutes: 195,
    videoCount: 15,
    hasCertificate: false,
    jabker: ['manajer_proyek', 'pengawas_lapangan'],
    skkTags: [
      { code: 'M.711000.012.01', name: 'Menyusun Jadwal Pelaksanaan Proyek' },
    ],
    description:
      'Playlist YouTube lengkap membahas pembuatan Work Breakdown Structure (WBS), Gantt Chart, Baseline, dan pelaporan kemajuan proyek menggunakan Microsoft Project 2021.',
    highlights: [
      '15 video praktis — langsung praktek',
      'Template MS Project tersedia di deskripsi',
      'Metode Earned Value Analysis (EVA)',
    ],
    url: 'https://youtube.com',
    isBestSeller: true,
  },
  {
    id: 'ahli-struktur-desain-kolom',
    title: 'Desain Kolom & Balok Beton Bertulang SNI 2847',
    provider: 'HAKI Webinar',
    providerLogo: '🏛️',
    gradientStart: '#F59E0B',
    gradientEnd: '#F97316',
    type: 'webinar',
    price: 'gratis',
    rating: 4.9,
    ratingCount: 1876,
    durationMinutes: 360,
    videoCount: 18,
    hasCertificate: true,
    jabker: ['ahli_struktur'],
    skkTags: [
      { code: 'F.45.2.0.1.0.0.19.III.01', name: 'Merencanakan Struktur Beton Bertulang' },
    ],
    description:
      'Webinar HAKI membahas prosedur desain kolom, balok, dan pelat beton bertulang sesuai SNI 2847:2019 dan SNI 1726:2019 (beban gempa).',
    highlights: [
      'Metode desain LRFD sesuai SNI 2847:2019',
      'Contoh hitungan kolom dengan beban gempa',
      'Spreadsheet desain otomatis disediakan',
    ],
    url: 'https://haki.or.id',
    isFeatured: true,
  },
  {
    id: 'k3-kebakaran-apar',
    title: 'Pencegahan & Penanganan Kebakaran Konstruksi',
    provider: 'YouTube — K3 Academy ID',
    providerLogo: '📺',
    gradientStart: '#EF4444',
    gradientEnd: '#EA580C',
    type: 'video',
    price: 'gratis',
    rating: 4.5,
    ratingCount: 3100,
    durationMinutes: 120,
    videoCount: 10,
    hasCertificate: false,
    jabker: ['ahli_k3_konstruksi', 'pengawas_k3_konstruksi'],
    skkTags: [
      { code: 'F.45.2.0.0.0.0.0.05', name: 'Mengelola Penanganan Darurat K3' },
    ],
    description:
      'Seri video YouTube membahas proteksi kebakaran di proyek konstruksi — jenis APAR, prosedur evakuasi, identifikasi sumber api, dan pembuatan emergency response plan.',
    highlights: [
      'Demonstrasi langsung penggunaan APAR',
      'Template Emergency Response Plan',
      'Prosedur sesuai Permen 04/MEN/1980',
    ],
    url: 'https://youtube.com',
    isNew: true,
  },
  {
    id: 'pengawas-as-built-drawing',
    title: 'Membuat As-Built Drawing dengan AutoCAD Civil 3D',
    provider: 'Skill Academy Pro',
    providerLogo: '🎓',
    gradientStart: '#06B6D4',
    gradientEnd: '#0EA5E9',
    type: 'video',
    price: 'berbayar',
    priceIdr: 255000,
    rating: 4.9,
    ratingCount: 892,
    durationMinutes: 494,
    videoCount: 33,
    hasCertificate: true,
    jabker: ['pengawas_lapangan', 'quantity_surveyor'],
    skkTags: [
      { code: 'F.45.2.0.1.1.0.76.II.05', name: 'Membuat Laporan Teknis Pengawasan' },
    ],
    description:
      'Kelas bundle 2 kursus dari Skill Academy Pro — AutoCAD 2D untuk pengawas lapangan dan pembuatan As-Built Drawing berstandar PUPR.',
    highlights: [
      'Bundle 2 kursus — akses seumur hidup',
      'Template As-Built Drawing sesuai standar PUPR',
      'Sertifikat Skill Academy Pro',
    ],
    url: 'https://skillacademy.com',
    isBestSeller: true,
  },
  {
    id: 'qs-esimpan-tutorial',
    title: 'Panduan Lengkap Aplikasi ESIMPAN Kemnaker',
    provider: 'Kemnaker Diklatkerja',
    providerLogo: '🏛️',
    gradientStart: '#6366F1',
    gradientEnd: '#3B82F6',
    type: 'diklatkerja',
    price: 'gratis',
    rating: 4.4,
    ratingCount: 5600,
    durationMinutes: 90,
    videoCount: 8,
    hasCertificate: false,
    jabker: ['quantity_surveyor', 'pengawas_lapangan', 'manajer_proyek'],
    skkTags: [
      { code: 'M.711000.008.01', name: 'Mendokumentasikan Kemajuan Pekerjaan' },
    ],
    description:
      'Tutorial resmi Kemnaker tentang cara mengoperasikan ESIMPAN — upload bukti PKB, mengajukan SKK, dan tracking status.',
    highlights: [
      'Tutorial resmi dari Kemnaker',
      'Langkah upload bukti PKB di ESIMPAN',
      'Cara pengajuan SKK online',
    ],
    url: 'https://www.diklatkerja.kemnaker.go.id',
    isNew: true,
  },
];

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

const ALL_JABKER = Array.from(new Set(COURSES.flatMap((c) => c.jabker)));

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
  onClose,
  onToggleWatch,
  onShare,
  onOpen,
  onCatatPkb,
}: {
  course: Course;
  watched: boolean;
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
              <View style={[dm.badge, { backgroundColor: '#FEF3C7' }]}>
                <Text style={[dm.badgeText, { color: '#92400E' }]}>🏆 Best Seller</Text>
              </View>
            )}
            {course.isNew && (
              <View style={[dm.badge, { backgroundColor: '#EDE9FE' }]}>
                <Text style={[dm.badgeText, { color: '#5B21B6' }]}>✨ Baru</Text>
              </View>
            )}
          </View>

          <Text style={[dm.title, { color: colors.foreground }]}>{course.title}</Text>
          <Text style={[dm.provider, { color: colors.mutedForeground }]}>{course.provider}</Text>

          {/* Stats row */}
          <View style={[dm.statsRow, { borderColor: colors.border }]}>
            <View style={dm.stat}>
              <Feather name="star" size={14} color="#F59E0B" />
              <Text style={[dm.statText, { color: colors.foreground }]}>{course.rating.toFixed(1)}</Text>
              <Text style={[dm.statSub, { color: colors.mutedForeground }]}>({course.ratingCount.toLocaleString()})</Text>
            </View>
            <View style={[dm.statDivider, { backgroundColor: colors.border }]} />
            <View style={dm.stat}>
              <Feather name="clock" size={14} color={colors.mutedForeground} />
              <Text style={[dm.statText, { color: colors.foreground }]}>{formatDuration(course.durationMinutes)}</Text>
            </View>
            <View style={[dm.statDivider, { backgroundColor: colors.border }]} />
            <View style={dm.stat}>
              <Feather name="play-circle" size={14} color={colors.mutedForeground} />
              <Text style={[dm.statText, { color: colors.foreground }]}>{course.videoCount} video</Text>
            </View>
          </View>

          {/* Description */}
          <Text style={[dm.sectionLabel, { color: colors.foreground }]}>Tentang Kursus</Text>
          <Text style={[dm.description, { color: colors.mutedForeground }]}>{course.description}</Text>

          {/* Highlights */}
          <Text style={[dm.sectionLabel, { color: colors.foreground }]}>Yang Akan Dipelajari</Text>
          {course.highlights.map((h, i) => (
            <View key={i} style={dm.highlightRow}>
              <Feather name="check-circle" size={14} color="#10B981" style={dm.checkIcon} />
              <Text style={[dm.highlightText, { color: colors.foreground }]}>{h}</Text>
            </View>
          ))}

          {/* SKK Tags */}
          <Text style={[dm.sectionLabel, { color: colors.foreground }]}>Unit SKK yang Dicakup</Text>
          {course.skkTags.map((tag) => (
            <View key={tag.code} style={[dm.skkRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Text style={[dm.skkCode, { color: colors.primary }]}>{tag.code}</Text>
              <Text style={[dm.skkName, { color: colors.foreground }]}>{tag.name}</Text>
            </View>
          ))}

          {/* Jabker pills */}
          <Text style={[dm.sectionLabel, { color: colors.foreground }]}>Relevan untuk Jabker</Text>
          <View style={dm.jabkerRow}>
            {course.jabker.map((j) => (
              <View key={j} style={[dm.jabkerPill, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Text style={[dm.jabkerPillText, { color: colors.secondaryForeground }]}>{JABKER_LABELS[j] ?? j}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Action bar */}
        <View style={[dm.actionBar, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <Pressable
            style={[dm.actionBtn, dm.actionBtnSecondary, { borderColor: colors.border }]}
            onPress={onShare}
            hitSlop={8}
          >
            <Feather name="share-2" size={16} color={colors.primary} />
          </Pressable>
          <Pressable
            style={[dm.actionBtn, dm.actionBtnSecondary, { borderColor: colors.border }]}
            onPress={onToggleWatch}
            hitSlop={8}
          >
            <Feather
              name={watched ? 'check-circle' : 'circle'}
              size={16}
              color={watched ? '#10B981' : colors.mutedForeground}
            />
            <Text style={[dm.actionBtnText, { color: watched ? '#10B981' : colors.mutedForeground }]}>
              {watched ? 'Ditonton' : 'Tandai'}
            </Text>
          </Pressable>
          <Pressable
            style={[dm.actionBtn, dm.actionBtnSecondary, { borderColor: '#10B981', flex: 1 }]}
            onPress={onCatatPkb}
            hitSlop={8}
          >
            <Feather name="file-plus" size={16} color="#10B981" />
            <Text style={[dm.actionBtnText, { color: '#10B981' }]}>Catat ke PKB</Text>
          </Pressable>
          <Pressable
            style={[dm.actionBtn, dm.actionBtnPrimary, { backgroundColor: colors.primary }]}
            onPress={onOpen}
          >
            <Feather name="external-link" size={16} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const dm = StyleSheet.create({
  root: { flex: 1 },
  headerStrip: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerEmoji: { fontSize: 40 },
  scrollContent: { padding: 20, paddingBottom: 8 },
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
  title: { fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', lineHeight: 26, marginBottom: 4 },
  provider: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 16 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    gap: 0,
  },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' },
  statText: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold' },
  statSub: { fontSize: 11, fontFamily: 'PlusJakartaSans_400Regular' },
  statDivider: { width: 1, height: 20 },
  sectionLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    marginBottom: 8,
    marginTop: 4,
  },
  description: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 20, marginBottom: 16 },
  highlightRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  checkIcon: { marginRight: 8, marginTop: 2 },
  highlightText: { flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 20 },
  skkRow: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  skkCode: { fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 2 },
  skkName: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 18 },
  jabkerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  jabkerPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  jabkerPillText: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium' },
  actionBar: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    borderTopWidth: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  actionBtnSecondary: { borderWidth: 1 },
  actionBtnPrimary: {},
  actionBtnText: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold' },
});

// ─── Course card ──────────────────────────────────────────────────────────────

function CourseCard({
  course,
  watched,
  onPress,
  onToggleWatch,
  onShare,
}: {
  course: Course;
  watched: boolean;
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

  const [search, setSearch] = useState('');
  const [filterJabker, setFilterJabker] = useState('');
  const [filterPrice, setFilterPrice] = useState<'' | 'gratis' | 'berbayar'>('');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const router = useRouter();

  // Fetch watched status from backend
  const { data: watchedData, isLoading, refetch } = useQuery({
    queryKey: ['marketplace-watched'],
    queryFn: getWatchedCourses,
    staleTime: 1000 * 60,
  });

  const watchedIds = useMemo(
    () => new Set(watchedData?.watchedIds ?? []),
    [watchedData],
  );

  const toggleWatch = useMutation({
    mutationFn: async ({ course, isWatched }: { course: Course; isWatched: boolean }) => {
      if (isWatched) {
        await unmarkCourseWatched(course.id);
      } else {
        await markCourseWatched(course.id, {
          courseTitle:    course.title,
          courseProvider: course.provider,
          courseJabkerList:  course.jabker,
          courseSkkTagsList: course.skkTags.map((t) => t.code),
        });
      }
    },
    onMutate: async ({ course, isWatched }) => {
      // Optimistic update
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

  // Filter courses
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return COURSES.filter((c) => {
      if (filterJabker && !c.jabker.includes(filterJabker)) return false;
      if (filterPrice && c.price !== filterPrice) return false;
      if (q && !c.title.toLowerCase().includes(q) && !c.provider.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, filterJabker, filterPrice]);

  const watchedCount = COURSES.filter((c) => watchedIds.has(c.id)).length;

  return (
    <View style={[ms.root, { backgroundColor: colors.background }]}>
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
              {watchedCount}/{COURSES.length}
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
        {ALL_JABKER.map((j) => (
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
      {isLoading ? (
        <View style={ms.loadingBox}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[ms.loadingText, { color: colors.mutedForeground }]}>Memuat status...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <CourseCard
              course={item}
              watched={watchedIds.has(item.id)}
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
              onRefresh={refetch}
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
});
