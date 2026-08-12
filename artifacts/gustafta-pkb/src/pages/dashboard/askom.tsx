/**
 * Panel Tim Verifikasi Internal (Admin Only)
 *
 * Digunakan oleh admin Gustafta untuk meninjau kegiatan PKB yang diajukan.
 * SKK mapping dilakukan otomatis oleh platform AI — panel ini hanya untuk
 * verifikasi kelengkapan dokumen formal.
 *
 * Catatan regulasi: ASKOM (Asesor BNSP) tidak boleh melakukan review PKB
 * di luar skema uji kompetensi formal. Panel ini khusus admin Gustafta.
 *
 * Role yang bisa akses: "admin" saja.
 */

import { useState } from "react";
import { useUser } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  listAskomSubmissions, getAskomSubmission, verifyAskomSubmission, rejectAskomSubmission,
  type AskomSubmission, type AskomSubmissionFull,
} from "@/lib/api-askom";
import {
  CheckCircle2, XCircle, ChevronRight, ArrowLeft, FileText,
  User, Calendar, Award, Loader2, AlertCircle, ExternalLink,
} from "lucide-react";

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; cls: string }> = {
  diajukan:     { label: "Menunggu Verifikasi",     cls: "bg-amber-100 text-amber-700 border-amber-200" },
  diverifikasi: { label: "Disetujui Tim Verifikasi", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  ditolak:      { label: "Perlu Perbaikan",          cls: "bg-rose-100 text-rose-700 border-rose-200" },
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

function SubmissionCard({
  sub, onClick,
}: { sub: AskomSubmission; onClick: () => void }) {
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
            {sub.ownerName} · {sub.ownerEmail}
          </p>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {sub.namaMateri && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <FileText className="w-3 h-3" /> {sub.namaMateri}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {date}
            </span>
            {sub.skk.length > 0 && (
              <span className="text-[11px] text-indigo-600 flex items-center gap-1">
                <Award className="w-3 h-3" /> {sub.skk.length} unit SKK
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-1" />
      </div>
    </button>
  );
}

// ─── Verification detail panel ────────────────────────────────────────────────

function VerifyPanel({
  id, onBack,
}: { id: number; onBack: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [action, setAction] = useState<"verify" | "reject" | null>(null);

  const { data: sub, isLoading } = useQuery<AskomSubmissionFull>({
    queryKey: ["askom-submission", id],
    queryFn: () => getAskomSubmission(id),
  });

  const verifyMut = useMutation({
    mutationFn: () => verifyAskomSubmission(id, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["askom-submissions"] });
      qc.invalidateQueries({ queryKey: ["askom-submission", id] });
      setAction(null);
    },
  });

  const rejectMut = useMutation({
    mutationFn: () => rejectAskomSubmission(id, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["askom-submissions"] });
      qc.invalidateQueries({ queryKey: ["askom-submission", id] });
      setAction(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">Tidak ditemukan.</div>
    );
  }

  const isPending = verifyMut.isPending || rejectMut.isPending;
  const alreadyDecided = sub.status !== "diajukan";

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-6 py-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{sub.namaKegiatan}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <StatusBadge status={sub.status} />
            <span className="text-xs text-muted-foreground">{sub.ownerName}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Scope reminder */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
          <p className="font-semibold mb-0.5">Tim Verifikasi Internal</p>
          <p>Verifikasi <strong>kesesuaian materi/modul</strong> dengan SKK (jabatan kerja + jenjang). Bukan menilai kualitas konten atau profil peserta.</p>
        </div>

        {/* Activity info */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detail Kegiatan</h3>
          <div className="bg-card border border-border rounded-xl p-4 space-y-2 text-sm">
            {sub.namaMateri && <Row label="Materi / Modul" value={sub.namaMateri} />}
            {sub.penyelenggara && <Row label="Penyelenggara" value={sub.penyelenggara} />}
            {sub.namaInstruktur && <Row label="Instruktur" value={sub.namaInstruktur} />}
            {sub.jenisPkb && <Row label="Jenis PKB" value={`${sub.jenisPkb}${sub.jpPkb ? ` · ${sub.jpPkb} JP` : ""}`} />}
            <Row label="Tanggal" value={`${sub.tanggalMulai}${sub.tanggalSelesai && sub.tanggalSelesai !== sub.tanggalMulai ? ` s/d ${sub.tanggalSelesai}` : ""}`} />
            {sub.tempatKegiatan && <Row label="Tempat" value={`${sub.tempatKegiatan}${sub.modePelaksanaan ? ` (${sub.modePelaksanaan})` : ""}`} />}
            {sub.uraianSingkat && <Row label="Uraian" value={sub.uraianSingkat} />}
            {sub.linkRekaman && (
              <div className="flex gap-2 text-sm">
                <span className="text-muted-foreground w-32 shrink-0">Rekaman</span>
                <a href={sub.linkRekaman} target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1">
                  Buka <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        </section>

        {/* Peserta info */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Peserta</h3>
          <div className="bg-card border border-border rounded-xl p-4 text-sm space-y-2">
            <Row label="Nama" value={sub.ownerName} />
            <Row label="Email" value={sub.ownerEmail} />
          </div>
        </section>

        {/* SKK units */}
        {sub.skk.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Unit SKK yang Dipetakan ({sub.skk.length})
            </h3>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {sub.skk.map((s, i) => (
                <div key={s.id} className={`px-4 py-3 text-sm ${i < sub.skk.length - 1 ? "border-b border-border" : ""}`}>
                  <p className="font-mono text-[11px] text-indigo-600">{s.skkCode}</p>
                  <p className="text-foreground font-medium mt-0.5">{s.skkName}</p>
                  {(s.jabkerName || s.jabkerId) && (
                    <p className="text-xs text-muted-foreground mt-0.5">{s.jabkerName ?? s.jabkerId}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Documents */}
        {sub.docs.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Dokumen ({sub.docs.length})
            </h3>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {sub.docs.map((d, i) => (
                <a
                  key={d.id}
                  href={`/api/storage${d.objectPath}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors ${i < sub.docs.length - 1 ? "border-b border-border" : ""}`}
                >
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{d.filename}</p>
                    <p className="text-xs text-muted-foreground">{d.docType}{d.caption ? ` · ${d.caption}` : ""}</p>
                  </div>
                  <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Existing ASKOM verdict */}
        {alreadyDecided && sub.askomNote && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Catatan Verifikasi</h3>
            <div className={`rounded-xl border p-4 text-sm ${sub.status === "diverifikasi" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>
              {sub.askomNote}
            </div>
          </section>
        )}

        {/* Verification form */}
        {!alreadyDecided && (
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Keputusan Tim Verifikasi</h3>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="Catatan kesesuaian SKK — mis. 'Materi ini mencakup elemen K3 yang relevan dengan SKK Mandor Bangunan Gedung Jenjang 4, namun kurang membahas konstruksi atap…'"
              className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-card resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />

            <div className="flex gap-3">
              <button
                onClick={() => { setAction("verify"); verifyMut.mutate(); }}
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
              >
                {verifyMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Setuju — SKK Sesuai
              </button>
              <button
                onClick={() => { setAction("reject"); rejectMut.mutate(); }}
                disabled={isPending || !note.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
              >
                {rejectMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Tolak
              </button>
            </div>
            {!note.trim() && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3 shrink-0" />
                Tulis catatan dulu sebelum menolak. Catatan juga dianjurkan saat menyetujui.
              </p>
            )}

            {(verifyMut.isError || rejectMut.isError) && (
              <p className="text-sm text-rose-600">
                {((verifyMut.error || rejectMut.error) as Error)?.message ?? "Gagal. Coba lagi."}
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-32 shrink-0">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

// ─── Main ASKOM dashboard ──────────────────────────────────────────────────────

export default function AskomDashboard() {
  const { user } = useUser();
  const [, navigate] = useLocation();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("diajukan");

  const { data: submissions = [], isLoading } = useQuery<AskomSubmission[]>({
    queryKey: ["askom-submissions"],
    queryFn: listAskomSubmissions,
  });

  const filtered = filterStatus === "all"
    ? submissions
    : submissions.filter((s) => s.status === filterStatus);

  const counts = {
    diajukan:     submissions.filter((s) => s.status === "diajukan").length,
    diverifikasi: submissions.filter((s) => s.status === "diverifikasi").length,
    ditolak:      submissions.filter((s) => s.status === "ditolak").length,
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard/user")}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <p className="font-semibold text-sm text-foreground">Tim Verifikasi Internal</p>
            <p className="text-[11px] text-muted-foreground">Verifikasi kesesuaian PKB dengan SKK</p>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-foreground">{user?.fullName ?? user?.firstName}</p>
          <p className="text-[11px] text-muted-foreground">Admin Gustafta</p>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden max-w-6xl mx-auto w-full">
        {/* Left — list */}
        <div className={`${selectedId ? "hidden lg:flex" : "flex"} flex-col w-full lg:w-96 border-r border-border`}>
          {/* Filter tabs */}
          <div className="flex gap-1 px-4 py-3 border-b border-border">
            {[
              { key: "diajukan",     label: `Menunggu (${counts.diajukan})` },
              { key: "diverifikasi", label: `Setuju (${counts.diverifikasi})` },
              { key: "ditolak",      label: `Tolak (${counts.ditolak})` },
              { key: "all",          label: "Semua" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterStatus(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterStatus === f.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                {filterStatus === "diajukan" ? "Tidak ada pengajuan yang menunggu." : "Tidak ada data."}
              </div>
            ) : (
              filtered.map((sub) => (
                <SubmissionCard
                  key={sub.id}
                  sub={sub}
                  onClick={() => setSelectedId(sub.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right — detail */}
        <div className={`${selectedId ? "flex" : "hidden lg:flex"} flex-1 flex-col`}>
          {selectedId ? (
            <VerifyPanel
              id={selectedId}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <User className="w-10 h-10 opacity-30" />
              <p className="text-sm">Pilih pengajuan di kiri untuk melihat detail.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
