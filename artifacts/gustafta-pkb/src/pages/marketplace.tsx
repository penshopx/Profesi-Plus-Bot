/**
 * Marketplace PKB Microlearning
 *
 * Katalog kursus, webinar, dan video PKB yang relevan untuk TKK.
 * TKK dapat menelusuri konten berdasarkan jabker/SKK, lalu langsung
 * menandai sebagai "sudah ditonton" untuk ditambahkan sebagai bukti PKB.
 *
 * Data kursus, AI reviews, dan ASKOM reviews diambil dari backend
 * via GET /api/marketplace/courses — bukan lagi dari konstanta statis.
 *
 * Desain terinspirasi Skill Academy / Ruangguru — adaptasi untuk konteks
 * sertifikasi BNSP Permen PUPR 12/2021.
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  ChevronLeft, Search, Star, Clock, PlayCircle, FileCheck, Award,
  Youtube, Video, Monitor, BookOpen, X, ExternalLink, CheckCircle2,
  Filter, Tag, Zap, TrendingUp, Gift, ChevronRight, Play,
  Bot, UserCheck, MessageSquare, ThumbsUp, AlertCircle, Sparkles,
  Share2, Copy, Check, Send, Eye, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getWatchedCourses, markCourseWatched, unmarkModuleWatched,
  getMarketplaceCatalog,
  type MarketplaceCourseItem,
} from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentType = "video" | "webinar" | "diklatkerja" | "modul";
type PriceType = "gratis" | "berbayar";
type AskomRecommendation = "direkomendasikan" | "direkomendasikan_dengan_catatan" | "tidak_direkomendasikan";

type Course = MarketplaceCourseItem;
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

// ─── Share helpers ────────────────────────────────────────────────────────────

function buildShareText(course: Course, mode: "full" | "short" = "full"): string {
  const price = course.price === "gratis" ? "✅ GRATIS" : `💰 ${fmtRp(course.priceIdr!)}`;
  const jabkerStr = course.jabker.map((j) => JABKER_LABELS[j] ?? j).join(", ");
  const skkStr = course.skkTags.slice(0, 3).map((t) => `• ${t.code} — ${t.name}`).join("\n");
  const reviews = course.reviews;
  const askomStr = reviews?.askomReview
    ? reviews.askomReview.recommendation === "direkomendasikan"
      ? "✅ Direkomendasikan ASKOM BNSP"
      : reviews.askomReview.recommendation === "direkomendasikan_dengan_catatan"
      ? "⚠️ Direkomendasikan ASKOM (dengan catatan)"
      : ""
    : "";

  if (mode === "short") {
    return `🎓 *${course.title}*\n${course.provider} · ${fmt(course.durationMinutes)} · ${price}\n\n${course.url}`;
  }

  return [
    `🎓 *${course.title}*`,
    ``,
    `📋 Provider: ${course.providerLogo ?? ""} ${course.provider}`,
    `⏱ ${fmt(course.durationMinutes)} | ${course.videoCount} video${course.quizCount > 0 ? ` | ${course.quizCount} kuis` : ""}${course.hasCertificate ? " | 🏅 Sertifikat" : ""}`,
    price,
    ``,
    `📌 Unit SKK yang dicakup:`,
    skkStr,
    ``,
    `👷 Cocok untuk: ${jabkerStr}`,
    askomStr ? `\n${askomStr}` : "",
    ``,
    `Tonton, lalu ceritakan ke Pak Budi (asisten PKB Gustafta) untuk dijadikan bukti PKB resmi! 📝`,
    ``,
    `🔗 ${course.url}`,
  ].filter((l) => l !== undefined).join("\n");
}

interface SharePlatform {
  id: string;
  label: string;
  icon: string;
  color: string;
  build: (text: string, url: string) => string | null;
}

const SHARE_PLATFORMS: SharePlatform[] = [
  {
    id: "whatsapp", label: "WhatsApp", icon: "💬", color: "bg-[#25D366] hover:bg-[#20bd5a] text-white",
    build: (text) => `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
  },
  {
    id: "telegram", label: "Telegram", icon: "✈️", color: "bg-[#229ED9] hover:bg-[#1a8fbf] text-white",
    build: (text, url) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: "twitter", label: "X / Twitter", icon: "𝕏", color: "bg-black hover:bg-zinc-800 text-white",
    build: (_, url) => `https://twitter.com/intent/tweet?text=${encodeURIComponent("Rekomendasi modul PKB untuk TKK konstruksi 👷")}&url=${encodeURIComponent(url)}`,
  },
  {
    id: "linkedin", label: "LinkedIn", icon: "in", color: "bg-[#0A66C2] hover:bg-[#095baa] text-white",
    build: (_, url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    id: "email", label: "Email", icon: "✉️", color: "bg-muted hover:bg-muted/80 text-foreground border border-border",
    build: (text, url) => `mailto:?subject=${encodeURIComponent("Rekomendasi Modul PKB Konstruksi")}&body=${encodeURIComponent(text + "\n\n" + url)}`,
  },
];

function ShareModal({ course, onClose }: { course: Course; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [format, setFormat] = useState<"full" | "short">("full");
  const shareText = buildShareText(course, format);
  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  async function copyText() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback: select all in textarea
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: course.title, text: shareText, url: course.url });
    } catch {/* user cancelled */}
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150 p-4">
      <div className="w-full max-w-md bg-background rounded-2xl shadow-2xl border border-border flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Modal header */}
        <div className={`bg-gradient-to-br ${course.thumbnail} px-5 py-4 text-white flex items-start justify-between`}>
          <div>
            <div className="text-xs text-white/70 mb-0.5">{course.provider}</div>
            <h3 className="font-bold text-sm leading-snug line-clamp-2">{course.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 bg-black/25 rounded-full flex items-center justify-center hover:bg-black/40 ml-3 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Format toggle */}
          <div className="flex gap-1 bg-muted/40 rounded-xl p-1 text-xs">
            {(["full", "short"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-colors ${format === f ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
              >
                {f === "full" ? "Pesan lengkap" : "Pesan singkat"}
              </button>
            ))}
          </div>

          {/* Preview */}
          <div className="relative">
            <textarea
              readOnly
              value={shareText}
              rows={format === "full" ? 10 : 4}
              className="w-full rounded-xl border border-border bg-muted/30 text-xs leading-relaxed p-3 resize-none font-mono focus:outline-none"
            />
            <button
              onClick={copyText}
              className={`absolute top-2 right-2 flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors ${
                copied ? "bg-emerald-100 text-emerald-700" : "bg-background border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {copied ? <><Check className="w-3 h-3" /> Tersalin!</> : <><Copy className="w-3 h-3" /> Salin</>}
            </button>
          </div>

          {/* Platform buttons */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-2">Bagikan ke</p>
            <div className="grid grid-cols-3 gap-2">
              {SHARE_PLATFORMS.map((p) => {
                const href = p.build(shareText, course.url);
                return (
                  <a
                    key={p.id}
                    href={href ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95 ${p.color}`}
                  >
                    <span className="text-lg leading-none">{p.icon}</span>
                    {p.label}
                  </a>
                );
              })}

              {/* Copy link */}
              <button
                onClick={copyText}
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 border border-border transition-all hover:scale-105 active:scale-95"
              >
                {copied ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
                {copied ? "Tersalin!" : "Salin Teks"}
              </button>

              {/* Web Share API — mobile native */}
              {canNativeShare && (
                <button
                  onClick={nativeShare}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 col-span-3"
                >
                  <Send className="w-5 h-5" />
                  Bagikan via... (aplikasi lain)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Review helpers ───────────────────────────────────────────────────────────

const REC_META: Record<AskomRecommendation, { label: string; color: string; icon: React.ElementType }> = {
  direkomendasikan:               { label: "Direkomendasikan ✓", color: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: ThumbsUp },
  direkomendasikan_dengan_catatan: { label: "Direkomendasikan dengan Catatan", color: "text-amber-700 bg-amber-50 border-amber-200", icon: AlertCircle },
  tidak_direkomendasikan:         { label: "Tidak Direkomendasikan", color: "text-red-700 bg-red-50 border-red-200", icon: X },
};

function avgAiRating(reviews: { rating: number }[]): number {
  if (!reviews.length) return 0;
  return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
}

// ─── Reviews Section (shown inside DetailPanel) ───────────────────────────────

function ReviewsSection({ reviews }: { reviews: Course["reviews"] }) {
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
        const a = reviews.askomReview!;
        const rec = REC_META[a.recommendation as AskomRecommendation];
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

function CourseCard({ course, onClick, isWatched }: { course: Course; onClick: () => void; isWatched: boolean }) {
  const T = TYPE_META[course.type as ContentType] ?? TYPE_META.video;
  const TIcon = T.icon;
  const [shareOpen, setShareOpen] = useState(false);
  const reviews = course.reviews;
  const avgR = reviews?.aiReviews?.length ? avgAiRating(reviews.aiReviews) : null;
  const rec = reviews?.askomReview?.recommendation as AskomRecommendation | undefined;

  return (
    <div className="relative group">
      {shareOpen && <ShareModal course={course} onClose={() => setShareOpen(false)} />}

      {/* Share button — floats over card, visible on hover, NOT nested inside the card button */}
      <button
        onClick={() => setShareOpen(true)}
        title="Bagikan modul"
        className="absolute bottom-[50px] right-3 z-10 p-1.5 rounded-lg bg-background/90 border border-border text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground shadow-sm"
      >
        <Share2 className="w-3.5 h-3.5" />
      </button>

      {/* Card — full clickable area */}
      <button
        onClick={onClick}
        className="w-full text-left rounded-2xl border border-border bg-card group-hover:border-primary/40 group-hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col"
      >
        {/* Thumbnail */}
        <div className={`relative h-36 bg-gradient-to-br ${course.thumbnail} p-4 flex flex-col justify-between`}>
          <div className="flex items-start justify-between">
            <span className="flex items-center gap-1.5 bg-black/25 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-full">
              <TIcon className="w-3 h-3" />
              {T.label}
            </span>
            <div className="flex flex-col gap-1 items-end">
              {isWatched && (
                <span className="flex items-center gap-1 bg-emerald-500/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                  <Eye className="w-2.5 h-2.5" /> Sudah Ditonton
                </span>
              )}
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
          <StarRow rating={course.rating} count={course.ratingCount} />

          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmt(course.durationMinutes)}</span>
            {course.videoCount > 0 && <span className="flex items-center gap-1"><PlayCircle className="w-3 h-3" />{course.videoCount} video</span>}
            {course.quizCount > 0 && <span className="flex items-center gap-1"><FileCheck className="w-3 h-3" />{course.quizCount} kuis</span>}
            {course.hasCertificate && <span className="flex items-center gap-1"><Award className="w-3 h-3 text-amber-500" />Sertifikat</span>}
          </div>

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

          <div className="flex gap-1 flex-wrap">
            {course.jabker.slice(0, 2).map((j) => (
              <span key={j} className={`text-[10px] px-2 py-0.5 rounded-full border ${JABKER_COLOR[j] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                {JABKER_LABELS[j] ?? j}
              </span>
            ))}
          </div>

          {/* ASKOM + AI review badges */}
          {avgR !== null && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="flex items-center gap-1 text-[10px] bg-muted border border-border text-muted-foreground px-2 py-0.5 rounded-full">
                <Bot className="w-2.5 h-2.5" /> AI {avgR.toFixed(1)}★
              </span>
              {rec && (
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
          )}

          {/* Price + "Detail" */}
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
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  course, onClose, isWatched, onToggleWatch,
}: {
  course: Course;
  onClose: () => void;
  isWatched: boolean;
  onToggleWatch: (course: Course, watched: boolean) => Promise<void>;
}) {
  const T = TYPE_META[course.type as ContentType] ?? TYPE_META.video;
  const TIcon = T.icon;
  const discount = course.priceOriginalIdr
    ? Math.round((1 - course.priceIdr! / course.priceOriginalIdr) * 100)
    : null;
  const reviews = course.reviews;
  const [shareOpen, setShareOpen] = useState(false);
  const [watchLoading, setWatchLoading] = useState(false);

  async function handleToggleWatch() {
    setWatchLoading(true);
    try {
      await onToggleWatch(course, isWatched);
    } finally {
      setWatchLoading(false);
    }
  }

  return (
    <>
    {shareOpen && <ShareModal course={course} onClose={() => setShareOpen(false)} />}
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShareOpen(true)}
                className="w-8 h-8 bg-black/25 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/40 transition-colors"
                title="Bagikan modul"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 bg-black/25 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/40 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
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
              <button
                onClick={() => {
                  try {
                    sessionStorage.setItem("KEGIATAN_FROM_MARKETPLACE", JSON.stringify({
                      marketplaceId:     course.id,
                      courseTitle:       course.title,
                      courseProvider:    course.provider,
                      courseJabkerList:  course.jabker,
                      courseSkkTagsList: course.skkTags.map((t) => t.code),
                    }));
                  } catch {}
                  window.location.href = "/kegiatan";
                }}
                className="flex items-center justify-center gap-1.5 bg-emerald-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                <CheckCircle2 className="w-4 h-4" /> Catat ke PKB
              </button>
            </div>

            {/* Interview shortcut — takes user to a new PKB session pre-seeded with this course */}
            <button
              onClick={() => {
                try {
                  sessionStorage.setItem("INTERVIEW_FROM_MARKETPLACE", JSON.stringify({
                    marketplaceId:  course.id,
                    namaMateri:     course.title,
                    penyelenggara:  course.provider,
                    jabker:         course.jabker[0] ?? "",
                    isWatched,
                  }));
                } catch {}
                window.location.href = "/sessions?new=1";
              }}
              className="w-full flex items-center justify-center gap-1.5 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <MessageSquare className="w-4 h-4" /> Ceritakan ke Pak Budi
            </button>

            {/* Watched toggle */}
            <button
              onClick={handleToggleWatch}
              disabled={watchLoading}
              className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all border ${
                isWatched
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                  : "bg-muted/50 text-foreground border-border hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
              } disabled:opacity-60`}
            >
              {watchLoading ? (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : isWatched ? (
                <><Eye className="w-4 h-4" /> ✓ Sudah Ditonton — Klik untuk Hapus</>
              ) : (
                <><Eye className="w-4 h-4" /> Tandai Sudah Ditonton</>
              )}
            </button>

            <p className="text-[11px] text-muted-foreground text-center">
              Tandai modul yang sudah ditonton — Pak Budi akan tahu dan bisa langsung membahas isinya tanpa Anda perlu menjelaskan ulang.
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
          {reviews && reviews.aiReviews.length > 0 && (
            <div className="border-t border-border pt-6">
              <ReviewsSection reviews={reviews} />
            </div>
          )}

        </div>
      </div>
    </div>
    </>
  );
}
const ALL_TYPES: ContentType[] = ["video", "webinar", "diklatkerja", "modul"];

export default function MarketplacePage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterJabker, setFilterJabker] = useState<string>("");
  const [filterType, setFilterType] = useState<ContentType | "">("");
  const [filterPrice, setFilterPrice] = useState<PriceType | "">("");
  const [filterWatched, setFilterWatched] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Catalog — fetched from backend; cached 10 minutes (catalog rarely changes).
  const { data: courses = [], isLoading: catalogLoading, isError: catalogError } = useQuery({
    queryKey: ["marketplace-catalog"],
    queryFn: getMarketplaceCatalog,
    staleTime: 10 * 60 * 1000,
  });

  // Watched course IDs — fetched via react-query, invalidated after each watch/unwatch.
  const { data: watchedIds = [] } = useQuery({
    queryKey: ["marketplace-watched"],
    queryFn: getWatchedCourses,
    staleTime: 5 * 60 * 1000,
  });
  const watchedSet = useMemo(() => new Set(watchedIds), [watchedIds]);

  // Explicit toggle: mark or unmark a module as watched.
  const handleToggleWatch = async (course: Course, currentlyWatched: boolean) => {
    if (currentlyWatched) {
      await unmarkModuleWatched(course.id);
    } else {
      await markCourseWatched(course.id);
    }
    qc.invalidateQueries({ queryKey: ["marketplace-watched"] });
  };

  // Derive jabker list from fetched courses
  const ALL_JABKER = useMemo(
    () => Array.from(new Set(courses.flatMap((c) => c.jabker))),
    [courses],
  );

  const filtered = useMemo(() => {
    return courses.filter((c) => {
      if (search && !c.title.toLowerCase().includes(search.toLowerCase()) &&
          !c.provider.toLowerCase().includes(search.toLowerCase()) &&
          !c.skkTags.some((t) => t.name.toLowerCase().includes(search.toLowerCase()))) {
        return false;
      }
      if (filterJabker && !c.jabker.includes(filterJabker)) return false;
      if (filterType && c.type !== filterType) return false;
      if (filterPrice && c.price !== filterPrice) return false;
      if (filterWatched && !watchedSet.has(c.id)) return false;
      return true;
    });
  }, [courses, search, filterJabker, filterType, filterPrice, filterWatched, watchedSet]);

  const featuredCourses = useMemo(() => courses.filter((c) => c.isFeatured), [courses]);
  const activeFilters = [filterJabker, filterType, filterPrice, filterWatched ? "watched" : ""].filter(Boolean).length;

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

        {/* Loading state */}
        {catalogLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm">Memuat katalog kursus...</p>
          </div>
        )}

        {/* Error state */}
        {catalogError && !catalogLoading && (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Gagal memuat katalog</p>
            <p className="text-sm mt-1">Periksa koneksi Anda dan coba lagi</p>
          </div>
        )}

        {/* Main content — only shown when catalog is loaded */}
        {!catalogLoading && !catalogError && (
          <>
            {/* Featured */}
            {!search && !filterJabker && !filterType && !filterPrice && (
              <section className="mb-8">
                <h2 className="font-bold text-base mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" /> Pilihan Editor
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {featuredCourses.map((c) => (
                    <CourseCard key={c.id} course={c} onClick={() => setSelectedCourse(c)} isWatched={watchedSet.has(c.id)} />
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
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">Status</p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setFilterWatched((v) => !v)}
                      className={`flex items-center gap-1 text-xs px-3 py-1 rounded-full border transition-colors ${filterWatched ? "bg-emerald-600 text-white border-emerald-600" : "border-border hover:border-emerald-400"}`}
                    >
                      <Eye className="w-3 h-3" /> Sudah Ditonton
                      {filterWatched && watchedIds.length > 0 && (
                        <span className="ml-0.5 text-[10px] opacity-80">({watchedIds.length})</span>
                      )}
                    </button>
                  </div>
                </div>
                {activeFilters > 0 && (
                  <button
                    onClick={() => { setFilterJabker(""); setFilterType(""); setFilterPrice(""); setFilterWatched(false); }}
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
                {/* Watched pill — shows count badge when any are watched */}
                <button
                  onClick={() => setFilterWatched((v) => !v)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border whitespace-nowrap shrink-0 transition-colors ${filterWatched ? "bg-emerald-600 text-white border-emerald-600" : "border-border hover:border-emerald-400 bg-card"}`}
                >
                  <Eye className="w-3 h-3" /> Sudah Ditonton
                  {watchedIds.length > 0 && (
                    <span className={`text-[10px] font-bold px-1 py-0 rounded-full ${filterWatched ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"}`}>
                      {watchedIds.length}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Results header */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm text-muted-foreground">
                {search || filterJabker || filterType || filterPrice
                  ? `${filtered.length} kursus ditemukan`
                  : "Semua Kursus PKB"}
              </h2>
              <span className="text-xs text-muted-foreground">{courses.length} total tersedia</span>
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
                  <CourseCard key={c.id} course={c} onClick={() => setSelectedCourse(c)} isWatched={watchedSet.has(c.id)} />
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
          </>
        )}
      </div>

      {/* Detail slide-over */}
      {selectedCourse && (
        <DetailPanel
          course={selectedCourse}
          onClose={() => setSelectedCourse(null)}
          isWatched={watchedSet.has(selectedCourse.id)}
          onToggleWatch={handleToggleWatch}
        />
      )}
    </div>
  );
}
