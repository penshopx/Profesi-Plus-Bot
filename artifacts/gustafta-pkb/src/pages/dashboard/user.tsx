import { useState } from "react";
import { useUser, useClerk } from "@clerk/react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listConversations,
  listProjectBrain,
  createProjectBrain,
  updateProjectBrain,
  deleteProjectBrain,
  PROJECT_BRAIN_KINDS,
  type ProjectBrainEntry,
  type ProjectBrainInput,
} from "@/lib/api";
import {
  LayoutDashboard, MessageSquare, Video, LogOut, Plus,
  CheckCircle2, Briefcase, BookOpen, Layers, Package, ChevronRight,
  Brain, Pencil, Trash2, X, Award, Wrench, UserCircle, Building2,
} from "lucide-react";

const PHASE_LABELS: Record<string, string> = {
  profiling: "Profiling", context: "Konteks", core_interview: "Wawancara",
  evidence: "Bukti", synthesis: "Sintesis", done: "Selesai",
};

const KIND_META: Record<string, { label: string; icon: typeof Brain; color: string }> = {
  project: { label: "Proyek", icon: Briefcase, color: "text-blue-500 bg-blue-50" },
  role: { label: "Peran/Jabatan", icon: Building2, color: "text-violet-500 bg-violet-50" },
  achievement: { label: "Pencapaian", icon: Award, color: "text-amber-500 bg-amber-50" },
  skill: { label: "Keahlian", icon: Wrench, color: "text-emerald-500 bg-emerald-50" },
  profile: { label: "Profil", icon: UserCircle, color: "text-rose-500 bg-rose-50" },
};

const EMPTY_FORM: ProjectBrainInput = {
  kind: "project", title: "", organization: "", role: "", period: "",
  location: "", description: "", skkUnitCodes: "", jenjang: "", highlights: "",
};

