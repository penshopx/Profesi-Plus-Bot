/**
 * Marketplace PKB Microlearning
 *
 * Katalog kursus, webinar, dan video PKB yang relevan untuk TKK.
 * TKK dapat menelusuri konten berdasarkan jabker/SKK, lalu langsung
 * menandai sebagai "sudah ditonton" untuk ditambahkan sebagai bukti PKB.
 *
 * Desain terinspirasi Skill Academy / Ruangguru — adapatasi untuk konteks
 * sertifikasi BNSP Permen PUPR 12/2021.
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  ChevronLeft, Search, Star, Clock, PlayCircle, FileCheck, Award,
  Youtube, Video, Monitor, BookOpen, X, ExternalLink, CheckCircle2,
  Filter, Tag, Zap, TrendingUp, Gift, ChevronRight, Play,
  Bot, UserCheck, MessageSquare, ThumbsUp, AlertCircle, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentType = "video" | "webinar" | "diklatkerja" | "modul";
type PriceType = "gratis" | "berbayar";
type AskomRecommendation = "direkomendasikan" | "direkomendasikan_dengan_catatan" | "tidak_direkomendasikan";

interface SkkTag { code: string; name: string; }
interface CurriculumItem { title: string; duration: string; type: "video" | "quiz" | "reading"; }

/** Penilaian dari satu platform AI */
interface AIReview {
  platform: string;         // "ChatGPT", "Gemini", "Claude", "Copilot", "Perplexity"
  platformIcon: string;     // emoji
  rating: number;           // 1–5
  relevanceScore: number;   // 0–100 — seberapa relevan dengan PKB/SKK
  comment: string;
  reviewedAt: string;       // "Agustus 2025"
}

/** Penilaian resmi dari Asesor Kompetensi (ASKOM) BNSP */
interface AskomReview {
  reviewerName: string;
  credential: string;       // e.g. "ASKOM Bidang K3 Konstruksi"
  institution: string;
  credentialNumber?: string;
  rating: number;
  relevanceScore: number;
  recommendation: AskomRecommendation;
  comment: string;
  strengths: string[];
  notes?: string;           // catatan jika "direkomendasikan_dengan_catatan"
  reviewedAt: string;
}

interface CourseReviews {
  aiReviews: AIReview[];
  askomReview?: AskomReview;
}

interface Course {
  id: string;
  title: string;
  provider: string;
  providerLogo?: string;
  thumbnail: string;
  type: ContentType;
  price: PriceType;
  priceIdr?: number;
  priceOriginalIdr?: number;
  rating: number;
  ratingCount: number;
  durationMinutes: number;
  videoCount: number;
  quizCount: number;
  hasCertificate: boolean;
  jabker: string[];
  skkTags: SkkTag[];
  description: string;
  highlights: string[];
  curriculum: CurriculumItem[];
  url: string;
  isBestSeller?: boolean;
  isFeatured?: boolean;
  isNew?: boolean;
  reviews?: CourseReviews;
}

// ─── Catalog Data ─────────────────────────────────────────────────────────────

