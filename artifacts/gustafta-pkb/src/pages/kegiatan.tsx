/**
 * Dokumentasi Kegiatan PKB-Exum
 *
 * Halaman untuk mencatat dan mengelola setiap kegiatan PKB yang diikuti user.
 * Dokumentasi ini menjadi portofolio bukti belajar formal untuk proses Exum / SKK
 * sesuai Permen PUPR No. 12/2021 dan SK Dirjen Bina Konstruksi No. 114/2024.
 *
 * 11 field standar BNSP/LPJK:
 * 1. Nama kegiatan          6. Surat undangan
 * 2. Tanggal pelaksanaan    7. Daftar hadir
 * 3. Tempat kegiatan        8. Uraian singkat
 * 4. Nama materi/modul      9. Foto dokumentasi
 * 5. Mapping SKK           10. Link rekaman
 *                          11. Timestamp journey
 */

import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, Plus, FileText, Calendar, MapPin, BookOpen, Link2,
  Upload, Trash2, CheckCircle2, Clock, AlertCircle, ChevronRight,
  X, Tag, Camera, Users, ClipboardList, Pencil, ExternalLink,
  Award, Building2, Eye, Send, Loader2, XCircle, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SkkUnit { skkCode: string; skkName: string; jabkerId?: string; jabkerName?: string; }
interface ActivityDoc { id: number; docType: string; filename: string; objectPath: string; mimeType?: string; caption?: string; uploadedAt: string; }
interface JourneyEntry { id: number; event: string; label: string; metadata?: Record<string, unknown>; createdAt: string; }
interface Activity {
  id: number; namaKegiatan: string; tanggalMulai: string; tanggalSelesai?: string;
  tempatKegiatan?: string; modePelaksanaan?: string; namaMateri?: string;
  penyelenggara?: string; namaInstruktur?: string; uraianSingkat?: string;
  linkRekaman?: string; status: string; jenisPkb?: string; jpPkb?: number;
  marketplaceId?: string; askomNote?: string | null; createdAt: string; updatedAt: string;
  skk: SkkUnit[]; docCount?: number; latestJourney?: JourneyEntry | null;
  docs?: ActivityDoc[]; journey?: JourneyEntry[];
}

// ─── API helpers ──────────────────────────────────────────────────────────────

const API = "/api";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.json();
}

async function uploadFile(file: File): Promise<string> {
  // Step 1 — get presigned URL
  const { uploadURL, objectPath } = await apiFetch<{ uploadURL: string; objectPath: string }>(
    "/storage/uploads/request-url",
    {
      method: "POST",
      body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" }),
    },
  );
  // Step 2 — PUT directly to GCS
  const putRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!putRes.ok) throw new Error("Upload ke GCS gagal");
  return objectPath;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  draft:       { label: "Draft",        color: "bg-gray-100 text-gray-600 border-gray-200",           icon: Clock },
  lengkap:     { label: "Lengkap",      color: "bg-emerald-50 text-emerald-700 border-emerald-200",   icon: CheckCircle2 },
  diajukan:    { label: "Diajukan",     color: "bg-blue-50 text-blue-700 border-blue-200",             icon: Send },
  diverifikasi:{ label: "Terverifikasi",color: "bg-violet-50 text-violet-700 border-violet-200",       icon: Award },
  ditolak:     { label: "Perlu Perbaikan",color: "bg-rose-50 text-rose-700 border-rose-200",           icon: XCircle },
};

const JENIS_PKB = ["Seminar","Webinar","Diklatkerja","Workshop","Kursus Online","Pelatihan Mandiri","Lainnya"];
const MODE_OPTIONS = ["Online","Offline","Hybrid"];

const DOC_TYPE_META: Record<string, { label: string; icon: typeof FileText; accept: string }> = {
  surat_undangan: { label: "Surat Undangan", icon: FileText, accept: ".pdf,.jpg,.jpeg,.png" },
  daftar_hadir:   { label: "Daftar Hadir",   icon: Users,    accept: ".pdf,.jpg,.jpeg,.png" },
  foto:           { label: "Foto Dokumentasi",icon: Camera,   accept: ".jpg,.jpeg,.png,.webp" },
  rekaman:        { label: "File Rekaman",    icon: ClipboardList, accept: ".mp4,.mkv,.mov,.pdf" },
  lainnya:        { label: "Dokumen Lain",    icon: FileText, accept: "*" },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}
