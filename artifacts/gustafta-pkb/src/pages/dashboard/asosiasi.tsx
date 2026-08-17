/**
 * Panel Verifikasi Asosiasi
 *
 * Asosiasi memeriksa kelengkapan formal dokumen kegiatan PKB yang diajukan user.
 * Bukan menilai konten atau kesesuaian SKK — hanya kelengkapan administratif.
 *
 * Checklist:
 *   ✅ Surat undangan ada dan valid
 *   ✅ Daftar hadir ada dan lengkap
 *   ✅ Foto dokumentasi ada
 *   ✅ Penyelenggara terdaftar (BNSP/LPJK)
 *
 * Role yang bisa akses: "asosiasi" | "admin"
 */

import { useState } from "react";
import { useUser } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  CheckCircle2, XCircle, ChevronRight, ArrowLeft, FileText,
  User, Calendar, Award, Loader2, AlertCircle, ExternalLink,
  ClipboardCheck, Building2, Camera, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const API = "/api";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Submission {
  id: number; namaKegiatan: string; tanggalMulai: string; jenisPkb?: string;
  penyelenggara?: string; status: string; askomNote?: string | null;
  askomVerifiedAt?: string | null; updatedAt: string;
  ownerName: string; ownerEmail: string;
}

interface ChecklistRecord {
  suratUndangan: boolean; daftarHadir: boolean; foto: boolean;
  penyelenggaraValid: boolean; catatan?: string | null; checkedAt?: string | null;
}

interface ChecklistHistoryEntry {
  id: number; suratUndangan: boolean; daftarHadir: boolean; foto: boolean;
  penyelenggaraValid: boolean; catatan?: string | null; outcome: string;
  checkedAt: string; checkedByName?: string | null;
}