export default function DashboardUser() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations"],
    queryFn: listConversations,
  });
  const { data: brain = [] } = useQuery({
    queryKey: ["project-brain"],
    queryFn: listProjectBrain,
  });

  const [editing, setEditing] = useState<ProjectBrainEntry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProjectBrainInput>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["project-brain"] });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (editing) return updateProjectBrain(editing.id, form);
      return createProjectBrain(form);
    },
    onSuccess: () => { invalidate(); closeForm(); },
    onError: (e: Error) => setError(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => deleteProjectBrain(id),
    onSuccess: invalidate,
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  }

  function openEdit(e: ProjectBrainEntry) {
    setEditing(e);
    setForm({
      kind: e.kind, title: e.title, organization: e.organization ?? "",
      role: e.role ?? "", period: e.period ?? "", location: e.location ?? "",
      description: e.description ?? "", skkUnitCodes: e.skkUnitCodes ?? "",
      jenjang: e.jenjang ?? "", highlights: e.highlights ?? "",
    });
    setError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  const done = conversations.filter((c) => c.phase === "done").length;
  const active = conversations.filter((c) => c.phase !== "done").length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <LayoutDashboard className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">Gustafta PKB</p>
            <p className="text-[11px] text-muted-foreground">Dashboard Peserta</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-foreground">{user?.fullName ?? user?.firstName}</p>
            <p className="text-[11px] text-muted-foreground">{user?.primaryEmailAddress?.emailAddress}</p>
          </div>
          <button
            onClick={() => signOut({ redirectUrl: "/" })}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Keluar"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Selamat datang, {user?.firstName ?? "Peserta"} 👋
          </h1>
          <p className="text-muted-foreground mt-1">Pantau progress sertifikasi PKB Anda</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Sesi", value: conversations.length, icon: MessageSquare, color: "text-blue-500 bg-blue-50" },
            { label: "Selesai (Exum)", value: done, icon: CheckCircle2, color: "text-green-500 bg-green-50" },
            { label: "Sedang Berjalan", value: active, icon: Layers, color: "text-amber-500 bg-amber-50" },
            { label: "Otak Proyek", value: brain.length, icon: Brain, color: "text-violet-500 bg-violet-50" },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
                <s.icon className="w-4.5 h-4.5" />
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate("/sessions?new=1")}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> Buat Sesi Baru
          </button>
          <button
            onClick={() => navigate("/videos")}
            className="flex items-center gap-2 bg-muted text-muted-foreground px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-muted/80 transition-colors"
          >
            <Video className="w-4 h-4" /> Video Library
          </button>
        </div>

        {/* Otak Proyek (Project Brain) */}
        <section>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-500 flex items-center justify-center shrink-0">
                <Brain className="w-4.5 h-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Otak Proyek</h2>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-lg">
                  Rekam jejak proyek, peran & pencapaian Anda. Pak Budi mengingatnya di
                  setiap sesi — wawancara jadi lebih personal dan Exum lebih kuat.
                </p>
              </div>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 bg-violet-500 text-white px-3 py-2 rounded-xl text-xs font-semibold hover:bg-violet-600 transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah
            </button>
          </div>

          {brain.length === 0 ? (
            <div className="border border-dashed border-border rounded-2xl p-8 text-center">
              <Brain className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Belum ada memori karier. Tambahkan proyek atau pengalaman pertama Anda.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {brain.map((e) => {
                const meta = KIND_META[e.kind] ?? KIND_META.project;
                const Icon = meta.icon;
                const sub = [e.role, e.organization, e.period, e.location].filter(Boolean).join(" · ");
                return (
                  <div key={e.id} className="bg-card border border-border rounded-2xl p-4 group">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">{meta.label}</span>
                          {!e.isActive && (
                            <span className="text-[10px] text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded">nonaktif</span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-foreground truncate">{e.title}</p>
                        {sub && <p className="text-[11px] text-muted-foreground truncate">{sub}</p>}
                        {e.description && (
                          <p className="text-xs text-muted-foreground/80 mt-1.5 line-clamp-3">{e.description}</p>
                        )}
                        {e.skkUnitCodes && (
                          <p className="text-[10px] text-violet-500/80 mt-1.5 truncate">SKK: {e.skkUnitCodes}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Hapus "${e.title}"?`)) delMut.mutate(e.id); }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Session list */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Sesi Terakhir</h2>
          {conversations.length === 0 ? (
            <div className="border border-dashed border-border rounded-2xl p-8 text-center">
              <MessageSquare className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Belum ada sesi. Mulai yang baru!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.slice(0, 10).map((c) => {
                const ModeIcon = c.mode === "A" ? Briefcase : c.mode === "B" ? BookOpen : Layers;
                const modeColor = c.mode === "A" ? "text-blue-500" : c.mode === "B" ? "text-emerald-500" : "text-violet-500";
                return (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/chat/${c.id}`)}
                    className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-colors group"
                  >
                    <ModeIcon className={`w-4 h-4 ${modeColor} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground">{PHASE_LABELS[c.phase] ?? c.phase}</span>
                        {c.jabker && <span className="text-[11px] text-muted-foreground/60 truncate max-w-[120px]">{c.jabker}</span>}
                        {c.evidenceCount > 0 && (
                          <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground/50">
                            <Package className="w-3 h-3" />{c.evidenceCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Project Brain form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeForm}>
          <div
            className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card">
              <h3 className="font-semibold text-foreground">
                {editing ? "Edit Memori" : "Tambah ke Otak Proyek"}
              </h3>
              <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground">Jenis</label>
                <div className="grid grid-cols-5 gap-1.5 mt-1">
                  {PROJECT_BRAIN_KINDS.map((k) => {
                    const m = KIND_META[k];
                    const Icon = m.icon;
                    const sel = form.kind === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, kind: k }))}
                        className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-[10px] font-medium transition-colors ${
                          sel ? "border-violet-500 bg-violet-50 text-violet-600" : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {m.label.split("/")[0]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Field label="Judul *" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} placeholder="cth: Pembangunan Jembatan Kali Brantas" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Peran Anda" value={form.role ?? ""} onChange={(v) => setForm((f) => ({ ...f, role: v }))} placeholder="Site Engineer" />
                <Field label="Organisasi/Proyek" value={form.organization ?? ""} onChange={(v) => setForm((f) => ({ ...f, organization: v }))} placeholder="PT Wijaya Karya" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Periode" value={form.period ?? ""} onChange={(v) => setForm((f) => ({ ...f, period: v }))} placeholder="2021–2023" />
                <Field label="Lokasi" value={form.location ?? ""} onChange={(v) => setForm((f) => ({ ...f, location: v }))} placeholder="Malang, Jawa Timur" />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Deskripsi</label>
                <textarea
                  value={form.description ?? ""}
                  onChange={(ev) => setForm((f) => ({ ...f, description: ev.target.value }))}
                  rows={3}
                  placeholder="Ruang lingkup, tanggung jawab, dan konteks singkat."
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Capaian Kunci (angka konkret)</label>
                <textarea
                  value={form.highlights ?? ""}
                  onChange={(ev) => setForm((f) => ({ ...f, highlights: ev.target.value }))}
                  rows={2}
                  placeholder="cth: Hemat biaya 12%, zero accident 18 bulan, percepatan jadwal 30 hari."
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Unit SKK terkait" value={form.skkUnitCodes ?? ""} onChange={(v) => setForm((f) => ({ ...f, skkUnitCodes: v }))} placeholder="M.71.xxx, M.71.yyy" />
                <Field label="Jenjang" value={form.jenjang ?? ""} onChange={(v) => setForm((f) => ({ ...f, jenjang: v }))} placeholder="Jenjang 8" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border sticky bottom-0 bg-card">
              <button onClick={closeForm} className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                Batal
              </button>
              <button
                onClick={() => { setError(null); if (!form.title.trim()) { setError("Judul wajib diisi."); return; } saveMut.mutate(); }}
                disabled={saveMut.isPending}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-violet-500 text-white hover:bg-violet-600 transition-colors disabled:opacity-50"
              >
                {saveMut.isPending ? "Menyimpan…" : editing ? "Simpan" : "Tambah"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
      />
    </div>
  );
}