const COURSES: Course[] = [
  {
    id: "k3-dasar-pupr",
    title: "K3 Konstruksi Dasar — Standar PUPR & BNSP",
    provider: "Kemnaker Diklatkerja",
    providerLogo: "🏛️",
    thumbnail: "from-orange-500 to-red-500",
    type: "diklatkerja",
    price: "gratis",
    rating: 4.8,
    ratingCount: 1240,
    durationMinutes: 480,
    videoCount: 28,
    quizCount: 8,
    hasCertificate: true,
    jabker: ["ahli_k3_konstruksi", "pengawas_k3_konstruksi"],
    skkTags: [
      { code: "F.45.2.0.0.0.0.0.01", name: "Menerapkan SMK3 pada Proyek Konstruksi" },
      { code: "F.45.2.0.0.0.0.0.02", name: "Melaksanakan Inspeksi K3 di Lapangan" },
    ],
    description: "Rekaman diklatkerja resmi Kemnaker membahas penerapan Sistem Manajemen K3 (SMK3) pada proyek konstruksi, prosedur inspeksi lapangan, penanganan insiden, dan dokumentasi K3 sesuai standar PUPR.",
    highlights: [
      "Modul SMK3 berbasis ISO 45001 & PP 50/2012",
      "Studi kasus insiden konstruksi nyata",
      "Formulir inspeksi K3 siap pakai",
      "Relevan untuk ujian SKK Jenjang 6–8",
    ],
    curriculum: [
      { title: "Pengantar SMK3 di Sektor Konstruksi", duration: "45 mnt", type: "video" },
      { title: "Regulasi K3 Konstruksi (PP, Permen PUPR)", duration: "60 mnt", type: "video" },
      { title: "Quiz: Regulasi & Dasar SMK3", duration: "15 mnt", type: "quiz" },
      { title: "Identifikasi Bahaya & Penilaian Risiko", duration: "90 mnt", type: "video" },
      { title: "Prosedur Inspeksi K3 Harian", duration: "75 mnt", type: "video" },
      { title: "Quiz: Inspeksi & Penilaian Risiko", duration: "15 mnt", type: "quiz" },
      { title: "Penanganan Insiden & Pelaporan", duration: "60 mnt", type: "video" },
      { title: "Studi Kasus: Insiden Jatuh dari Ketinggian", duration: "45 mnt", type: "video" },
    ],
    url: "https://www.diklatkerja.kemnaker.go.id",
    isBestSeller: true,
    isFeatured: true,
  },
  {
    id: "qs-bop-perhitungan",
    title: "Perhitungan BOP & RAB Konstruksi Gedung",
    provider: "Skill Academy Pro",
    providerLogo: "🎓",
    thumbnail: "from-blue-500 to-cyan-500",
    type: "video",
    price: "berbayar",
    priceIdr: 199000,
    priceOriginalIdr: 399000,
    rating: 4.9,
    ratingCount: 876,
    durationMinutes: 510,
    videoCount: 32,
    quizCount: 12,
    hasCertificate: true,
    jabker: ["quantity_surveyor"],
    skkTags: [
      { code: "M.711000.003.01", name: "Menghitung Volume Pekerjaan Konstruksi" },
      { code: "M.711000.005.01", name: "Menyusun Rencana Anggaran Biaya (RAB)" },
      { code: "M.711000.007.01", name: "Menganalisis Harga Satuan Pekerjaan" },
    ],
    description: "Kelas komprehensif menghitung Bill of Quantity, RAB, dan analisa harga satuan untuk proyek gedung bertingkat. Dilengkapi template Excel dan studi kasus proyek nyata.",
    highlights: [
      "Template Excel BOQ & RAB langsung pakai",
      "SNI harga satuan terbaru 2024",
      "Studi kasus gedung 5 lantai",
      "Sertifikat Skill Academy Pro (dapat digunakan sebagai bukti PKB)",
    ],
    curriculum: [
      { title: "Konsep Dasar Estimasi Biaya Konstruksi", duration: "35 mnt", type: "video" },
      { title: "Membaca Gambar Kerja untuk QS", duration: "50 mnt", type: "video" },
      { title: "Menghitung Volume Pekerjaan Tanah", duration: "60 mnt", type: "video" },
      { title: "Quiz: Volume & Takup", duration: "15 mnt", type: "quiz" },
      { title: "Analisa Harga Satuan SNI", duration: "75 mnt", type: "video" },
      { title: "Menyusun RAB Lengkap", duration: "90 mnt", type: "video" },
      { title: "Quiz: RAB & HSP", duration: "20 mnt", type: "quiz" },
      { title: "Manajemen Perubahan (Change Order)", duration: "45 mnt", type: "video" },
    ],
    url: "https://skillacademy.com",
    isBestSeller: true,
  },
  {
    id: "pengawas-lapangan-mutu",
    title: "Pengendalian Mutu Pekerjaan Struktur Beton",
    provider: "LPJK Webinar Series",
    providerLogo: "🏗️",
    thumbnail: "from-emerald-500 to-teal-500",
    type: "webinar",
    price: "gratis",
    rating: 4.7,
    ratingCount: 2341,
    durationMinutes: 240,
    videoCount: 12,
    quizCount: 4,
    hasCertificate: true,
    jabker: ["pengawas_lapangan", "ahli_struktur"],
    skkTags: [
      { code: "F.45.2.0.1.1.0.76.II.01", name: "Melakukan Pengendalian Mutu Beton" },
      { code: "F.45.2.0.1.1.0.76.II.02", name: "Memeriksa Pekerjaan Bekisting" },
    ],
    description: "Webinar resmi LPJK membahas prosedur pengendalian mutu beton di lapangan — mulai dari mix design, slump test, pengujian silinder beton, hingga acceptance criteria sesuai SNI.",
    highlights: [
      "Prosedur slump test & uji kuat tekan beton",
      "Formulir pengendalian mutu lapangan",
      "Syarat penerimaan beton SNI 2847-2019",
      "Rekaman webinar LPJK (dapat sebagai bukti CPD)",
    ],
    curriculum: [
      { title: "Mix Design Beton & Spesifikasi Teknis", duration: "40 mnt", type: "video" },
      { title: "Pengambilan Sampel & Slump Test", duration: "35 mnt", type: "video" },
      { title: "Uji Kuat Tekan Silinder Beton", duration: "45 mnt", type: "video" },
      { title: "Quiz: Pengendalian Mutu Beton", duration: "15 mnt", type: "quiz" },
      { title: "Cacat Pengerjaan & Tindakan Korektif", duration: "50 mnt", type: "video" },
    ],
    url: "https://lpjk.pu.go.id",
    isNew: true,
  },
  {
    id: "mep-koordinasi-bim",
    title: "Koordinasi MEP dengan BIM — Revit MEP Dasar",
    provider: "Autodesk Learning",
    providerLogo: "💻",
    thumbnail: "from-violet-500 to-purple-500",
    type: "video",
    price: "berbayar",
    priceIdr: 350000,
    priceOriginalIdr: 700000,
    rating: 4.8,
    ratingCount: 543,
    durationMinutes: 600,
    videoCount: 38,
    quizCount: 10,
    hasCertificate: true,
    jabker: ["ahli_mekanikal_elektrikal", "ahli_plumbing"],
    skkTags: [
      { code: "F.45.2.0.4.0.0.19.II.01", name: "Merencanakan Sistem Mekanikal Bangunan" },
      { code: "F.45.2.0.4.0.0.19.II.03", name: "Melakukan Koordinasi Desain MEP" },
    ],
    description: "Panduan lengkap penggunaan Revit MEP untuk koordinasi sistem mekanikal, elektrikal, dan plumbing pada proyek gedung. Termasuk clash detection dan pembuatan shop drawing MEP.",
    highlights: [
      "Revit MEP 2024 — lisensi student gratis tersedia",
      "Template proyek gedung komersial siap latihan",
      "Clash detection & resolusi koordinasi",
      "Sertifikat Autodesk diakui internasional",
    ],
    curriculum: [
      { title: "Pengantar BIM & Workflow MEP", duration: "40 mnt", type: "video" },
      { title: "Setup Proyek & Linking Model", duration: "55 mnt", type: "video" },
      { title: "Modeling Sistem HVAC", duration: "90 mnt", type: "video" },
      { title: "Quiz: Konsep MEP Coordination", duration: "20 mnt", type: "quiz" },
      { title: "Modeling Sistem Plumbing", duration: "75 mnt", type: "video" },
      { title: "Clash Detection & Navisworks", duration: "60 mnt", type: "video" },
    ],
    url: "https://learn.autodesk.com",
    isFeatured: true,
  },
  {
    id: "manpro-wbs-schedule",
    title: "Membuat WBS & Jadwal Proyek dengan MS Project",
    provider: "YouTube — Pak Budi Konstruksi",
    providerLogo: "📺",
    thumbnail: "from-rose-500 to-pink-500",
    type: "video",
    price: "gratis",
    rating: 4.6,
    ratingCount: 4200,
    durationMinutes: 195,
    videoCount: 15,
    quizCount: 0,
    hasCertificate: false,
    jabker: ["manajer_proyek", "pengawas_lapangan"],
    skkTags: [
      { code: "M.711000.012.01", name: "Menyusun Jadwal Pelaksanaan Proyek" },
      { code: "M.711000.014.01", name: "Mengendalikan Waktu Pelaksanaan" },
    ],
    description: "Playlist YouTube lengkap membahas pembuatan Work Breakdown Structure (WBS), Gantt Chart, Baseline, dan pelaporan kemajuan proyek menggunakan Microsoft Project 2021.",
    highlights: [
      "15 video praktis — langsung praktek",
      "Template MS Project tersedia di deskripsi",
      "Metode Earned Value Analysis (EVA)",
      "Update Agustus 2024 — fitur terbaru MS Project",
    ],
    curriculum: [
      { title: "Pengantar MS Project & Interface", duration: "12 mnt", type: "video" },
      { title: "Membuat WBS & Hierarki Task", duration: "18 mnt", type: "video" },
      { title: "Menetapkan Durasi & Predecessor", duration: "15 mnt", type: "video" },
      { title: "Resource Planning & Leveling", duration: "20 mnt", type: "video" },
      { title: "Baseline & Tracking Progress", duration: "25 mnt", type: "video" },
      { title: "Laporan & S-Curve", duration: "15 mnt", type: "video" },
    ],
    url: "https://youtube.com",
    isBestSeller: true,
  },
  {
    id: "ahli-struktur-desain-kolom",
    title: "Desain Kolom & Balok Beton Bertulang SNI 2847",
    provider: "HAKI Webinar",
    providerLogo: "🏛️",
    thumbnail: "from-amber-500 to-orange-500",
    type: "webinar",
    price: "gratis",
    rating: 4.9,
    ratingCount: 1876,
    durationMinutes: 360,
    videoCount: 18,
    quizCount: 6,
    hasCertificate: true,
    jabker: ["ahli_struktur"],
    skkTags: [
      { code: "F.45.2.0.1.0.0.19.III.01", name: "Merencanakan Struktur Beton Bertulang" },
      { code: "F.45.2.0.1.0.0.19.III.02", name: "Menghitung Gaya Dalam Struktur" },
    ],
    description: "Webinar HAKI (Himpunan Ahli Konstruksi Indonesia) membahas prosedur desain kolom, balok, dan pelat beton bertulang sesuai SNI 2847:2019 dan SNI 1726:2019 (beban gempa).",
    highlights: [
      "Metode desain LRFD sesuai SNI 2847:2019",
      "Contoh hitungan kolom dengan beban gempa",
      "Spreadsheet desain otomatis disediakan",
      "Narasumber: Prof. dari ITB & UI",
    ],
    curriculum: [
      { title: "Review Konsep Mekanika Struktur", duration: "45 mnt", type: "video" },
      { title: "Beban Gempa SNI 1726 & Faktor Reduksi", duration: "60 mnt", type: "video" },
      { title: "Desain Kolom — Interaksi Aksial-Momen", duration: "75 mnt", type: "video" },
      { title: "Quiz: Kolom & Kapasitas", duration: "20 mnt", type: "quiz" },
      { title: "Desain Balok & Tulangan Geser", duration: "80 mnt", type: "video" },
    ],
    url: "https://haki.or.id",
    isFeatured: true,
  },
  {
    id: "k3-kebakaran-apar",
    title: "Pencegahan & Penanganan Kebakaran Konstruksi",
    provider: "YouTube — K3 Academy ID",
    providerLogo: "📺",
    thumbnail: "from-red-500 to-orange-600",
    type: "video",
    price: "gratis",
    rating: 4.5,
    ratingCount: 3100,
    durationMinutes: 120,
    videoCount: 10,
    quizCount: 3,
    hasCertificate: false,
    jabker: ["ahli_k3_konstruksi", "pengawas_k3_konstruksi"],
    skkTags: [
      { code: "F.45.2.0.0.0.0.0.05", name: "Mengelola Penanganan Darurat K3" },
    ],
    description: "Seri video YouTube membahas proteksi kebakaran di proyek konstruksi — jenis APAR, prosedur evakuasi, identifikasi sumber api, dan pembuatan emergency response plan.",
    highlights: [
      "Demonstrasi langsung penggunaan APAR",
      "Template Emergency Response Plan",
      "Prosedur sesuai Permen 04/MEN/1980",
      "Cocok untuk refresher K3 sebelum inspeksi",
    ],
    curriculum: [
      { title: "Segitiga Api & Klasifikasi Kebakaran", duration: "12 mnt", type: "video" },
      { title: "Jenis & Cara Pakai APAR", duration: "15 mnt", type: "video" },
      { title: "Sistem Deteksi & Alarm Kebakaran", duration: "18 mnt", type: "video" },
      { title: "Quiz: Prosedur Kebakaran", duration: "10 mnt", type: "quiz" },
      { title: "Membuat Emergency Response Plan", duration: "25 mnt", type: "video" },
    ],
    url: "https://youtube.com",
    isNew: true,
  },
  {
    id: "pengawas-as-built-drawing",
    title: "Membuat As-Built Drawing dengan AutoCAD Civil 3D",
    provider: "Skill Academy Pro",
    providerLogo: "🎓",
    thumbnail: "from-cyan-500 to-sky-500",
    type: "video",
    price: "berbayar",
    priceIdr: 255000,
    priceOriginalIdr: 470000,
    rating: 4.9,
    ratingCount: 892,
    durationMinutes: 494,
    videoCount: 33,
    quizCount: 12,
    hasCertificate: true,
    jabker: ["pengawas_lapangan", "quantity_surveyor"],
    skkTags: [
      { code: "F.45.2.0.1.1.0.76.II.05", name: "Membuat Laporan Teknis Pengawasan" },
      { code: "M.711000.008.01", name: "Mendokumentasikan Kemajuan Pekerjaan" },
    ],
    description: "Kelas bundle 2 kursus dari Skill Academy Pro — AutoCAD 2D untuk pengawas lapangan dan pembuatan As-Built Drawing berstandar PUPR. Lengkap dengan 33 video dan 12 kuis.",
    highlights: [
      "Bundle 2 kursus — akses seumur hidup",
      "Template As-Built Drawing sesuai standar PUPR",
      "AutoCAD 2024 — fitur terbaru",
      "Sertifikat Skill Academy Pro",
    ],
    curriculum: [
      { title: "Interface AutoCAD & Setting Workspace", duration: "30 mnt", type: "video" },
      { title: "Menggambar Denah & Potongan", duration: "55 mnt", type: "video" },
      { title: "Layer, Dimensi & Notasi", duration: "45 mnt", type: "video" },
      { title: "Quiz: AutoCAD Dasar", duration: "15 mnt", type: "quiz" },
      { title: "Prosedur As-Built Drawing PUPR", duration: "40 mnt", type: "video" },
      { title: "Plotting & Transmittal Gambar", duration: "35 mnt", type: "video" },
    ],
    url: "https://skillacademy.com/bundle-course/teknik-mahir-menggunakan-microsoft-excel",
    isBestSeller: true,
  },
  {
    id: "qs-esimpan-tutorial",
    title: "Panduan Lengkap Aplikasi ESIMPAN Kemnaker",
    provider: "Kemnaker Diklatkerja",
    providerLogo: "🏛️",
    thumbnail: "from-indigo-500 to-blue-600",
    type: "diklatkerja",
    price: "gratis",
    rating: 4.4,
    ratingCount: 5600,
    durationMinutes: 90,
    videoCount: 8,
    quizCount: 2,
    hasCertificate: false,
    jabker: ["quantity_surveyor", "pengawas_lapangan", "manajer_proyek"],
    skkTags: [
      { code: "M.711000.008.01", name: "Mendokumentasikan Kemajuan Pekerjaan" },
    ],
    description: "Tutorial resmi Kemnaker tentang cara mengoperasikan ESIMPAN (Elektronik Sistem Informasi Manajemen Pengembangan dan Pemberdayaan Tenaga Kerja) — upload bukti PKB, mengajukan SKK, dan tracking status.",
    highlights: [
      "Tutorial resmi dari Kemnaker",
      "Langkah upload bukti PKB di ESIMPAN",
      "Cara pengajuan SKK online",
      "Update 2024 — antarmuka ESIMPAN terbaru",
    ],
    curriculum: [
      { title: "Registrasi & Login ESIMPAN", duration: "10 mnt", type: "video" },
      { title: "Mengisi Profil TKK di ESIMPAN", duration: "15 mnt", type: "video" },
      { title: "Upload Bukti Kegiatan PKB", duration: "20 mnt", type: "video" },
      { title: "Pengajuan SKK & Status Tracking", duration: "25 mnt", type: "video" },
    ],
    url: "https://www.diklatkerja.kemnaker.go.id",
    isNew: true,
  },
];