interface SubmissionFull extends Submission {
  namaMateri?: string; tempatKegiatan?: string; uraianSingkat?: string;
  linkRekaman?: string; jpPkb?: number;
  skk: { skkCode: string; skkName: string }[];
  docs: { id: number; docType: string; filename: string; objectPath: string }[];
  checklist: ChecklistRecord | null;
  checklistHistory: ChecklistHistoryEntry[];
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; cls: string }> = {
  diajukan:     { label: "Menunggu Verifikasi",    cls: "bg-amber-100 text-amber-700 border-amber-200" },
  diverifikasi: { label: "Dokumen Lengkap ✓",      cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  ditolak:      { label: "Perlu Perbaikan",         cls: "bg-rose-100 text-rose-700 border-rose-200" },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${m.cls}`}>
      {m.label}
    </span>
  );
}

// ─── Submission list item ─────────────────────────────────────────────────────

function SubmissionCard({ sub, onClick }: { sub: Submission; onClick: () => void }) {
  const date = new Date(sub.updatedAt).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
  });
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card border border-border rounded-2xl p-4 hover:bg-muted/40 transition-colors group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={sub.status} />
          </div>
          <p className="font-semibold text-sm text-foreground truncate">{sub.namaKegiatan}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sub.ownerName} · {date}
          </p>
          {sub.penyelenggara && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Building2 className="w-3 h-3" /> {sub.penyelenggara}
            </p>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-1" />
      </div>
    </button>
  );
}

// ─── Checklist form ───────────────────────────────────────────────────────────

const CHECKLIST_ITEMS = [
  { key: "suratUndangan",      icon: FileText,       label: "Surat undangan", desc: "File surat undangan ada dan terbaca" },
  { key: "daftarHadir",        icon: Users,           label: "Daftar hadir",  desc: "Daftar hadir peserta ada dan lengkap" },
  { key: "foto",               icon: Camera,          label: "Foto dokumentasi", desc: "Minimal 1 foto kegiatan tersedia" },
  { key: "penyelenggaraValid", icon: Building2,       label: "Penyelenggara valid", desc: "Lembaga/organisasi terdaftar atau diakui" },
] as const;

type ChecklistKey = typeof CHECKLIST_ITEMS[number]["key"];

function ChecklistForm({
  sub, existing, onSaved,
}: { sub: SubmissionFull; existing: ChecklistRecord | null; onSaved: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [checks, setChecks] = useState<Record<ChecklistKey, boolean>>({
    suratUndangan:      existing?.suratUndangan ?? false,
    daftarHadir:        existing?.daftarHadir ?? false,
    foto:               existing?.foto ?? false,
    penyelenggaraValid: existing?.penyelenggaraValid ?? false,
  });
  const [catatan, setCatatan] = useState(existing?.catatan ?? "");
  const [saving, setSaving] = useState(false);

  const allClear = Object.values(checks).every(Boolean);

  async function handleSave() {
    setSaving(true);
    try {
      const result = await apiFetch<{ success: boolean; status: string }>(
        `/asosiasi/submissions/${sub.id}/checklist`,
        { method: "POST", body: JSON.stringify({ ...checks, catatan: catatan || null }) },
      );
      toast({
        title: result.status === "diverifikasi"
          ? "✅ Dokumen dinyatakan lengkap"
          : "⚠️ Catatan dikirim ke pengguna",
      });
      qc.invalidateQueries({ queryKey: ["asosiasi-submissions"] });
      qc.invalidateQueries({ queryKey: ["asosiasi-detail", sub.id] });
      onSaved();
    } catch (err: unknown) {
      toast({ title: "Gagal menyimpan", description: String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Checklist Kelengkapan Dokumen
      </h3>

      <div className="space-y-2">
        {CHECKLIST_ITEMS.map(({ key, icon: Icon, label, desc }) => (
          <label key={key} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/30 cursor-pointer transition-colors">
            <input
              type="checkbox"
              className="mt-0.5 w-4 h-4 accent-primary"
              checked={checks[key]}
              onChange={e => setChecks(prev => ({ ...prev, [key]: e.target.checked }))}
            />
            <div className="flex-1">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                {label}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
            {checks[key]
              ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              : <XCircle className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-0.5" />}
          </label>
        ))}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground">
          Catatan untuk pengguna {allClear ? "(opsional)" : "(wajib jika ada yang tidak tercentang)"}
        </label>
        <textarea
          value={catatan}
          onChange={e => setCatatan(e.target.value)}
          placeholder={allClear
            ? "Tambahkan catatan positif jika perlu..."
            : "Jelaskan dokumen apa yang perlu dilengkapi atau diperbaiki..."}
          rows={3}
          className="w-full text-sm rounded-xl border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className={`rounded-xl p-3 text-xs font-medium text-center border ${
        allClear
          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
          : "bg-amber-50 border-amber-200 text-amber-700"
      }`}>
        {allClear
          ? "✅ Semua tercentang — status akan jadi Dokumen Lengkap"
          : `⚠️ ${Object.values(checks).filter(v => !v).length} item belum tercentang — status akan jadi Perlu Perbaikan`}
      </div>

      <Button
        onClick={handleSave}
        disabled={saving || (!allClear && !catatan.trim())}
        className={`w-full ${allClear ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"}`}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ClipboardCheck className="w-4 h-4 mr-2" />}
        {allClear ? "Simpan — Dokumen Lengkap" : "Simpan — Minta Perbaikan"}
      </Button>
    </div>
  );
}

// ─── Riwayat checklist sebelumnya ────────────────────────────────────────────

function ChecklistHistorySection({ history }: { history: ChecklistHistoryEntry[] }) {
  if (!history || history.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Riwayat Pemeriksaan Sebelumnya
      </h3>
      <div className="space-y-2">
        {history.map((h, i) => {
          const verified = h.outcome === "diverifikasi";
          const date = new Date(h.checkedAt).toLocaleString("id-ID", {
            day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
          });
          return (
            <div key={h.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                  verified
                    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                    : "bg-rose-100 text-rose-700 border-rose-200"
                }`}>
                  {verified ? "Dokumen Lengkap ✓" : "Perlu Perbaikan"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  #{i + 1} · {date}{h.checkedByName ? ` · ${h.checkedByName}` : ""}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {CHECKLIST_ITEMS.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-1.5 text-xs">
                    {h[key]
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      : <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                    <span className={h[key] ? "text-foreground" : "text-muted-foreground"}>{label}</span>
                  </div>
                ))}
              </div>
              {h.catatan && (
                <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-2.5 py-1.5">
                  <span className="font-medium text-foreground">Catatan:</span> {h.catatan}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Submission detail view ───────────────────────────────────────────────────

function SubmissionDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const { data: sub, refetch } = useQuery<SubmissionFull>({
    queryKey: ["asosiasi-detail", id],
    queryFn: () => apiFetch(`/asosiasi/submissions/${id}`),
  });

  if (!sub) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  const docsByType = Object.groupBy(sub.docs ?? [], d => d.docType);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Back + header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-4 flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{sub.namaKegiatan}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <StatusBadge status={sub.status} />
            <span className="text-xs text-muted-foreground">{sub.ownerName}</span>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-6">
        {/* Info */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-muted/30 rounded-xl p-3">
            <div className="text-muted-foreground mb-0.5 flex items-center gap-1"><Calendar className="w-3 h-3" /> Tanggal</div>
            <div className="font-medium">{new Date(sub.tanggalMulai).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</div>
          </div>
          <div className="bg-muted/30 rounded-xl p-3">
            <div className="text-muted-foreground mb-0.5 flex items-center gap-1"><Building2 className="w-3 h-3" /> Penyelenggara</div>
            <div className="font-medium">{sub.penyelenggara ?? "—"}</div>
          </div>
          <div className="bg-muted/30 rounded-xl p-3">
            <div className="text-muted-foreground mb-0.5 flex items-center gap-1"><User className="w-3 h-3" /> Peserta</div>
            <div className="font-medium">{sub.ownerName}</div>
            <div className="text-muted-foreground">{sub.ownerEmail}</div>
          </div>
          <div className="bg-muted/30 rounded-xl p-3">
            <div className="text-muted-foreground mb-0.5">Jenis PKB</div>
            <div className="font-medium">{sub.jenisPkb ?? "—"} {sub.jpPkb ? `(${sub.jpPkb} JP)` : ""}</div>
          </div>
        </div>

        {/* Dokumen yang diunggah */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Dokumen yang Diunggah
          </h3>
          <div className="space-y-2">
            {(["surat_undangan", "daftar_hadir", "foto"] as const).map(dt => {
              const docs = docsByType[dt] ?? [];
              const label = { surat_undangan: "Surat Undangan", daftar_hadir: "Daftar Hadir", foto: "Foto Dokumentasi" }[dt];
              return (
                <div key={dt} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card text-sm">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${docs.length > 0 ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                  <span className="flex-1 font-medium">{label}</span>
                  {docs.length > 0 ? (
                    <div className="flex gap-1 flex-wrap justify-end">
                      {docs.map(d => (
                        <a key={d.id} href={`/api/storage/objects/${d.objectPath}`} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" />{d.filename.slice(0, 20)}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Belum diunggah</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* SKK mapping (info saja) */}
        {sub.skk && sub.skk.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Mapping SKK (referensi)
            </h3>
            <div className="space-y-1.5">
              {sub.skk.map(s => (
                <div key={s.skkCode} className="flex items-start gap-2 text-xs bg-muted/30 rounded-lg p-2">
                  <span className="font-mono bg-primary/8 text-primary px-1.5 py-0.5 rounded-full text-[10px] shrink-0">
                    {s.skkCode.split(".").slice(0, 4).join(".")}…
                  </span>
                  <span className="text-muted-foreground">{s.skkName}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Riwayat checklist sebelumnya */}
        <ChecklistHistorySection history={sub.checklistHistory ?? []} />

        {/* Checklist form */}
        <ChecklistForm sub={sub} existing={sub.checklist} onSaved={() => refetch()} />
      </div>
    </div>
  );
}

// ─── Main Asosiasi dashboard ──────────────────────────────────────────────────

export default function AsosiasiDashboard() {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"diajukan" | "diverifikasi" | "ditolak">("diajukan");

  const role = (user?.publicMetadata?.role as string) ?? "user";
  if (role !== "asosiasi" && role !== "admin") {
    setLocation("/");
    return null;
  }

  const { data: submissions = [], isLoading } = useQuery<Submission[]>({
    queryKey: ["asosiasi-submissions"],
    queryFn: () => apiFetch("/asosiasi/submissions"),
    refetchInterval: 60_000,
  });

  const counts = {
    diajukan:     submissions.filter(s => s.status === "diajukan").length,
    diverifikasi: submissions.filter(s => s.status === "diverifikasi").length,
    ditolak:      submissions.filter(s => s.status === "ditolak").length,
  };

  const filtered = submissions.filter(s => s.status === filter);

  if (selectedId !== null) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col">
        <SubmissionDetail id={selectedId} onBack={() => setSelectedId(null)} />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">Panel Asosiasi</p>
            <p className="text-xs text-muted-foreground">Verifikasi kelengkapan dokumen PKB</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-foreground">{user?.fullName}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Asosiasi</p>
        </div>
      </header>

      <div className="flex gap-0 border-b border-border bg-card">
        {(["diajukan", "diverifikasi", "ditolak"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${filter === f ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
            {f === "diajukan" ? `Menunggu (${counts.diajukan})`
              : f === "diverifikasi" ? `Lengkap (${counts.diverifikasi})`
              : `Perbaikan (${counts.ditolak})`}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 space-y-2">
            <ClipboardCheck className="w-10 h-10 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">
              {filter === "diajukan" ? "Tidak ada pengajuan baru" : "Tidak ada data"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(sub => (
              <SubmissionCard key={sub.id} sub={sub} onClick={() => setSelectedId(sub.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