function fmtTime(d: string) {
  return new Date(d).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── SKK Picker ──────────────────────────────────────────────────────────────

const COMMON_SKK: SkkUnit[] = [
  { skkCode: "F.45.2.0.0.0.0.0.01", skkName: "Menerapkan Keselamatan dan Kesehatan Kerja (K3)", jabkerId: "ahli_k3_konstruksi", jabkerName: "Ahli K3 Konstruksi" },
  { skkCode: "F.45.2.0.0.0.0.0.02", skkName: "Melaksanakan Inspeksi K3 Konstruksi", jabkerId: "ahli_k3_konstruksi", jabkerName: "Ahli K3 Konstruksi" },
  { skkCode: "F.45.2.0.0.0.0.0.05", skkName: "Menangani Situasi Darurat K3", jabkerId: "pengawas_k3_konstruksi", jabkerName: "Pengawas K3" },
  { skkCode: "M.711000.003.01", skkName: "Menghitung Volume Pekerjaan", jabkerId: "quantity_surveyor", jabkerName: "Quantity Surveyor" },
  { skkCode: "M.711000.005.01", skkName: "Menyusun Rencana Anggaran Biaya (RAB)", jabkerId: "quantity_surveyor", jabkerName: "Quantity Surveyor" },
  { skkCode: "M.711000.008.01", skkName: "Mendokumentasikan Kemajuan Pekerjaan", jabkerId: "pengawas_lapangan", jabkerName: "Pengawas Lapangan" },
  { skkCode: "F.45.2.0.1.1.0.76.II.01", skkName: "Mengendalikan Mutu Beton di Lapangan", jabkerId: "pengawas_lapangan", jabkerName: "Pengawas Lapangan" },
  { skkCode: "F.45.2.0.1.0.0.19.III.01", skkName: "Merencanakan Struktur Beton Bertulang", jabkerId: "ahli_struktur", jabkerName: "Ahli Struktur" },
  { skkCode: "F.45.2.0.4.0.0.19.II.03", skkName: "Mengkoordinasikan Desain MEP", jabkerId: "ahli_mekanikal_elektrikal", jabkerName: "Ahli MEP" },
  { skkCode: "M.711000.012.01", skkName: "Menyusun Jadwal Pelaksanaan Pekerjaan", jabkerId: "manajer_proyek", jabkerName: "Manajer Proyek" },
  { skkCode: "M.711000.014.01", skkName: "Mengendalikan Kemajuan Pekerjaan", jabkerId: "manajer_proyek", jabkerName: "Manajer Proyek" },
];

function SkkPicker({ selected, onChange }: { selected: SkkUnit[]; onChange: (v: SkkUnit[]) => void }) {
  const [query, setQuery] = useState("");
  const filtered = query.trim()
    ? COMMON_SKK.filter(s => s.skkCode.includes(query) || s.skkName.toLowerCase().includes(query.toLowerCase()) || (s.jabkerName ?? "").toLowerCase().includes(query.toLowerCase()))
    : COMMON_SKK;

  function toggle(unit: SkkUnit) {
    if (selected.some(s => s.skkCode === unit.skkCode)) {
      onChange(selected.filter(s => s.skkCode !== unit.skkCode));
    } else {
      onChange([...selected, unit]);
    }
  }

  function addCustom() {
    const code = query.trim().toUpperCase();
    if (!code || selected.some(s => s.skkCode === code)) return;
    onChange([...selected, { skkCode: code, skkName: `Unit SKK ${code}` }]);
    setQuery("");
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari kode atau nama unit SKK..." className="text-sm" />
        {query && !COMMON_SKK.some(s => s.skkCode === query.toUpperCase()) && (
          <Button size="sm" variant="outline" onClick={addCustom} className="shrink-0">
            <Plus className="w-3.5 h-3.5 mr-1" /> Tambah
          </Button>
        )}
      </div>
      <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
        {filtered.map(unit => {
          const isSelected = selected.some(s => s.skkCode === unit.skkCode);
          return (
            <button key={unit.skkCode} onClick={() => toggle(unit)}
              className={`w-full text-left flex items-start gap-2.5 px-3 py-2 rounded-xl border text-xs transition-colors ${isSelected ? "bg-primary/8 border-primary/30 text-primary" : "bg-muted/30 border-border hover:border-primary/20"}`}>
              <div className={`w-4 h-4 rounded border shrink-0 mt-0.5 flex items-center justify-center ${isSelected ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
              </div>
              <div>
                <div className="font-mono font-semibold text-[10px]">{unit.skkCode}</div>
                <div className="text-muted-foreground leading-snug">{unit.skkName}</div>
                {unit.jabkerName && <div className="text-[10px] text-primary/70 mt-0.5">{unit.jabkerName}</div>}
              </div>
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border">
          {selected.map(s => (
            <span key={s.skkCode} className="flex items-center gap-1 text-[10px] bg-primary/8 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-mono">
              {s.skkCode.split(".").slice(0,4).join(".")}…
              <button onClick={() => onChange(selected.filter(x => x.skkCode !== s.skkCode))}><X className="w-2.5 h-2.5" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── File Upload Row ──────────────────────────────────────────────────────────

function FileUploadRow({ activityId, docType, existing, onUploaded, onDeleted }: {
  activityId: number; docType: string; existing: ActivityDoc[]; onUploaded: () => void; onDeleted: () => void;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const meta = DOC_TYPE_META[docType] ?? DOC_TYPE_META.lainnya;
  const Icon = meta.icon;
  const docs = existing.filter(d => d.docType === docType);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const objectPath = await uploadFile(file);
      await apiFetch(`/kegiatan/${activityId}/docs`, {
        method: "POST",
        body: JSON.stringify({ docType, filename: file.name, objectPath, mimeType: file.type, sizeBytes: file.size }),
      });
      onUploaded();
      toast({ title: `${meta.label} berhasil diunggah` });
    } catch (err: unknown) {
      toast({ title: "Upload gagal", description: String(err), variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function deleteDoc(docId: number) {
    await apiFetch(`/kegiatan/${activityId}/docs/${docId}`, { method: "DELETE" });
    onDeleted();
    toast({ title: `${meta.label} dihapus` });
  }

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon className="w-4 h-4 text-primary" />
          {meta.label}
          {docs.length > 0 && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{docs.length} file</span>}
        </div>
        <button onClick={() => inputRef.current?.click()} disabled={uploading}
          className="flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline disabled:opacity-50">
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          {uploading ? "Mengunggah..." : "Unggah"}
        </button>
        <input ref={inputRef} type="file" accept={meta.accept} className="hidden" onChange={handleFile} />
      </div>
      {docs.map(d => (
        <div key={d.id} className="flex items-center gap-2 text-xs bg-background rounded-lg border border-border px-3 py-1.5">
          <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="flex-1 truncate text-muted-foreground">{d.filename}</span>
          <a href={`/api/storage${d.objectPath}`} target="_blank" rel="noopener noreferrer"
            className="text-primary hover:underline flex items-center gap-0.5">
            <Eye className="w-3 h-3" /> Lihat
          </a>
          <button onClick={() => deleteDoc(d.id)} className="text-destructive hover:text-destructive/80 ml-1">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Journey Timeline ─────────────────────────────────────────────────────────

function JourneyTimeline({ entries }: { entries: JourneyEntry[] }) {
  if (!entries.length) return (
    <div className="text-center text-xs text-muted-foreground py-6">Belum ada catatan perjalanan</div>
  );

  const eventIcon: Record<string, typeof Clock> = {
    kegiatan_dibuat: Plus, info_diperbarui: Pencil, skk_dipetakan: Tag,
    surat_undangan_diunggah: FileText, daftar_hadir_diunggah: Users,
    foto_diunggah: Camera, link_rekaman_ditambahkan: Link2,
    dokumen_diunggah: Upload, siap_diajukan: CheckCircle2,
    diajukan: Send, diverifikasi: Award, ditolak: XCircle,
  };
  const eventColor: Record<string, string> = {
    kegiatan_dibuat: "bg-blue-100 text-blue-600",
    skk_dipetakan:   "bg-violet-100 text-violet-600",
    diajukan:        "bg-amber-100 text-amber-600",
    diverifikasi:    "bg-emerald-100 text-emerald-600",
    ditolak:         "bg-rose-100 text-rose-600",
  };

  return (
    <div className="relative pl-6">
      <div className="absolute left-2.5 top-0 bottom-0 w-px bg-border" />
      <div className="space-y-4">
        {entries.map((e, i) => {
          const Icon = eventIcon[e.event] ?? Clock;
          const color = eventColor[e.event] ?? "bg-muted text-muted-foreground";
          return (
            <div key={e.id} className="relative flex items-start gap-3">
              <div className={`absolute -left-6 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${color}`}>
                <Icon className="w-2.5 h-2.5" />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-sm font-medium text-foreground leading-snug">{e.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{fmtTime(e.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Activity Form Modal ───────────────────────────────────────────────────────

type FormMode = "create" | "edit";

interface MarketplacePrefill {
  marketplaceId: string;
  courseTitle: string;
  courseProvider: string;
  courseJabkerList: string[];
  courseSkkTagsList: string[];
}

function ActivityFormModal({ mode, initial, prefill, onClose, onSaved }: {
  mode: FormMode; initial?: Activity; prefill?: MarketplacePrefill; onClose: () => void; onSaved: (a: Activity) => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    namaKegiatan:    initial?.namaKegiatan    ?? prefill?.courseTitle    ?? "",
    tanggalMulai:    initial?.tanggalMulai    ?? "",
    tanggalSelesai:  initial?.tanggalSelesai  ?? "",
    tempatKegiatan:  initial?.tempatKegiatan  ?? "",
    modePelaksanaan: initial?.modePelaksanaan ?? "Online",
    namaMateri:      initial?.namaMateri      ?? prefill?.courseTitle    ?? "",
    penyelenggara:   initial?.penyelenggara   ?? prefill?.courseProvider ?? "",
    namaInstruktur:  initial?.namaInstruktur  ?? "",
    jenisPkb:        initial?.jenisPkb        ?? (prefill ? "Kursus Online" : ""),
    jpPkb:           initial?.jpPkb           ?? "",
    uraianSingkat:   initial?.uraianSingkat   ?? "",
    linkRekaman:     initial?.linkRekaman     ?? "",
  });
  const [skk, setSkk] = useState<SkkUnit[]>(initial?.skk ?? []);

  function set(field: string, value: unknown) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function save() {
    if (!form.namaKegiatan || !form.tanggalMulai) {
      toast({ title: "Nama kegiatan dan tanggal wajib diisi", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        jpPkb: form.jpPkb ? Number(form.jpPkb) : undefined,
        // Marketplace link — auto-marks course as watched server-side when present
        ...(prefill ? {
          marketplaceId:    prefill.marketplaceId,
          courseTitle:      prefill.courseTitle,
          courseProvider:   prefill.courseProvider,
          courseJabkerList: prefill.courseJabkerList,
          courseSkkTagsList: prefill.courseSkkTagsList,
        } : {}),
      };
      const activity: Activity = mode === "create"
        ? await apiFetch("/kegiatan", { method: "POST", body: JSON.stringify(payload) })
        : await apiFetch(`/kegiatan/${initial!.id}`, { method: "PATCH", body: JSON.stringify(payload) });

      // Save SKK mapping
      if (skk.length > 0 || mode === "edit") {
        await apiFetch(`/kegiatan/${activity.id}/skk`, { method: "PUT", body: JSON.stringify({ skk }) });
      }
      onSaved({ ...activity, skk });
      toast({ title: mode === "create" ? "Kegiatan berhasil dibuat" : "Kegiatan diperbarui" });
    } catch (err: unknown) {
      toast({ title: "Gagal menyimpan", description: String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const steps = ["Info Dasar", "Materi & SKK", "Deskripsi & Rekaman"];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-background border-l border-border flex flex-col h-full shadow-2xl animate-in slide-in-from-right-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-bold text-base">{mode === "create" ? "Tambah Kegiatan PKB" : "Edit Kegiatan"}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Dokumentasikan bukti belajar Anda</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step tabs */}
        <div className="flex border-b border-border shrink-0">
          {steps.map((s, i) => (
            <button key={i} onClick={() => setStep(i)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${step === i ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
              {i + 1}. {s}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {step === 0 && (
            <>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  1. Nama Kegiatan <span className="text-destructive">*</span>
                </label>
                <Input value={form.namaKegiatan} onChange={e => set("namaKegiatan", e.target.value)}
                  placeholder="e.g. Webinar K3 Konstruksi — Pencegahan Jatuh dari Ketinggian" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                    2. Tanggal Mulai <span className="text-destructive">*</span>
                  </label>
                  <Input type="date" value={form.tanggalMulai} onChange={e => set("tanggalMulai", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Tanggal Selesai</label>
                  <Input type="date" value={form.tanggalSelesai} onChange={e => set("tanggalSelesai", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">3. Tempat Kegiatan</label>
                <Input value={form.tempatKegiatan} onChange={e => set("tempatKegiatan", e.target.value)}
                  placeholder="e.g. Zoom Meeting / Gedung BPSDM Jakarta" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MODE_OPTIONS.map(m => (
                  <button key={m} onClick={() => set("modePelaksanaan", m)}
                    className={`py-2 rounded-xl border text-xs font-medium transition-colors ${form.modePelaksanaan === m ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"}`}>
                    {m}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Jenis PKB</label>
                  <select value={form.jenisPkb} onChange={e => set("jenisPkb", e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">Pilih jenis...</option>
                    {JENIS_PKB.map(j => <option key={j} value={j}>{j}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">JP PKB</label>
                  <Input type="number" min="1" value={form.jpPkb} onChange={e => set("jpPkb", e.target.value)}
                    placeholder="Jam pelajaran" />
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  4. Nama Materi / Modul
                </label>
                <Input value={form.namaMateri} onChange={e => set("namaMateri", e.target.value)}
                  placeholder="e.g. Modul K3 Dasar — Standar PUPR & BNSP" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Penyelenggara</label>
                  <Input value={form.penyelenggara} onChange={e => set("penyelenggara", e.target.value)}
                    placeholder="e.g. Kemnaker Diklatkerja" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Nama Instruktur</label>
                  <Input value={form.namaInstruktur} onChange={e => set("namaInstruktur", e.target.value)}
                    placeholder="e.g. Ir. Hendra, M.T." />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  5. Mapping Unit SKK
                </label>
                <SkkPicker selected={skk} onChange={setSkk} />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  8. Uraian Singkat Materi / Modul
                </label>
                <textarea
                  value={form.uraianSingkat} onChange={e => set("uraianSingkat", e.target.value)}
                  rows={5} placeholder="Tuliskan apa yang Anda pelajari, topik utama, dan relevansinya dengan pekerjaan Anda sebagai TKK..."
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  10. Link Rekaman
                </label>
                <Input value={form.linkRekaman} onChange={e => set("linkRekaman", e.target.value)}
                  placeholder="https://youtube.com/... atau link Google Drive" type="url" />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0 bg-muted/20">
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)}>← Kembali</Button>
            )}
          </div>
          <div className="flex gap-2">
            {step < steps.length - 1 ? (
              <Button size="sm" onClick={() => setStep(s => s + 1)}>Lanjut →</Button>
            ) : (
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Menyimpan...</> : <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Simpan Kegiatan</>}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Activity Detail Panel ─────────────────────────────────────────────────────

function ActivityDetail({ activity, onClose, onEdit, onDeleted }: {
  activity: Activity; onClose: () => void; onEdit: () => void; onDeleted: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<"info"|"dokumen"|"journey">("info");
  const [submitting, setSubmitting] = useState(false);

  const { data: full, refetch } = useQuery<Activity>({
    queryKey: ["kegiatan-detail", activity.id],
    queryFn: () => apiFetch(`/kegiatan/${activity.id}`),
    initialData: activity,
    staleTime: 30 * 1000,
  });

  const s = STATUS_META[full.status] ?? STATUS_META.draft;
  const SIcon = s.icon;

  async function submit() {
    setSubmitting(true);
    try {
      await apiFetch(`/kegiatan/${full.id}/ajukan`, { method: "POST" });
      toast({ title: full.status === "ditolak" ? "Dokumentasi diajukan ulang ke Asosiasi" : "Dokumentasi berhasil diajukan ke Asosiasi" });
      queryClient.invalidateQueries({ queryKey: ["kegiatan"] });
      refetch();
    } catch (err: unknown) {
      toast({ title: "Gagal mengajukan", description: String(err), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const [suggestingSkk, setSuggestingSkk] = useState(false);
  interface SkkSuggestion { skkCode: string; skkName: string; jabkerName?: string }
  const [skkSuggestions, setSkkSuggestions] = useState<SkkSuggestion[]>([]);

  async function suggestSkk() {
    setSuggestingSkk(true);
    setSkkSuggestions([]);
    try {
      const result = await apiFetch<{ suggestions: SkkSuggestion[] }>(`/kegiatan/${full.id}/suggest-skk`, { method: "POST" });
      setSkkSuggestions(result.suggestions ?? []);
      if ((result.suggestions ?? []).length === 0) {
        toast({ title: "Tidak ada saran SKK", description: "Lengkapi nama materi atau uraian kegiatan terlebih dahulu." });
      }
    } catch (err: unknown) {
      toast({ title: "Gagal mendapatkan saran", description: String(err), variant: "destructive" });
    } finally {
      setSuggestingSkk(false);
    }
  }

  async function addSuggestedSkk(s: SkkSuggestion) {
    const existing: SkkUnit[] = full.skk ?? [];
    if (existing.some(u => u.skkCode === s.skkCode)) return;
    const updated = [...existing, { skkCode: s.skkCode, skkName: s.skkName, jabkerName: s.jabkerName }];
    try {
      await apiFetch(`/kegiatan/${full.id}/skk`, { method: "PUT", body: JSON.stringify({ skk: updated }) });
      queryClient.invalidateQueries({ queryKey: ["kegiatan"] });
      refetch();
      setSkkSuggestions(prev => prev.filter(x => x.skkCode !== s.skkCode));
    } catch (err: unknown) {
      toast({ title: "Gagal menambah SKK", description: String(err), variant: "destructive" });
    }
  }

  const deleteMut = useMutation({
    mutationFn: () => apiFetch(`/kegiatan/${full.id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["kegiatan"] }); onDeleted(); },
  });

  const allDocs = full.docs ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="flex-1" onClick={onClose} />
      <div className="w-full max-w-lg bg-background border-l border-border flex flex-col shadow-2xl animate-in slide-in-from-right-4 duration-200 h-full">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border mb-2 ${s.color}`}>
                <SIcon className="w-2.5 h-2.5" />{s.label}
              </span>
              <h2 className="font-bold text-base leading-snug line-clamp-2">{full.namaKegiatan}</h2>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(full.tanggalMulai)}</span>
                {full.tempatKegiatan && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{full.tempatKegiatan}</span>}
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              {full.status !== "diverifikasi" && (
                <button onClick={onEdit} className="w-8 h-8 rounded-full border border-border hover:bg-muted flex items-center justify-center">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          {([["info","Info"], ["dokumen","Dokumen (6,7,9)"], ["journey","Journey (11)"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${tab === id ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {tab === "info" && (
            <>
              {/* Rejection notice (from Asosiasi / Tim Verifikasi) */}
              {full.status === "ditolak" && full.askomNote && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 uppercase tracking-wide">
                    <XCircle className="w-3.5 h-3.5" /> Catatan Verifikasi
                  </div>
                  <p className="text-sm text-rose-800 leading-relaxed">{full.askomNote}</p>
                  <p className="text-xs text-rose-600 mt-1">Perbaiki dokumentasi sesuai catatan di atas.</p>
                </div>
              )}
              {/* Verified notice */}
              {full.status === "diverifikasi" && full.askomNote && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                    <Award className="w-3.5 h-3.5" /> Catatan Verifikasi
                  </div>
                  <p className="text-sm text-emerald-800 leading-relaxed">{full.askomNote}</p>
                </div>
              )}

              {full.namaMateri && (
                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <BookOpen className="w-3.5 h-3.5" /> Materi / Modul (4)
                  </div>
                  <p className="text-sm font-semibold">{full.namaMateri}</p>
                  {full.penyelenggara && <p className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="w-3 h-3" />{full.penyelenggara}</p>}
                  {full.namaInstruktur && <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" />{full.namaInstruktur}</p>}
                </div>
              )}

              {/* SKK Mapping section — always shown so user can add/suggest */}
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <Tag className="w-3.5 h-3.5" /> Mapping SKK (5) — {(full.skk ?? []).length} unit
                  </div>
                  {full.status !== "diverifikasi" && (
                    <button
                      onClick={suggestSkk}
                      disabled={suggestingSkk}
                      className="flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-700 disabled:opacity-50"
                    >
                      {suggestingSkk
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Sparkles className="w-3 h-3" />}
                      Saran dari AI
                    </button>
                  )}
                </div>

                {(full.skk ?? []).length > 0 && (
                  <div className="space-y-1.5">
                    {(full.skk ?? []).map(s => (
                      <div key={s.skkCode} className="flex items-start gap-2 text-xs">
                        <span className="font-mono bg-primary/8 text-primary px-2 py-0.5 rounded-full shrink-0 text-[10px]">{s.skkCode.split(".").slice(0,4).join(".")}…</span>
                        <span className="text-muted-foreground">{s.skkName}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* AI suggestions */}
                {skkSuggestions.length > 0 && (
                  <div className="space-y-2 pt-1 border-t border-dashed border-border">
                    <p className="text-[10px] font-semibold text-violet-600 uppercase tracking-wide flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Saran AI — klik untuk menambahkan
                    </p>
                    {skkSuggestions.map(s => (
                      <button
                        key={s.skkCode}
                        onClick={() => addSuggestedSkk(s)}
                        className="w-full text-left flex items-start gap-2 text-xs p-2 rounded-lg border border-violet-200 bg-violet-50 hover:bg-violet-100 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5 text-violet-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-mono text-[10px] text-violet-600">{s.skkCode.split(".").slice(0,4).join(".")}…</span>
                          <span className="ml-2 text-muted-foreground">{s.skkName}</span>
                          {s.jabkerName && <span className="block text-[10px] text-violet-400 mt-0.5">{s.jabkerName}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {(full.skk ?? []).length === 0 && skkSuggestions.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Belum ada unit SKK. Klik "Saran dari AI" untuk pemetaan otomatis.</p>
                )}
              </div>

              {full.uraianSingkat && (
                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <ClipboardList className="w-3.5 h-3.5" /> Uraian Singkat (8)
                  </div>
                  <p className="text-sm leading-relaxed">{full.uraianSingkat}</p>
                </div>
              )}

              {full.linkRekaman && (
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    <Link2 className="w-3.5 h-3.5" /> Link Rekaman (10)
                  </div>
                  <a href={full.linkRekaman} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1.5 break-all">
                    <ExternalLink className="w-3 h-3 shrink-0" />{full.linkRekaman}
                  </a>
                </div>
              )}
            </>
          )}

          {tab === "dokumen" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Unggah bukti dokumen kegiatan (field 6, 7, 9). File disimpan di cloud storage.</p>
              {Object.keys(DOC_TYPE_META).map(dt => (
                <FileUploadRow key={dt} activityId={full.id} docType={dt}
                  existing={allDocs} onUploaded={() => refetch()} onDeleted={() => refetch()} />
              ))}
            </div>
          )}

          {tab === "journey" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Jejak waktu otomatis setiap tahapan dokumentasi kegiatan ini (field 11).</p>
              <JourneyTimeline entries={full.journey ?? []} />
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-border shrink-0 bg-muted/20 flex items-center justify-between gap-3">
          <button
            onClick={() => { if (confirm("Hapus kegiatan ini?")) deleteMut.mutate(); }}
            className="text-xs text-destructive hover:text-destructive/80 flex items-center gap-1 font-medium"
            disabled={deleteMut.isPending}>
            <Trash2 className="w-3.5 h-3.5" /> Hapus
          </button>
          <div className="flex gap-2">
            {(full.status === "lengkap" || full.status === "ditolak") && (
              <Button size="sm" onClick={submit} disabled={submitting}
                className={full.status === "ditolak" ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"}>
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                {full.status === "ditolak" ? "Ajukan Ulang" : "Ajukan ke Asosiasi"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Activity Card ─────────────────────────────────────────────────────────────

function ActivityCard({ activity, onClick }: { activity: Activity; onClick: () => void }) {
  const s = STATUS_META[activity.status] ?? STATUS_META.draft;
  const SIcon = s.icon;
  return (
    <button onClick={onClick}
      className="group w-full text-left rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors flex-1">
          {activity.namaKegiatan}
        </h3>
        <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${s.color}`}>
          <SIcon className="w-2.5 h-2.5" />{s.label}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(activity.tanggalMulai)}</span>
        {activity.tempatKegiatan && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{activity.tempatKegiatan}</span>}
        {activity.jenisPkb && <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{activity.jenisPkb}</span>}
        {activity.jpPkb && <span className="flex items-center gap-1"><Award className="w-3 h-3" />{activity.jpPkb} JP</span>}
      </div>
      {activity.skk && activity.skk.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {activity.skk.slice(0, 3).map(s => (
            <span key={s.skkCode} className="text-[10px] font-mono bg-primary/8 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
              {s.skkCode.split(".").slice(0, 4).join(".")}…
            </span>
          ))}
          {activity.skk.length > 3 && <span className="text-[10px] text-muted-foreground">+{activity.skk.length - 3}</span>}
        </div>
      )}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {(activity.docCount ?? 0) > 0
            ? `${activity.docCount} dokumen diunggah`
            : "Belum ada dokumen"}
        </span>
        <span className="text-primary font-medium flex items-center gap-0.5">
          Buka <ChevronRight className="w-3 h-3" />
        </span>
      </div>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KegiatanPage() {
  const [showForm, setShowForm] = useState(false);
  const [editActivity, setEditActivity] = useState<Activity | null>(null);
  const [detailActivity, setDetailActivity] = useState<Activity | null>(null);
  const [marketplacePrefill, setMarketplacePrefill] = useState<MarketplacePrefill | undefined>(undefined);
  const queryClient = useQueryClient();

  // If the user navigated here from the marketplace "Catat ke PKB" button, open
  // the create form pre-filled with the course data stored in sessionStorage.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("KEGIATAN_FROM_MARKETPLACE");
      if (raw) {
        sessionStorage.removeItem("KEGIATAN_FROM_MARKETPLACE");
        const data = JSON.parse(raw) as MarketplacePrefill;
        if (data?.marketplaceId && data?.courseTitle) {
          setMarketplacePrefill(data);
          setShowForm(true);
        }
      }
    } catch {}
  }, []);

  const { data: activities = [], isLoading } = useQuery<Activity[]>({
    queryKey: ["kegiatan"],
    queryFn: () => apiFetch("/kegiatan"),
    staleTime: 30 * 1000,
  });

  const totalJp  = activities.reduce((s, a) => s + (a.jpPkb ?? 0), 0);
  const totalSkk = new Set(activities.flatMap(a => a.skk.map(s => s.skkCode))).size;
  const totalDocs= activities.reduce((s, a) => s + (a.docCount ?? 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/sessions">
            <button className="w-8 h-8 rounded-xl border border-border hover:bg-muted flex items-center justify-center">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" /> Dokumentasi Kegiatan PKB
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Catat setiap kegiatan belajar — webinar, diklatkerja, kursus — sebagai bukti PKB formal
            </p>
          </div>
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="w-4 h-4 mr-1.5" /> Tambah Kegiatan
          </Button>
        </div>

        {/* Stats */}
        {activities.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: "Total Kegiatan",    value: activities.length,                               color: "text-primary",   bg: "bg-primary/8" },
              { label: "Total JP PKB",      value: `${totalJp} JP`,                                color: "text-amber-600", bg: "bg-amber-50" },
              { label: "Unit SKK",          value: `${totalSkk} unit`,                             color: "text-violet-600",bg: "bg-violet-50" },
              { label: "Dokumen Diunggah",  value: `${totalDocs} file`,                            color: "text-emerald-600",bg:"bg-emerald-50" },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-2xl p-3 text-center`}>
                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Status filter chips */}
        {activities.length > 0 && (
          <div className="flex gap-2 mb-5 flex-wrap">
            {Object.entries(STATUS_META).map(([key, meta]) => {
              const count = activities.filter(a => a.status === key).length;
              if (!count) return null;
              const Icon = meta.icon;
              return (
                <span key={key} className={`flex items-center gap-1 text-xs px-3 py-1 rounded-full border ${meta.color}`}>
                  <Icon className="w-3 h-3" />{meta.label}: {count}
                </span>
              );
            })}
          </div>
        )}

        {/* Activity list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Memuat kegiatan...
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <ClipboardList className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Belum ada kegiatan PKB</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Mulai dokumentasikan webinar, diklatkerja, atau kursus yang Anda ikuti. Setiap kegiatan menjadi bukti formal untuk sertifikasi SKK Anda.
              </p>
            </div>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Tambah Kegiatan Pertama
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activities.map(a => (
              <ActivityCard key={a.id} activity={a} onClick={() => setDetailActivity(a)} />
            ))}
          </div>
        )}

        {/* Info box */}
        {activities.length > 0 && (
          <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-4 flex gap-3">
            <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-primary/80 leading-relaxed">
              <strong className="text-primary">Tip:</strong> Gunakan tombol <strong>Saran dari AI</strong> di setiap kegiatan untuk pemetaan SKK otomatis. Setelah status "Lengkap", kegiatan siap untuk diverifikasi oleh Asosiasi. Pak Budi juga dapat membaca daftar kegiatan Anda saat wawancara Exum untuk membantu menulis bukti PKB yang lebih kuat.
            </div>
          </div>
        )}

      </div>

      {/* Modals */}
      {showForm && (
        <ActivityFormModal mode="create" prefill={marketplacePrefill} onClose={() => { setShowForm(false); setMarketplacePrefill(undefined); }}
          onSaved={(a) => {
            queryClient.invalidateQueries({ queryKey: ["kegiatan"] });
            setShowForm(false);
            setMarketplacePrefill(undefined);
            setDetailActivity(a);
          }} />
      )}
      {editActivity && (
        <ActivityFormModal mode="edit" initial={editActivity} onClose={() => setEditActivity(null)}
          onSaved={(a) => {
            queryClient.invalidateQueries({ queryKey: ["kegiatan"] });
            setEditActivity(null);
            setDetailActivity(a);
          }} />
      )}
      {detailActivity && (
        <ActivityDetail activity={detailActivity} onClose={() => setDetailActivity(null)}
          onEdit={() => { setEditActivity(detailActivity); setDetailActivity(null); }}
          onDeleted={() => setDetailActivity(null)} />
      )}
    </div>
  );
}