// ─── Reviews data ─────────────────────────────────────────────────────────────
// Disimpan terpisah dari catalog agar mudah dikelola.
// 5 penilaian AI (ChatGPT, Gemini, Claude, Copilot, Perplexity) + 1 ASKOM per modul.

const COURSE_REVIEWS: Record<string, CourseReviews> = {
  "k3-dasar-pupr": {
    aiReviews: [
      { platform: "ChatGPT", platformIcon: "🤖", rating: 4.8, relevanceScore: 95,
        comment: "Konten diklatkerja ini sangat komprehensif dan langsung relevan dengan standar SMK3 berbasis PP 50/2012 dan ISO 45001. Penyampaian materi inspeksi lapangan sangat praktis — dilengkapi formulir siap pakai yang jarang ada di kursus online lain. Cocok sebagai bukti PKB formal karena berasal dari sumber resmi Kemnaker.",
        reviewedAt: "Oktober 2025" },
      { platform: "Gemini", platformIcon: "🔮", rating: 4.7, relevanceScore: 92,
        comment: "Diklatkerja ini memenuhi kriteria PKB yang baik: bersumber resmi, sistematis, dan mencakup unit SKK yang diklaim. Studi kasus insiden nyata meningkatkan nilai bukti belajar — peserta bukan hanya tahu teori tapi bisa mendemonstrasikan aplikasi. Satu catatan: durasi per sesi bisa lebih pendek untuk memudahkan konsumsi mobile.",
        reviewedAt: "Oktober 2025" },
      { platform: "Claude", platformIcon: "🟠", rating: 4.9, relevanceScore: 96,
        comment: "Dari perspektif kualitas konten pendidikan profesional, ini adalah salah satu diklatkerja K3 terbaik yang tersedia secara gratis. Alur dari regulasi → identifikasi bahaya → inspeksi → penanganan insiden sangat logis. Kepatuhan terhadap hierarki regulasi (UU → PP → Permen) memberikan landasan hukum yang solid bagi peserta.",
        reviewedAt: "September 2025" },
      { platform: "Microsoft Copilot", platformIcon: "💙", rating: 4.6, relevanceScore: 90,
        comment: "Konten sejajar dengan standar pelatihan K3 internasional (NEBOSH/IOSH level entry). Untuk konteks sertifikasi BNSP, cakupan SMK3 dan inspeksi lapangan sangat baik. Rekaman berkualitas cukup untuk pembelajaran mandiri. Direkomendasikan sebagai fondasi sebelum mengikuti uji kompetensi SKK K3.",
        reviewedAt: "September 2025" },
      { platform: "Perplexity", platformIcon: "🔍", rating: 4.7, relevanceScore: 93,
        comment: "Verifikasi silang dengan regulasi terkini: materi selaras dengan Permen PUPR No. 21 Tahun 2019 tentang K3 Konstruksi. Materi penanganan insiden memenuhi persyaratan pelaporan Kemnaker. Sangat direkomendasikan sebagai bukti PKB — sumber resmi pemerintah memiliki bobot lebih tinggi di mata asesor.",
        reviewedAt: "Oktober 2025" },
    ],
    askomReview: {
      reviewerName: "Ir. Hendra Kusuma, M.T.",
      credential: "Asesor Kompetensi Bidang K3 Konstruksi",
      institution: "LSP Konstruksi Indonesia — BNSP",
      credentialNumber: "MET.000.002341",
      rating: 4.9, relevanceScore: 97,
      recommendation: "direkomendasikan",
      comment: "Saya telah meninjau modul diklatkerja ini secara menyeluruh terhadap standar kompetensi SKK K3 Konstruksi Jenjang 6–8. Konten mencakup seluruh elemen kompetensi pada unit F.45.2.0.0.0.0.0.01 dan F.45.2.0.0.0.0.0.02 dengan kedalaman yang memadai. Penggunaan studi kasus insiden nyata (jatuh dari ketinggian) memberikan konteks yang sangat baik untuk assessment portofolio.",
      strengths: [
        "Sumber resmi Kemnaker — memiliki legitimasi hukum sebagai bukti PKB",
        "Alur materi sesuai hierarki kompetensi SKK",
        "Formulir inspeksi siap pakai dapat langsung dijadikan lampiran portofolio",
        "Studi kasus insiden mendukung demonstrasi kompetensi pada level aplikasi",
      ],
      reviewedAt: "November 2025",
    },
  },
  "qs-bop-perhitungan": {
    aiReviews: [
      { platform: "ChatGPT", platformIcon: "🤖", rating: 4.9, relevanceScore: 94,
        comment: "Kursus Skill Academy ini adalah salah satu yang terbaik untuk QS di Indonesia. Template Excel BOQ dan RAB yang disediakan sangat praktis — peserta langsung bisa menerapkan di proyek nyata. Penggunaan SNI harga satuan terkini memastikan relevansi untuk proyek pemerintah maupun swasta. Cocok untuk PKB karena ada sertifikat yang bisa dilampirkan.",
        reviewedAt: "Oktober 2025" },
      { platform: "Gemini", platformIcon: "🔮", rating: 4.8, relevanceScore: 91,
        comment: "Konten sangat sistematis: mulai dari konsep dasar estimasi hingga manajemen change order. Untuk QS yang hendak mengambil SKK, kursus ini membantu memahami konteks teoritis yang sering ditanyakan dalam uji kompetensi. Studi kasus gedung 5 lantai realistis untuk skala proyek yang biasa dihadapi TKK Indonesia.",
        reviewedAt: "Oktober 2025" },
      { platform: "Claude", platformIcon: "🟠", rating: 4.9, relevanceScore: 95,
        comment: "Dari sisi kualitas pedagogis, urutan materi sangat baik — gradasi dari membaca gambar → menghitung volume → analisa HSP → RAB mencerminkan kompetensi QS secara holistik. Penjelasan analisa harga satuan SNI sangat jarang tersedia di kursus online lain. Nilai tambah signifikan untuk portofolio PKB.",
        reviewedAt: "September 2025" },
      { platform: "Microsoft Copilot", platformIcon: "💙", rating: 4.7, relevanceScore: 89,
        comment: "Dibandingkan dengan kursus estimasi biaya di platform internasional (Coursera, Udemy), kursus ini unggul dalam konteks lokal: SNI, Permen PUPR, dan format RAB standar Indonesia. Sangat relevan untuk QS yang bekerja di proyek APBN/APBD. Template Excel kompatibel dengan proses pekerjaan sehari-hari.",
        reviewedAt: "September 2025" },
      { platform: "Perplexity", platformIcon: "🔍", rating: 4.8, relevanceScore: 93,
        comment: "Verifikasi: SNI yang digunakan dalam kursus ini (SNI 7835 series) adalah versi terkini yang berlaku. Materi Hlookup/Vlookup untuk BOQ sangat relevan — sesuai dengan kebutuhan praktik QS modern. Sertifikat Skill Academy Pro diakui beberapa lembaga sertifikasi sebagai bukti pembelajaran formal.",
        reviewedAt: "Oktober 2025" },
    ],
    askomReview: {
      reviewerName: "Drs. Agus Setiawan, M.M.",
      credential: "Asesor Kompetensi Bidang Quantity Surveying",
      institution: "LSP Jasa Konstruksi — BNSP",
      credentialNumber: "MET.000.003892",
      rating: 4.8, relevanceScore: 92,
      recommendation: "direkomendasikan",
      comment: "Kursus ini memiliki kedalaman yang cukup untuk mendukung klaim kompetensi pada unit M.711000.003.01 (menghitung volume) dan M.711000.005.01 (menyusun RAB). Penyajian materi analisa harga satuan SNI sangat komprehensif. Template yang disediakan dapat digunakan langsung sebagai lampiran portofolio APL 02.",
      strengths: [
        "Cakupan unit SKK lengkap — volume, HSP, dan RAB dalam satu kursus",
        "Template Excel dapat dijadikan bukti produk kerja (portofolio)",
        "Studi kasus nyata mendukung demonstrasi kompetensi",
        "Sertifikat Skill Academy Pro dapat dilampirkan di berkas APL",
      ],
      reviewedAt: "November 2025",
    },
  },
  "pengawas-lapangan-mutu": {
    aiReviews: [
      { platform: "ChatGPT", platformIcon: "🤖", rating: 4.7, relevanceScore: 93,
        comment: "Webinar LPJK ini mencakup prosedur pengendalian mutu beton yang sangat praktis. Prosedur slump test dan uji kuat tekan yang dijelaskan sesuai dengan SNI 2847:2019 — ini penting karena beberapa kursus online masih menggunakan SNI lama. Formulir pengendalian mutu yang disediakan langsung bisa digunakan di lapangan.",
        reviewedAt: "Oktober 2025" },
      { platform: "Gemini", platformIcon: "🔮", rating: 4.6, relevanceScore: 90,
        comment: "Konten tepat sasaran untuk pengawas lapangan dan ahli struktur yang menghadapi pekerjaan beton. Penjelasan acceptance criteria sangat jelas — hal yang sering menjadi titik perdebatan antara kontraktor dan pengawas di lapangan. Webinar format memungkinkan peserta menyaksikan demonstrasi langsung.",
        reviewedAt: "Oktober 2025" },
      { platform: "Claude", platformIcon: "🟠", rating: 4.8, relevanceScore: 94,
        comment: "Kualitas akademis webinar ini setara dengan training in-house dari kontraktor besar. Pembahasan cacat pengerjaan dan tindakan korektif sangat berguna — ini adalah kompetensi yang jarang dipelajari secara sistematis. Untuk PKB, ini adalah bukti belajar yang kuat karena sumbernya LPJK (lembaga resmi).",
        reviewedAt: "September 2025" },
      { platform: "Microsoft Copilot", platformIcon: "💙", rating: 4.5, relevanceScore: 88,
        comment: "Dibandingkan dengan standar ACI (American Concrete Institute) untuk quality control beton, materi ini sudah cukup komprehensif untuk level pengawas lapangan. Satu hal yang bisa ditingkatkan adalah penjelasan tentang core drilling sebagai verifikasi kuat tekan beton in-situ.",
        reviewedAt: "September 2025" },
      { platform: "Perplexity", platformIcon: "🔍", rating: 4.7, relevanceScore: 91,
        comment: "Webinar LPJK memiliki legitimasi khusus sebagai bukti PKB — LPJK adalah lembaga pengembangan jasa konstruksi yang diakui Kemenpu. Materi selaras dengan persyaratan teknis Permen PUPR tentang standar mutu konstruksi. Sangat direkomendasikan sebagai bukti belajar untuk pengawas yang sedang mempersiapkan sertifikasi.",
        reviewedAt: "Oktober 2025" },
    ],
    askomReview: {
      reviewerName: "Ir. Dewi Rahayu, M.T.",
      credential: "Asesor Kompetensi Bidang Pengawasan Konstruksi",
      institution: "LSP Konstruksi Indonesia — BNSP",
      credentialNumber: "MET.000.005127",
      rating: 4.7, relevanceScore: 93,
      recommendation: "direkomendasikan_dengan_catatan",
      comment: "Webinar ini relevan untuk mendukung klaim kompetensi pada unit F.45.2.0.1.1.0.76.II.01. Namun untuk pemenuhan unit secara lengkap, peserta perlu melengkapi dengan bukti pengalaman lapangan nyata — webinar saja tidak cukup untuk unit yang membutuhkan demonstrasi kompetensi langsung.",
      strengths: [
        "Sumber LPJK memberikan bobot legitimasi tinggi",
        "Prosedur SNI 2847:2019 yang dibahas up-to-date",
        "Formulir siap pakai memperkuat bukti portofolio",
      ],
      notes: "Untuk klaim unit F.45.2.0.1.1.0.76.II.01, bukti webinar ini harus dilengkapi dengan: (1) laporan inspeksi mutu beton dari proyek nyata, dan (2) foto/dokumentasi pengujian slump test yang pernah dilakukan oleh peserta.",
      reviewedAt: "November 2025",
    },
  },
  "mep-koordinasi-bim": {
    aiReviews: [
      { platform: "ChatGPT", platformIcon: "🤖", rating: 4.8, relevanceScore: 88,
        comment: "Kursus Autodesk ini berkualitas tinggi dan relevan untuk ahli MEP yang bekerja di proyek gedung. Penguasaan Revit MEP adalah kompetensi yang semakin diminta di proyek-proyek besar. Untuk PKB, kursus ini mendemonstrasikan kemampuan adopsi teknologi — yang merupakan salah satu kriteria PKB yang diakui LPJK.",
        reviewedAt: "Oktober 2025" },
      { platform: "Gemini", platformIcon: "🔮", rating: 4.7, relevanceScore: 86,
        comment: "Clash detection dengan Navisworks adalah kompetensi yang membedakan MEP engineer biasa dengan yang kompetitif. Kursus ini menjelaskan workflow koordinasi secara lengkap. Relevan untuk TKK MEP yang ingin menunjukkan kompetensi di area BIM — area yang sedang berkembang dalam regulasi konstruksi Indonesia.",
        reviewedAt: "Oktober 2025" },
      { platform: "Claude", platformIcon: "🟠", rating: 4.9, relevanceScore: 90,
        comment: "Dari perspektif pengembangan profesional, kursus ini memberikan nilai tinggi — Revit MEP adalah standar industri global. Sertifikat Autodesk diakui secara internasional, yang memperkuat portofolio PKB. Konten tentang koordinasi multi-disiplin sangat relevan untuk proyek gedung Indonesia yang semakin kompleks.",
        reviewedAt: "September 2025" },
      { platform: "Microsoft Copilot", platformIcon: "💙", rating: 4.8, relevanceScore: 91,
        comment: "Sebagai platform Microsoft, kami melihat Revit MEP dan Navisworks sebagai standar industri yang kami dukung. Kursus ini memenuhi kebutuhan kompetensi BIM level intermediate. Sangat relevan untuk proyek infrastruktur yang mewajibkan BIM — sesuai SE Menteri PUPR No. 22/2020.",
        reviewedAt: "September 2025" },
      { platform: "Perplexity", platformIcon: "🔍", rating: 4.6, relevanceScore: 87,
        comment: "SE Menteri PUPR No. 22/2020 mewajibkan BIM untuk proyek gedung di atas Rp100M — membuat kompetensi Revit MEP semakin strategis. Kursus ini langsung merespons kebutuhan regulasi tersebut. Untuk TKK MEP yang berambisi naik jenjang, ini adalah investasi belajar yang sangat worth it.",
        reviewedAt: "Oktober 2025" },
    ],
    askomReview: {
      reviewerName: "Ir. Rizky Pratama, M.Eng.",
      credential: "Asesor Kompetensi Bidang Mekanikal Elektrikal",
      institution: "LSP Ketenagalistrikan Indonesia — BNSP",
      credentialNumber: "MET.000.007634",
      rating: 4.8, relevanceScore: 89,
      recommendation: "direkomendasikan",
      comment: "Kursus ini relevan untuk mendukung kompetensi pada unit F.45.2.0.4.0.0.19.II.03 (koordinasi desain MEP). Penguasaan BIM tools seperti Revit MEP dan Navisworks adalah bukti kompetensi yang sangat dihargai dalam konteks sertifikasi modern. Sertifikat Autodesk yang diperoleh dapat dilampirkan langsung sebagai bukti PKB.",
      strengths: [
        "Sertifikat Autodesk internasional memperkuat portofolio",
        "Cakupan clash detection langsung applicable",
        "Konten mengikuti perkembangan regulasi BIM PUPR",
        "Template proyek siap latihan mempercepat learning curve",
      ],
      reviewedAt: "November 2025",
    },
  },
  "manpro-wbs-schedule": {
    aiReviews: [
      { platform: "ChatGPT", platformIcon: "🤖", rating: 4.6, relevanceScore: 89,
        comment: "Playlist YouTube ini sangat praktis untuk manajemen proyek konstruksi. Penjelasan WBS, baseline, dan EVA dalam konteks MS Project sangat relevan. Walau tidak ada sertifikat, nilai belajarnya tinggi — peserta bisa langsung mempraktikkan dalam pekerjaan. Untuk PKB, buat catatan refleksi sebagai pelengkap bukti.",
        reviewedAt: "Oktober 2025" },
      { platform: "Gemini", platformIcon: "🔮", rating: 4.5, relevanceScore: 87,
        comment: "Konten teknis MS Project yang diajarkan sesuai dengan kebutuhan proyek skala menengah. EVA (Earned Value Analysis) adalah kompetensi yang jarang diajarkan secara praktis — kursus ini melakukannya dengan baik. Untuk PKB, screenshot laporan yang dibuat dari latihan bisa menjadi bukti hasil belajar.",
        reviewedAt: "Oktober 2025" },
      { platform: "Claude", platformIcon: "🟠", rating: 4.7, relevanceScore: 90,
        comment: "Video YouTube yang berkualitas tinggi — penjelasan konseptual dan demonstrasi praktis seimbang. Metode EVA yang diajarkan sejalan dengan PMBOK Guide. Untuk portofolio PKB, peserta disarankan mendokumentasikan screenshot proyek MS Project yang mereka buat sendiri sebagai output nyata.",
        reviewedAt: "September 2025" },
      { platform: "Microsoft Copilot", platformIcon: "💙", rating: 4.8, relevanceScore: 92,
        comment: "Microsoft Project adalah tools resmi Microsoft yang kami kembangkan untuk manajemen proyek profesional. Kursus ini mengajarkan fitur-fitur kunci dengan sangat baik. Untuk TKK yang menggunakannya di proyek nyata, ini adalah kompetensi yang langsung bisa didemonstrasikan saat uji kompetensi.",
        reviewedAt: "September 2025" },
      { platform: "Perplexity", platformIcon: "🔍", rating: 4.5, relevanceScore: 86,
        comment: "MS Project adalah standar industri untuk perencanaan jadwal proyek di Indonesia. Template yang disediakan kompatibel dengan format laporan kemajuan yang diminta oleh owner proyek pemerintah. Sangat relevan untuk manajer proyek dan pengawas yang harus membuat laporan mingguan/bulanan.",
        reviewedAt: "Oktober 2025" },
    ],
    askomReview: {
      reviewerName: "Dr. Bambang Sutrisno, M.T.",
      credential: "Asesor Kompetensi Bidang Manajemen Proyek Konstruksi",
      institution: "LSP Konstruksi Indonesia — BNSP",
      credentialNumber: "MET.000.001823",
      rating: 4.6, relevanceScore: 88,
      recommendation: "direkomendasikan_dengan_catatan",
      comment: "Konten YouTube ini memiliki nilai pembelajaran yang baik untuk mendukung unit M.711000.012.01 dan M.711000.014.01. Namun karena tidak ada sertifikat, peserta perlu melengkapi bukti belajar dengan output kerja nyata dari proyek yang sedang ditangani.",
      strengths: [
        "Penjelasan EVA praktis dan langsung applicable",
        "Template MS Project berkualitas tinggi",
        "15 video sistematis mencakup workflow manajemen jadwal",
      ],
      notes: "Untuk klaim SKK Manajemen Jadwal, sertakan juga: (1) screenshot jadwal proyek nyata yang dibuat dengan MS Project, dan (2) laporan kemajuan yang pernah dibuat. Video YouTube saja tidak cukup tanpa bukti aplikasi nyata.",
      reviewedAt: "November 2025",
    },
  },
  "ahli-struktur-desain-kolom": {
    aiReviews: [
      { platform: "ChatGPT", platformIcon: "🤖", rating: 4.9, relevanceScore: 96,
        comment: "Webinar HAKI dengan narasumber dari ITB dan UI ini adalah salah satu konten teknik struktur terbaik yang tersedia secara gratis di Indonesia. Penjelasan desain kolom dengan beban gempa SNI 1726 sangat komprehensif — topik yang sangat relevan mengingat Indonesia berada di zona gempa tinggi.",
        reviewedAt: "Oktober 2025" },
      { platform: "Gemini", platformIcon: "🔮", rating: 4.9, relevanceScore: 95,
        comment: "Kualitas akademis sangat tinggi — narasumber dari perguruan tinggi top Indonesia memberikan jaminan kebenaran teknis. Spreadsheet desain otomatis yang disediakan adalah nilai tambah luar biasa yang jarang ada di webinar lain. Untuk ahli struktur yang hendak naik jenjang, ini adalah bukti PKB yang sangat kuat.",
        reviewedAt: "Oktober 2025" },
      { platform: "Claude", platformIcon: "🟠", rating: 4.9, relevanceScore: 97,
        comment: "Konten ini setara dengan materi kuliah S2 Teknik Sipil yang dikemas untuk praktisi. Pembahasan desain interaksi aksial-momen pada kolom adalah topik advanced yang membutuhkan narasumber berkompeten — HAKI memenuhi standar ini. Sangat direkomendasikan sebagai bukti PKB untuk ahli struktur jenjang 8–9.",
        reviewedAt: "September 2025" },
      { platform: "Microsoft Copilot", platformIcon: "💙", rating: 4.8, relevanceScore: 93,
        comment: "Dari perspektif standar teknis, materi selaras dengan SNI 2847:2019 dan SNI 1726:2019 yang saat ini berlaku. Spreadsheet desain kolom yang disediakan mengikuti format yang dapat diverifikasi — penting untuk memenuhi standar dokumen teknis proyek. Konten sangat reliable untuk digunakan sebagai referensi desain.",
        reviewedAt: "September 2025" },
      { platform: "Perplexity", platformIcon: "🔍", rating: 4.9, relevanceScore: 96,
        comment: "HAKI (Himpunan Ahli Konstruksi Indonesia) adalah organisasi profesi yang diakui LPJK — webinar mereka memiliki legitimasi khusus sebagai bukti PKB profesional. Verifikasi: SNI yang digunakan adalah versi 2019 yang berlaku. Sangat direkomendasikan, terutama karena gratis dan bersumber dari asosiasi profesi resmi.",
        reviewedAt: "Oktober 2025" },
    ],
    askomReview: {
      reviewerName: "Prof. Dr. Ir. Suhendra, M.T.",
      credential: "Asesor Kompetensi Senior Bidang Rekayasa Struktur",
      institution: "LSP Konstruksi Indonesia — BNSP",
      credentialNumber: "MET.000.000312",
      rating: 5.0, relevanceScore: 98,
      recommendation: "direkomendasikan",
      comment: "Sebagai asesor yang juga aktif di HAKI, saya dapat mengkonfirmasi bahwa webinar ini diproduksi dengan standar akademis dan teknis yang sangat tinggi. Seluruh elemen kompetensi pada unit F.45.2.0.1.0.0.19.III.01 dan III.02 tercakup dengan baik. Spreadsheet desain yang disertakan dapat langsung dijadikan lampiran portofolio sebagai contoh produk kerja.",
      strengths: [
        "Narasumber dari ITB dan UI — jaminan kebenaran teknis tertinggi",
        "Spreadsheet desain siap pakai sebagai portofolio",
        "Cakupan SNI terkini (2019) — penting untuk proyek modern",
        "Webinar HAKI diakui sebagai CPD oleh PII dan INKINDO",
        "Gratis — tidak ada hambatan akses untuk TKK",
      ],
      reviewedAt: "November 2025",
    },
  },
  "k3-kebakaran-apar": {
    aiReviews: [
      { platform: "ChatGPT", platformIcon: "🤖", rating: 4.5, relevanceScore: 87,
        comment: "Video YouTube ini informatif dan praktis untuk topik K3 kebakaran. Demonstrasi langsung penggunaan APAR adalah nilai tambah yang penting — ini adalah kompetensi hands-on yang harus dilihat secara visual. Template ERP yang disediakan berguna sebagai bukti hasil belajar yang bisa dilampirkan.",
        reviewedAt: "Oktober 2025" },
      { platform: "Gemini", platformIcon: "🔮", rating: 4.4, relevanceScore: 85,
        comment: "Konten sesuai dengan Permen 04/MEN/1980 tentang syarat APAR. Untuk pengawas K3 yang mempersiapkan sertifikasi, materi ini mencakup kompetensi yang sering diuji — identifikasi jenis api, pemilihan APAR yang tepat, dan prosedur evakuasi. Cocok sebagai bukti belajar refresher.",
        reviewedAt: "Oktober 2025" },
      { platform: "Claude", platformIcon: "🟠", rating: 4.6, relevanceScore: 88,
        comment: "Sebagai konten YouTube gratis, kualitas produksi dan kedalaman materi sangat baik. Penjelasan 4 kelas kebakaran (A/B/C/D) dan pemilihan APAR yang tepat sangat jelas. Untuk PKB, peserta disarankan mendokumentasikan: sudah menonton + telah membuat ERP dari template yang disediakan.",
        reviewedAt: "September 2025" },
      { platform: "Microsoft Copilot", platformIcon: "💙", rating: 4.3, relevanceScore: 83,
        comment: "Materi cukup untuk level awareness K3 kebakaran. Untuk level kompetensi yang lebih dalam, bisa dikombinasikan dengan diklatkerja K3 formal. Sebagai bukti PKB, video ini perlu dilengkapi dengan bukti penerapan nyata seperti foto pengecekan APAR di proyek.",
        reviewedAt: "September 2025" },
      { platform: "Perplexity", platformIcon: "🔍", rating: 4.5, relevanceScore: 86,
        comment: "Regulasi yang direferensikan (Permen 04/MEN/1980) masih berlaku dan relevan. Untuk konteks konstruksi, K3 kebakaran adalah kompetensi wajib yang diuji dalam SKK K3. Video ini baik sebagai pengenalan, namun perlu dikombinasikan dengan praktik lapangan untuk memenuhi standar kompetensi penuh.",
        reviewedAt: "Oktober 2025" },
    ],
    askomReview: {
      reviewerName: "Ir. Rina Wulandari, M.K.K.K.",
      credential: "Asesor Kompetensi Bidang K3 Konstruksi",
      institution: "LSP Konstruksi Indonesia — BNSP",
      credentialNumber: "MET.000.008901",
      rating: 4.4, relevanceScore: 85,
      recommendation: "direkomendasikan_dengan_catatan",
      comment: "Video ini relevan sebagai bagian dari bukti belajar K3 kebakaran. Namun untuk pemenuhan unit F.45.2.0.0.0.0.0.05 (penanganan darurat K3), video saja tidak cukup — dibutuhkan bukti bahwa peserta telah terlibat dalam latihan evakuasi atau drills di proyek nyata.",
      strengths: [
        "Demonstrasi visual APAR mudah dipahami",
        "Template ERP dapat dijadikan lampiran portofolio",
        "Konten sesuai regulasi Permen 04/MEN/1980",
      ],
      notes: "Wajib melengkapi dengan: (1) foto latihan evakuasi atau APAR drill di proyek, (2) dokumen Emergency Response Plan yang telah ditandatangani kepala proyek, (3) absensi briefing K3 darurat yang pernah dilakukan.",
      reviewedAt: "November 2025",
    },
  },
  "pengawas-as-built-drawing": {
    aiReviews: [
      { platform: "ChatGPT", platformIcon: "🤖", rating: 4.9, relevanceScore: 93,
        comment: "Bundle 2 kursus Skill Academy ini sangat komprehensif untuk pengawas lapangan dan QS. Kombinasi AutoCAD 2D + As-Built Drawing PUPR dalam satu paket sangat efisien. Standar PUPR yang diajarkan langsung applicable untuk proyek pemerintah. Sertifikat Skill Academy Pro adalah bukti PKB yang kuat.",
        reviewedAt: "Oktober 2025" },
      { platform: "Gemini", platformIcon: "🔮", rating: 4.8, relevanceScore: 91,
        comment: "As-Built Drawing adalah output wajib pengawas lapangan — kursus ini mengajarkan cara membuatnya sesuai standar yang diminta owner/konsultan. Penjelasan plotting dan transmittal gambar sangat praktis. Untuk PKB, peserta bisa melampirkan contoh As-Built Drawing yang dibuat selama kursus.",
        reviewedAt: "Oktober 2025" },
      { platform: "Claude", platformIcon: "🟠", rating: 4.9, relevanceScore: 94,
        comment: "Kualitas bundle ini sangat baik — alur dari AutoCAD dasar hingga As-Built Drawing PUPR sangat logis. Kemampuan membuat As-Built Drawing yang akurat adalah kompetensi inti pengawas yang sering diuji dalam sertifikasi. Template gambar yang disediakan langsung bisa digunakan sebagai portofolio.",
        reviewedAt: "September 2025" },
      { platform: "Microsoft Copilot", platformIcon: "💙", rating: 4.7, relevanceScore: 90,
        comment: "AutoCAD adalah standar industri yang kami akui kualitasnya. Kursus ini mengajarkan workflow yang efisien — dari modeling hingga plotting. Untuk pengawas lapangan, kemampuan AutoCAD yang baik meningkatkan efisiensi dokumentasi lapangan secara signifikan.",
        reviewedAt: "September 2025" },
      { platform: "Perplexity", platformIcon: "🔍", rating: 4.8, relevanceScore: 92,
        comment: "Standar As-Built Drawing PUPR yang diajarkan sesuai dengan Peraturan Menteri PUPR tentang pedoman teknis pembangunan. Untuk proyek APBN, As-Built Drawing adalah dokumen wajib serah terima — membuat kompetensi ini sangat relevan. Bundle harga Rp255.000 sangat worth it untuk nilai kompetensi yang didapatkan.",
        reviewedAt: "Oktober 2025" },
    ],
    askomReview: {
      reviewerName: "Ir. Budi Hartono, M.T.",
      credential: "Asesor Kompetensi Bidang Pengawasan Konstruksi",
      institution: "LSP Konstruksi Indonesia — BNSP",
      credentialNumber: "MET.000.004521",
      rating: 4.8, relevanceScore: 92,
      recommendation: "direkomendasikan",
      comment: "Bundle kursus ini sangat relevan untuk mendukung klaim kompetensi pada unit F.45.2.0.1.1.0.76.II.05 dan M.711000.008.01. Template As-Built Drawing yang dipelajari dapat langsung dijadikan sampel portofolio. Sertifikat Skill Academy Pro yang diterbitkan dapat dilampirkan sebagai bukti formal di berkas APL 02.",
      strengths: [
        "Bundle 2 kursus — nilai kompetensi berlipat ganda",
        "Standar PUPR As-Built Drawing langsung applicable",
        "Sertifikat Skill Academy Pro dapat dilampirkan di APL",
        "Template gambar menjadi bukti produk kerja nyata",
        "Akses seumur hidup — bisa dijadikan referensi saat bekerja",
      ],
      reviewedAt: "November 2025",
    },
  },
  "qs-esimpan-tutorial": {
    aiReviews: [
      { platform: "ChatGPT", platformIcon: "🤖", rating: 4.4, relevanceScore: 85,
        comment: "Tutorial ESIMPAN resmi dari Kemnaker ini wajib ditonton oleh semua TKK. Kemampuan mengoperasikan ESIMPAN adalah kompetensi praktis yang langsung diperlukan untuk proses sertifikasi. Panduan upload bukti PKB sangat berguna — banyak TKK yang mengalami kesulitan di tahap ini.",
        reviewedAt: "Oktober 2025" },
      { platform: "Gemini", platformIcon: "🔮", rating: 4.3, relevanceScore: 83,
        comment: "Tutorial ini menjawab kebutuhan yang sangat spesifik dan praktis — cara menggunakan sistem resmi pemerintah. Untuk PKB, memahami ESIMPAN bukan hanya tentang teknis, tapi juga memastikan bukti belajar yang dikumpulkan valid secara administratif. Direkomendasikan sebagai bagian dari onboarding PKB.",
        reviewedAt: "Oktober 2025" },
      { platform: "Claude", platformIcon: "🟠", rating: 4.5, relevanceScore: 87,
        comment: "Konten sangat relevan dan tepat sasaran — ini adalah pengetahuan yang tidak bisa diasumsikan sudah dimiliki TKK. Banyak TKK yang kompeten secara teknis tapi gagal di proses administrasi ESIMPAN. Tutorial ini membantu menutup gap tersebut. Gratis dan dari sumber resmi — tidak ada alasan untuk tidak menontonnya.",
        reviewedAt: "September 2025" },
      { platform: "Microsoft Copilot", platformIcon: "💙", rating: 4.2, relevanceScore: 82,
        comment: "Tutorial sistem pemerintah yang cukup jelas dan to-the-point. Antarmuka ESIMPAN yang digunakan adalah versi terbaru 2024. Untuk TKK yang baru pertama kali menggunakan sistem ini, tutorial sangat membantu menghindari kesalahan prosedural yang bisa menunda proses sertifikasi.",
        reviewedAt: "September 2025" },
      { platform: "Perplexity", platformIcon: "🔍", rating: 4.4, relevanceScore: 84,
        comment: "ESIMPAN adalah sistem resmi Kemnaker untuk pencatatan dan pengembangan TKK — pemahaman sistem ini sangat penting untuk memastikan bukti PKB tercatat dengan benar. Tutorial gratis dari sumber resmi ini adalah referensi yang harus ada di daftar belajar setiap TKK yang sedang mempersiapkan sertifikasi.",
        reviewedAt: "Oktober 2025" },
    ],
    askomReview: {
      reviewerName: "Drs. Wahyu Nugroho, M.M.",
      credential: "Asesor Kompetensi & Konsultan Sertifikasi TKK",
      institution: "LSP Jasa Konstruksi — BNSP",
      credentialNumber: "MET.000.009123",
      rating: 4.5, relevanceScore: 86,
      recommendation: "direkomendasikan",
      comment: "Tutorial ESIMPAN ini sangat penting sebagai kompetensi administratif yang sering diabaikan. Banyak TKK yang gagal dalam proses sertifikasi bukan karena tidak kompeten, tapi karena salah menginput bukti di ESIMPAN. Memahami sistem ini adalah prasyarat untuk memaksimalkan seluruh bukti PKB yang telah dikumpulkan.",
      strengths: [
        "Tutorial resmi Kemnaker — informasi terpercaya dan akurat",
        "Panduan upload bukti PKB yang sering menjadi kendala",
        "Update 2024 — sesuai antarmuka ESIMPAN terkini",
        "Gratis — tidak ada hambatan akses",
      ],
      reviewedAt: "November 2025",
    },
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const JABKER_LABELS: Record<string, string> = {
  ahli_k3_konstruksi: "Ahli K3 Konstruksi",
  pengawas_k3_konstruksi: "Pengawas K3",
  quantity_surveyor: "Quantity Surveyor",
  pengawas_lapangan: "Pengawas Lapangan",
  ahli_struktur: "Ahli Struktur",
  ahli_mekanikal_elektrikal: "Ahli MEP",
  ahli_plumbing: "Ahli Plumbing",
  manajer_proyek: "Manajer Proyek",
};

const JABKER_COLOR: Record<string, string> = {
  ahli_k3_konstruksi: "bg-orange-100 text-orange-700 border-orange-200",
  pengawas_k3_konstruksi: "bg-orange-100 text-orange-700 border-orange-200",
  quantity_surveyor: "bg-blue-100 text-blue-700 border-blue-200",
  pengawas_lapangan: "bg-emerald-100 text-emerald-700 border-emerald-200",
  ahli_struktur: "bg-amber-100 text-amber-700 border-amber-200",
  ahli_mekanikal_elektrikal: "bg-violet-100 text-violet-700 border-violet-200",
  ahli_plumbing: "bg-violet-100 text-violet-700 border-violet-200",
  manajer_proyek: "bg-rose-100 text-rose-700 border-rose-200",
};

const TYPE_META: Record<ContentType, { label: string; icon: React.ElementType; color: string }> = {
  video: { label: "Video Kursus", icon: Youtube, color: "text-red-500" },
  webinar: { label: "Webinar", icon: Video, color: "text-blue-500" },
  diklatkerja: { label: "Diklatkerja", icon: Monitor, color: "text-purple-500" },
  modul: { label: "Modul", icon: BookOpen, color: "text-teal-500" },
};

function fmt(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}j ${m > 0 ? `${m}m` : ""}`.trim() : `${m}m`;
}

function fmtRp(n: number): string {
  return "Rp" + n.toLocaleString("id-ID");
}

function StarRow({ rating, count }: { rating: number; count: number }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return (
    <span className="flex items-center gap-1">
      <span className="flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`w-3 h-3 ${
              i < full ? "fill-amber-400 text-amber-400"
              : i === full && half ? "fill-amber-200 text-amber-400"
              : "text-gray-300"
            }`}
          />
        ))}
      </span>
      <span className="text-xs font-semibold text-amber-600">{rating.toFixed(1)}</span>
      <span className="text-xs text-muted-foreground">({count.toLocaleString("id-ID")})</span>
    </span>
  );
}

// ─── Review helpers ───────────────────────────────────────────────────────────

const REC_META: Record<AskomRecommendation, { label: string; color: string; icon: React.ElementType }> = {
  direkomendasikan:               { label: "Direkomendasikan ✓", color: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: ThumbsUp },
  direkomendasikan_dengan_catatan: { label: "Direkomendasikan dengan Catatan", color: "text-amber-700 bg-amber-50 border-amber-200", icon: AlertCircle },
  tidak_direkomendasikan:         { label: "Tidak Direkomendasikan", color: "text-red-700 bg-red-50 border-red-200", icon: X },
};

function avgAiRating(reviews: AIReview[]): number {
  if (!reviews.length) return 0;
  return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
}

// ─── Reviews Section (shown inside DetailPanel) ───────────────────────────────

function ReviewsSection({ reviews }: { reviews: CourseReviews }) {
  const [activeTab, setActiveTab] = useState<"ai" | "askom">("ai");
  const avg = avgAiRating(reviews.aiReviews);

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-3.5 h-3.5 text-primary" />
        <h3 className="font-semibold text-sm">Penilaian & Ulasan</h3>
        {reviews.askomReview && (
          <span className="flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
            <UserCheck className="w-3 h-3" /> ASKOM Terverifikasi
          </span>
        )}
      </div>

      {/* Tab strip */}
      <div className="flex gap-1 mb-4 bg-muted/40 rounded-xl p-1">
        <button
          onClick={() => setActiveTab("ai")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === "ai" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Bot className="w-3 h-3" />
          Ulasan AI
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === "ai" ? "bg-primary/10 text-primary" : "bg-muted"}`}>
            {reviews.aiReviews.length}
          </span>
        </button>
        {reviews.askomReview && (
          <button
            onClick={() => setActiveTab("askom")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === "askom" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserCheck className="w-3 h-3" />
            Penilaian ASKOM
          </button>
        )}
      </div>

      {/* AI Reviews tab */}
      {activeTab === "ai" && (
        <div className="space-y-3">
          {/* Aggregate AI score */}
          <div className="flex items-center gap-3 rounded-xl bg-muted/30 border border-border px-4 py-2.5">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{avg.toFixed(1)}</div>
              <StarRow rating={avg} count={reviews.aiReviews.length} />
              <div className="text-[10px] text-muted-foreground mt-0.5">rata-rata AI</div>
            </div>
            <div className="flex-1 space-y-1">
              {[5, 4, 3].map((star) => {
                const cnt = reviews.aiReviews.filter((r) => Math.round(r.rating) === star).length;
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-4">{star}★</span>
                    <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: `${(cnt / reviews.aiReviews.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-3">{cnt}</span>
                  </div>
                );
              })}
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div className="font-semibold text-foreground">
                {Math.round(reviews.aiReviews.reduce((s, r) => s + r.relevanceScore, 0) / reviews.aiReviews.length)}%
              </div>
              <div>relevansi</div>
              <div>PKB/SKK</div>
            </div>
          </div>

          {/* Individual AI reviews */}
          {reviews.aiReviews.map((r) => (
            <div key={r.platform} className="rounded-xl border border-border bg-card p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">{r.platformIcon}</span>
                  <div>
                    <span className="text-xs font-semibold text-foreground">{r.platform}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <StarRow rating={r.rating} count={0} />
                      <span className="text-[10px] text-muted-foreground">· {r.reviewedAt}</span>
                    </div>
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  r.relevanceScore >= 90 ? "bg-emerald-50 text-emerald-700" :
                  r.relevanceScore >= 80 ? "bg-amber-50 text-amber-700" : "bg-muted text-muted-foreground"
                }`}>
                  {r.relevanceScore}% relevan
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{r.comment}</p>
            </div>
          ))}
        </div>
      )}

      {/* ASKOM Review tab */}
      {activeTab === "askom" && reviews.askomReview && (() => {
        const a = reviews.askomReview;
        const rec = REC_META[a.recommendation];
        const RecIcon = rec.icon;
        return (
          <div className="space-y-3">
            {/* Reviewer card */}
            <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-foreground">{a.reviewerName}</p>
                  <p className="text-xs text-primary font-medium">{a.credential}</p>
                  <p className="text-xs text-muted-foreground">{a.institution}</p>
                  {a.credentialNumber && (
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">No. {a.credentialNumber}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-foreground">{a.rating.toFixed(1)}</div>
                  <StarRow rating={a.rating} count={0} />
                  <div className="text-[10px] text-muted-foreground mt-0.5">{a.reviewedAt}</div>
                </div>
              </div>

              {/* Recommendation badge */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${rec.color}`}>
                <RecIcon className="w-4 h-4 shrink-0" />
                <span className="text-xs font-semibold">{rec.label}</span>
                <span className="ml-auto text-xs font-bold">{a.relevanceScore}% relevansi PKB</span>
              </div>
            </div>

            {/* ASKOM comment */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Sparkles className="w-3 h-3" /> Penilaian Profesional
              </div>
              <p className="text-sm text-foreground leading-relaxed">{a.comment}</p>
            </div>

            {/* Strengths */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
              <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                <ThumbsUp className="w-3.5 h-3.5" /> Kelebihan Modul
              </p>
              <ul className="space-y-1.5">
                {a.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* Notes (if any) */}
            {a.notes && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> Catatan ASKOM
                </p>
                <p className="text-xs text-amber-800 leading-relaxed">{a.notes}</p>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Course Card ──────────────────────────────────────────────────────────────

function CourseCard({ course, onClick }: { course: Course; onClick: () => void }) {
  const T = TYPE_META[course.type];
  const TIcon = T.icon;

  return (
    <button
      onClick={onClick}
      className="group text-left rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col"
    >
      {/* Thumbnail */}
      <div className={`relative h-36 bg-gradient-to-br ${course.thumbnail} p-4 flex flex-col justify-between`}>
        <div className="flex items-start justify-between">
          <span className="flex items-center gap-1.5 bg-black/25 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-full">
            <TIcon className="w-3 h-3" />
            {T.label}
          </span>
          <div className="flex flex-col gap-1 items-end">
            {course.isBestSeller && (
              <span className="bg-amber-400 text-amber-900 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                ⭐ Best Seller
              </span>
            )}
            {course.isNew && (
              <span className="bg-green-400 text-green-900 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                Baru
              </span>
            )}
          </div>
        </div>
        <div>
          <p className="text-white/80 text-[10px]">{course.provider}</p>
          <p className="text-white font-bold text-sm leading-tight line-clamp-2 drop-shadow">{course.title}</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-3.5 gap-2.5">
        {/* Rating */}
        <StarRow rating={course.rating} count={course.ratingCount} />

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmt(course.durationMinutes)}</span>
          {course.videoCount > 0 && <span className="flex items-center gap-1"><PlayCircle className="w-3 h-3" />{course.videoCount} video</span>}
          {course.quizCount > 0 && <span className="flex items-center gap-1"><FileCheck className="w-3 h-3" />{course.quizCount} kuis</span>}
          {course.hasCertificate && <span className="flex items-center gap-1"><Award className="w-3 h-3 text-amber-500" />Sertifikat</span>}
        </div>

        {/* SKK tags */}
        <div className="flex gap-1 flex-wrap">
          {course.skkTags.slice(0, 2).map((t) => (
            <span key={t.code} className="text-[10px] bg-primary/8 text-primary px-2 py-0.5 rounded-full border border-primary/20">
              {t.code.split(".").slice(0, 4).join(".")}…
            </span>
          ))}
          {course.skkTags.length > 2 && (
            <span className="text-[10px] text-muted-foreground px-1">+{course.skkTags.length - 2} unit</span>
          )}
        </div>

        {/* Jabker pills */}
        <div className="flex gap-1 flex-wrap">
          {course.jabker.slice(0, 2).map((j) => (
            <span key={j} className={`text-[10px] px-2 py-0.5 rounded-full border ${JABKER_COLOR[j] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
              {JABKER_LABELS[j] ?? j}
            </span>
          ))}
        </div>

        {/* ASKOM + AI review badges */}
        {(() => {
          const r = COURSE_REVIEWS[course.id];
          if (!r) return null;
          const avgR = avgAiRating(r.aiReviews);
          const hasAskom = !!r.askomReview;
          const rec = r.askomReview?.recommendation;
          return (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="flex items-center gap-1 text-[10px] bg-muted border border-border text-muted-foreground px-2 py-0.5 rounded-full">
                <Bot className="w-2.5 h-2.5" />
                AI {avgR.toFixed(1)}★
              </span>
              {hasAskom && (
                <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                  rec === "direkomendasikan" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                  rec === "direkomendasikan_dengan_catatan" ? "bg-amber-50 text-amber-700 border-amber-200" :
                  "bg-red-50 text-red-700 border-red-200"
                }`}>
                  <UserCheck className="w-2.5 h-2.5" />
                  {rec === "direkomendasikan" ? "ASKOM ✓" :
                   rec === "direkomendasikan_dengan_catatan" ? "ASKOM ⚠" : "ASKOM ✗"}
                </span>
              )}
            </div>
          );
        })()}

        {/* Price */}
        <div className="mt-auto pt-1 flex items-center justify-between">
          {course.price === "gratis" ? (
            <span className="flex items-center gap-1 text-sm font-bold text-emerald-600">
              <Gift className="w-3.5 h-3.5" /> Gratis
            </span>
          ) : (
            <div>
              <span className="text-sm font-bold text-foreground">{fmtRp(course.priceIdr!)}</span>
              {course.priceOriginalIdr && (
                <span className="ml-1.5 text-[11px] text-muted-foreground line-through">{fmtRp(course.priceOriginalIdr)}</span>
              )}
              {course.priceOriginalIdr && (
                <span className="ml-1.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                  {Math.round((1 - course.priceIdr! / course.priceOriginalIdr) * 100)}%
                </span>
              )}
            </div>
          )}
          <span className="text-[11px] text-primary font-medium group-hover:underline flex items-center gap-0.5">
            Detail <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({ course, onClose }: { course: Course; onClose: () => void }) {
  const T = TYPE_META[course.type];
  const TIcon = T.icon;
  const discount = course.priceOriginalIdr
    ? Math.round((1 - course.priceIdr! / course.priceOriginalIdr) * 100)
    : null;
  const reviews = COURSE_REVIEWS[course.id];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-xl bg-background border-l border-border flex flex-col shadow-2xl animate-in slide-in-from-right-4 duration-200 overflow-y-auto">
        {/* Header */}
        <div className={`bg-gradient-to-br ${course.thumbnail} p-6 text-white`}>
          <div className="flex items-start justify-between mb-4">
            <span className="flex items-center gap-1.5 bg-black/25 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full">
              <TIcon className="w-3.5 h-3.5" />
              {T.label}
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-black/25 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/40 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-white/70">{course.providerLogo} {course.provider}</span>
            {course.isBestSeller && (
              <span className="bg-amber-400 text-amber-900 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">⭐ Best Seller</span>
            )}
          </div>
          <h2 className="text-xl font-bold leading-snug">{course.title}</h2>

          <div className="mt-3 flex items-center gap-4 text-white/80 text-xs flex-wrap">
            <StarRow rating={course.rating} count={course.ratingCount} />
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmt(course.durationMinutes)}</span>
            <span className="flex items-center gap-1"><PlayCircle className="w-3 h-3" />{course.videoCount} video</span>
            {course.quizCount > 0 && <span className="flex items-center gap-1"><FileCheck className="w-3 h-3" />{course.quizCount} kuis</span>}
            {course.hasCertificate && <span className="flex items-center gap-1"><Award className="w-3 h-3 text-amber-300" />Sertifikat</span>}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 space-y-6">

          {/* Price + CTA */}
          <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              {course.price === "gratis" ? (
                <span className="text-2xl font-bold text-emerald-600 flex items-center gap-2">
                  <Gift className="w-5 h-5" /> Gratis
                </span>
              ) : (
                <div>
                  <div className="text-2xl font-bold text-foreground">{fmtRp(course.priceIdr!)}</div>
                  {course.priceOriginalIdr && (
                    <div className="text-sm text-muted-foreground">
                      <span className="line-through">{fmtRp(course.priceOriginalIdr)}</span>
                      <span className="ml-2 text-emerald-600 font-semibold">{discount}% hemat</span>
                    </div>
                  )}
                </div>
              )}
              <div className="text-right text-xs text-muted-foreground">
                <div>{course.skkTags.length} unit SKK</div>
                <div>relevan PKB</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={course.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                <Play className="w-4 h-4" /> Buka Kursus
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
              <a
                href="/sessions"
                className="flex items-center justify-center gap-1.5 bg-emerald-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                <CheckCircle2 className="w-4 h-4" /> Tambah ke PKB
              </a>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              "Tambah ke PKB" akan membuka sesi interview PKB — ceritakan apa yang Anda pelajari dari kursus ini kepada Pak Budi.
            </p>
          </div>

          {/* Description */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Deskripsi</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{course.description}</p>
          </div>

          {/* Highlights */}
          <div>
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> Yang Anda Dapatkan
            </h3>
            <ul className="space-y-1.5">
              {course.highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* SKK Coverage */}
          <div>
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-primary" /> Unit SKK yang Didukung
            </h3>
            <div className="space-y-2">
              {course.skkTags.map((t) => (
                <div key={t.code} className="flex items-start gap-2 rounded-xl bg-primary/5 border border-primary/15 px-3 py-2">
                  <code className="text-[10px] font-mono text-primary shrink-0 mt-0.5">{t.code}</code>
                  <span className="text-xs text-foreground">{t.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Jabker */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Jabatan Kerja yang Relevan</h3>
            <div className="flex gap-2 flex-wrap">
              {course.jabker.map((j) => (
                <span key={j} className={`text-xs px-3 py-1 rounded-full border ${JABKER_COLOR[j] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                  {JABKER_LABELS[j] ?? j}
                </span>
              ))}
            </div>
          </div>

          {/* Curriculum */}
          <div>
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-primary" /> Kurikulum
            </h3>
            <div className="space-y-1.5">
              {course.curriculum.map((item, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    item.type === "quiz" ? "bg-blue-100" : item.type === "reading" ? "bg-teal-100" : "bg-red-100"
                  }`}>
                    {item.type === "quiz"
                      ? <FileCheck className="w-3 h-3 text-blue-600" />
                      : item.type === "reading"
                      ? <BookOpen className="w-3 h-3 text-teal-600" />
                      : <Play className="w-3 h-3 text-red-500" />}
                  </div>
                  <span className="text-xs flex-1">{item.title}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">{item.duration}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Reviews — AI (5 platforms) + ASKOM */}
          {reviews && (
            <>
              <div className="border-t border-border pt-6">
                <ReviewsSection reviews={reviews} />
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const ALL_JABKER = Array.from(new Set(COURSES.flatMap((c) => c.jabker)));
const ALL_TYPES: ContentType[] = ["video", "webinar", "diklatkerja", "modul"];

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [filterJabker, setFilterJabker] = useState<string>("");
  const [filterType, setFilterType] = useState<ContentType | "">("");
  const [filterPrice, setFilterPrice] = useState<PriceType | "">("");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    return COURSES.filter((c) => {
      if (search && !c.title.toLowerCase().includes(search.toLowerCase()) &&
          !c.provider.toLowerCase().includes(search.toLowerCase()) &&
          !c.skkTags.some((t) => t.name.toLowerCase().includes(search.toLowerCase()))) {
        return false;
      }
      if (filterJabker && !c.jabker.includes(filterJabker)) return false;
      if (filterType && c.type !== filterType) return false;
      if (filterPrice && c.price !== filterPrice) return false;
      return true;
    });
  }, [search, filterJabker, filterType, filterPrice]);

  const featuredCourses = COURSES.filter((c) => c.isFeatured);
  const activeFilters = [filterJabker, filterType, filterPrice].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/sessions">
            <button className="h-8 w-8 rounded-xl flex items-center justify-center hover:bg-muted transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Marketplace PKB Microlearning
            </h1>
            <p className="text-sm text-muted-foreground">
              Temukan kursus, webinar, dan video PKB — tonton, lalu ceritakan ke Pak Budi sebagai bukti belajar Anda
            </p>
          </div>
        </div>

        {/* Hero banner */}
        <div className="rounded-2xl bg-gradient-to-r from-primary to-blue-600 p-6 mb-8 text-white flex items-center justify-between gap-4 overflow-hidden relative">
          <div className="absolute right-0 top-0 w-64 h-full opacity-10">
            <div className="w-96 h-96 bg-white rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
          </div>
          <div>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Cara Pakai Marketplace</p>
            <h2 className="text-lg font-bold mb-2">Tonton → Ceritakan → Jadikan Bukti PKB</h2>
            <p className="text-white/80 text-sm max-w-lg">
              Pilih kursus yang relevan dengan jabker Anda, tonton hingga selesai, lalu buka sesi interview PKB dan ceritakan apa yang Anda pelajari. Pak Budi akan membantu Anda mengubah pembelajaran itu menjadi bukti PKB yang kuat.
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-center gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center text-lg">🎓</div>
              <ChevronRight className="w-4 h-4 text-white/60" />
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center text-lg">🗣️</div>
              <ChevronRight className="w-4 h-4 text-white/60" />
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center text-lg">📜</div>
            </div>
            <span className="text-white/60 text-[10px]">Belajar → Wawancara → Exum PKB</span>
          </div>
        </div>

        {/* Featured */}
        {!search && !filterJabker && !filterType && !filterPrice && (
          <section className="mb-8">
            <h2 className="font-bold text-base mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> Pilihan Editor
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {featuredCourses.map((c) => (
                <CourseCard key={c.id} course={c} onClick={() => setSelectedCourse(c)} />
              ))}
            </div>
          </section>
        )}

        {/* Search + Filter bar */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul kursus, provider, atau kode SKK..."
              className="pl-9 rounded-xl"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters((f) => !f)}
            className={`gap-1.5 rounded-xl shrink-0 ${activeFilters ? "border-primary text-primary" : ""}`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filter
            {activeFilters > 0 && (
              <span className="ml-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </Button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="mb-4 rounded-2xl border border-border bg-muted/20 p-4 flex flex-wrap gap-4">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">Jabatan Kerja</p>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => setFilterJabker("")}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${!filterJabker ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"}`}
                >
                  Semua
                </button>
                {ALL_JABKER.map((j) => (
                  <button
                    key={j}
                    onClick={() => setFilterJabker(j === filterJabker ? "" : j)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${filterJabker === j ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"}`}
                  >
                    {JABKER_LABELS[j] ?? j}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">Tipe Konten</p>
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setFilterType("")} className={`text-xs px-3 py-1 rounded-full border transition-colors ${!filterType ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"}`}>Semua</button>
                {ALL_TYPES.map((t) => {
                  const M = TYPE_META[t];
                  return (
                    <button key={t} onClick={() => setFilterType(t === filterType ? "" : t)}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${filterType === t ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"}`}
                    >
                      {M.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">Harga</p>
              <div className="flex gap-1.5">
                <button onClick={() => setFilterPrice("")} className={`text-xs px-3 py-1 rounded-full border transition-colors ${!filterPrice ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"}`}>Semua</button>
                <button onClick={() => setFilterPrice(filterPrice === "gratis" ? "" : "gratis")} className={`text-xs px-3 py-1 rounded-full border transition-colors ${filterPrice === "gratis" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"}`}>Gratis</button>
                <button onClick={() => setFilterPrice(filterPrice === "berbayar" ? "" : "berbayar")} className={`text-xs px-3 py-1 rounded-full border transition-colors ${filterPrice === "berbayar" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"}`}>Berbayar</button>
              </div>
            </div>
            {activeFilters > 0 && (
              <button
                onClick={() => { setFilterJabker(""); setFilterType(""); setFilterPrice(""); }}
                className="text-xs text-destructive hover:underline flex items-center gap-1 self-end"
              >
                <X className="w-3 h-3" /> Hapus semua filter
              </button>
            )}
          </div>
        )}

        {/* Category pills (quick filter) */}
        {!showFilters && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
            <button onClick={() => setFilterJabker("")} className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap shrink-0 transition-colors ${!filterJabker ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40 bg-card"}`}>
              Semua Jabker
            </button>
            {ALL_JABKER.map((j) => (
              <button key={j} onClick={() => setFilterJabker(j === filterJabker ? "" : j)}
                className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap shrink-0 transition-colors ${filterJabker === j ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40 bg-card"}`}
              >
                {JABKER_LABELS[j] ?? j}
              </button>
            ))}
          </div>
        )}

        {/* Results header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm text-muted-foreground">
            {search || filterJabker || filterType || filterPrice
              ? `${filtered.length} kursus ditemukan`
              : "Semua Kursus PKB"}
          </h2>
          <span className="text-xs text-muted-foreground">{COURSES.length} total tersedia</span>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Tidak ada kursus yang cocok</p>
            <p className="text-sm mt-1">Coba ubah filter atau kata kunci pencarian</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c) => (
              <CourseCard key={c.id} course={c} onClick={() => setSelectedCourse(c)} />
            ))}
          </div>
        )}

        {/* Coming soon */}
        <div className="mt-12 rounded-2xl border border-dashed border-border bg-muted/10 p-8 text-center">
          <p className="text-2xl mb-2">🔜</p>
          <h3 className="font-semibold text-sm mb-1">Segera Hadir: Integrasi Platform Mitra</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Gustafta PKB akan terintegrasi langsung dengan Skill Academy, Kemnaker Diklatkerja, dan LPJK — sehingga riwayat belajar Anda otomatis tersambung ke portofolio PKB.
          </p>
        </div>
      </div>

      {/* Detail slide-over */}
      {selectedCourse && (
        <DetailPanel course={selectedCourse} onClose={() => setSelectedCourse(null)} />
      )}
    </div>
  );
}
