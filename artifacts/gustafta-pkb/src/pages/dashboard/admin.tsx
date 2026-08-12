import { useClerk, useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  LayoutDashboard, LogOut, Users, Video, MessageSquare,
  CheckCircle2, ChevronDown, Search, BookOpen, Plus, Pencil, Trash2, X, Sparkles, Award,
  ClipboardList, ChevronUp, ToggleLeft, ToggleRight, AlertCircle,
} from "lucide-react";
import {
  listAllUsers, updateUserRole, listVideos, type VideoItem, type DbUser,
  listKnowledgeBase, createKnowledgeEntry, updateKnowledgeEntry, deleteKnowledgeEntry,
  seedKnowledgeBase, KB_CATEGORIES, type KbEntry, type KbInput,
} from "@/lib/api";
import {
  listAdminQuizzes, adminCreateQuiz, adminUpdateQuiz, adminDeleteQuiz, adminGenerateQuestions,
  type QuizFullAdmin, type QuizQuestionAdmin, type QuizCreateInput,
} from "@/lib/api-profile";

const ROLE_LABELS: Record<string, string> = {
  user: "Peserta",
  instruktur: "Instruktur",
  lembaga_diklat: "Lembaga Diklat",
  askom: "Tim Verifikasi",
  asosiasi: "Asosiasi",
  admin: "Admin",
};

const ROLE_COLORS: Record<string, string> = {
  user: "bg-blue-50 text-blue-600",
  instruktur: "bg-emerald-50 text-emerald-600",
  lembaga_diklat: "bg-violet-50 text-violet-600",
  askom: "bg-orange-50 text-orange-600",
  asosiasi: "bg-cyan-50 text-cyan-600",
  admin: "bg-amber-50 text-amber-600",
};

const JABKER_OPTIONS = [
  "Ahli Teknik Bangunan Gedung", "Ahli Muda Teknik Bangunan Gedung",
  "Ahli Teknik Jalan", "Ahli Muda Teknik Jalan",
  "Ahli Teknik Jembatan", "Ahli Muda Teknik Jembatan",
  "Ahli Teknik Sumber Daya Air", "Pelaksana Lapangan",
];

export default function DashboardAdmin() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"users" | "videos" | "kb" | "quiz">("users");
  const [kbModalOpen, setKbModalOpen] = useState(false);
  const [kbEditing, setKbEditing] = useState<KbEntry | null>(null);
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [quizEditing, setQuizEditing] = useState<QuizFullAdmin | null>(null);

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: listAllUsers,
  });

  const { data: videos = [], isLoading: videosLoading } = useQuery<VideoItem[]>({
    queryKey: ["videos"],
    queryFn: () => listVideos(),
  });

  const roleMut = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) => updateUserRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const { data: kbEntries = [], isLoading: kbLoading } = useQuery<KbEntry[]>({
    queryKey: ["knowledge-base"],
    queryFn: () => listKnowledgeBase(),
  });

  const { data: quizList = [], isLoading: quizLoading } = useQuery<QuizFullAdmin[]>({
    queryKey: ["admin-quizzes"],
    queryFn: listAdminQuizzes,
    enabled: activeTab === "quiz",
  });

  const invalidateKb = () => queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
  const invalidateQuiz = () => queryClient.invalidateQueries({ queryKey: ["admin-quizzes"] });

  const kbCreateMut = useMutation({
    mutationFn: (data: KbInput) => createKnowledgeEntry(data),
    onSuccess: () => { invalidateKb(); setKbModalOpen(false); setKbEditing(null); },
  });
  const kbUpdateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<KbInput> }) => updateKnowledgeEntry(id, data),
    onSuccess: () => { invalidateKb(); setKbModalOpen(false); setKbEditing(null); },
  });
  const kbDeleteMut = useMutation({
    mutationFn: (id: number) => deleteKnowledgeEntry(id),
    onSuccess: invalidateKb,
  });
  const kbSeedMut = useMutation({
    mutationFn: () => seedKnowledgeBase(),
    onSuccess: invalidateKb,
  });

  const quizToggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      adminUpdateQuiz(id, { isActive }),
    onSuccess: invalidateQuiz,
  });
  const quizDeleteMut = useMutation({
    mutationFn: (id: number) => adminDeleteQuiz(id),
    onSuccess: invalidateQuiz,
  });

  const filteredUsers = (users as any[]).filter((u) =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = [
    { label: "Total User", value: (users as any[]).length, icon: Users, color: "text-blue-500 bg-blue-50" },
    { label: "Total Video", value: (videos as any[]).length, icon: Video, color: "text-red-500 bg-red-50" },
    { label: "Instruktur", value: (users as any[]).filter((u) => u.role === "instruktur").length, icon: CheckCircle2, color: "text-emerald-500 bg-emerald-50" },
    { label: "Lembaga Diklat", value: (users as any[]).filter((u) => u.role === "lembaga_diklat").length, icon: MessageSquare, color: "text-violet-500 bg-violet-50" },
    { label: "Tim Verifikasi", value: (users as any[]).filter((u) => u.role === "askom").length, icon: Award, color: "text-orange-500 bg-orange-50" },
    { label: "Asosiasi", value: (users as any[]).filter((u) => u.role === "asosiasi").length, icon: Award, color: "text-cyan-500 bg-cyan-50" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
            <LayoutDashboard className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="font-semibold text-sm">Gustafta PKB</p>
            <p className="text-[11px] text-muted-foreground">Dashboard Admin</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 font-medium">Admin</span>
          <button onClick={() => navigate("/videos")} className="text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground">Video Library</button>
          <button onClick={() => signOut({ redirectUrl: "/" })} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Panel Admin</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Kelola semua pengguna dan konten platform</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
                <s.icon className="w-4.5 h-4.5" />
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border overflow-x-auto">
          {(["users", "videos", "kb", "quiz"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              {tab === "users" ? "Pengguna" : tab === "videos" ? "Video" : tab === "kb" ? "Knowledge Base" : "Kelola Quiz"}
            </button>
          ))}
        </div>

        {activeTab === "users" && (
          <div className="space-y-3">
            <div className="relative max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 pointer-events-none" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama atau email..."
                className="w-full rounded-xl border border-border bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            {usersLoading ? (
              <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}</div>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map((u: any) => (
                  <div key={u.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground">
                      {(u.name || u.email || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.name || "(tanpa nama)"}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] ?? "bg-muted text-muted-foreground"}`}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                    <div className="relative">
                      <select
                        value={u.role}
                        onChange={e => roleMut.mutate({ id: u.id, role: e.target.value })}
                        className="appearance-none bg-muted border border-border rounded-lg pl-2.5 pr-6 py-1.5 text-[11px] font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        {Object.entries(ROLE_LABELS).map(([val, lbl]) => (
                          <option key={val} value={val}>{lbl}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "videos" && (
          <div className="space-y-2">
            {videosLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}</div>
            ) : (videos as any[]).length === 0 ? (
              <div className="border border-dashed border-border rounded-2xl p-8 text-center">
                <Video className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Belum ada video.</p>
              </div>
            ) : (
              (videos as any[]).map((v) => (
                <div key={v.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                  <Video className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{v.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {v.jabker && <span className="text-[11px] text-muted-foreground">{v.jabker}</span>}
                      {v.uploader && <span className="text-[11px] text-muted-foreground/50">oleh {v.uploader.name || v.uploader.role}</span>}
                    </div>
                  </div>
                  <a href={v.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline">Buka</a>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "kb" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-muted-foreground">
                Referensi resmi yang dipakai AI untuk grounding (regulasi, rubrik Exum, panduan).
              </p>
              <div className="flex items-center gap-2">
                {kbEntries.length === 0 && (
                  <button
                    onClick={() => kbSeedMut.mutate()}
                    disabled={kbSeedMut.isPending}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {kbSeedMut.isPending ? "Memuat..." : "Isi data awal"}
                  </button>
                )}
                <button
                  onClick={() => { setKbEditing(null); setKbModalOpen(true); }}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Entri
                </button>
              </div>
            </div>

            {kbLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
            ) : kbEntries.length === 0 ? (
              <div className="border border-dashed border-border rounded-2xl p-8 text-center">
                <BookOpen className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Belum ada entri. Klik "Isi data awal" untuk memuat regulasi & rubrik standar.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {kbEntries.map((e) => (
                  <div key={e.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-start gap-3">
                    <BookOpen className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{e.title}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${KB_CAT_COLORS[e.category] ?? "bg-muted text-muted-foreground"}`}>
                          {KB_CAT_LABELS[e.category] ?? e.category}
                        </span>
                        {!e.isActive && <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">nonaktif</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{e.content}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {e.source && <span className="text-[10px] text-muted-foreground/60">{e.source}</span>}
                        {e.klasifikasi && <span className="text-[10px] text-muted-foreground/60">• {e.klasifikasi}</span>}
                        <span className="text-[10px] text-muted-foreground/60">• prioritas {e.priority}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => { setKbEditing(e); setKbModalOpen(true); }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { if (confirm(`Hapus "${e.title}"?`)) kbDeleteMut.mutate(e.id); }}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Hapus">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "quiz" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-muted-foreground">
                Buat dan kelola quiz untuk berbagai jabatan kerja. AI bisa generate soal otomatis.
              </p>
              <button
                onClick={() => { setQuizEditing(null); setQuizModalOpen(true); }}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="w-3.5 h-3.5" /> Buat Quiz
              </button>
            </div>

            {quizLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
            ) : quizList.length === 0 ? (
              <div className="border border-dashed border-border rounded-2xl p-8 text-center">
                <ClipboardList className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Belum ada quiz. Klik "Buat Quiz" untuk memulai.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {quizList.map((q) => (
                  <div key={q.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-start gap-3">
                    <ClipboardList className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{q.title}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          q.quizType === "learning" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                        }`}>
                          {q.quizType === "learning" ? "Pembelajaran" : "Proficiency"}
                        </span>
                        {!q.isActive && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">nonaktif</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {q.jabker && <span className="text-[11px] text-muted-foreground">{q.jabker}</span>}
                        {q.skkUnitCode && <span className="text-[11px] text-muted-foreground/60">• {q.skkUnitCode}</span>}
                        <span className="text-[11px] text-muted-foreground/60">
                          • {(q.questions as any[])?.length ?? 0} soal • passing {q.passingScore}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => quizToggleMut.mutate({ id: q.id, isActive: !q.isActive })}
                        disabled={quizToggleMut.isPending}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                        title={q.isActive ? "Nonaktifkan" : "Aktifkan"}
                      >
                        {q.isActive
                          ? <ToggleRight className="w-4 h-4 text-emerald-500" />
                          : <ToggleLeft className="w-4 h-4" />
                        }
                      </button>
                      <button
                        onClick={() => { setQuizEditing(q); setQuizModalOpen(true); }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { if (confirm(`Hapus quiz "${q.title}"? Semua data attempt akan tetap ada.`)) quizDeleteMut.mutate(q.id); }}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {kbModalOpen && (
        <KbModal
          entry={kbEditing}
          onClose={() => { setKbModalOpen(false); setKbEditing(null); }}
          onSubmit={(data) => {
            if (kbEditing) kbUpdateMut.mutate({ id: kbEditing.id, data });
            else kbCreateMut.mutate(data);
          }}
          isPending={kbCreateMut.isPending || kbUpdateMut.isPending}
          error={(kbCreateMut.error as Error | null)?.message ?? (kbUpdateMut.error as Error | null)?.message ?? null}
        />
      )}

      {quizModalOpen && (
        <QuizModal
          quiz={quizEditing}
          onClose={() => { setQuizModalOpen(false); setQuizEditing(null); }}
          onSaved={() => { invalidateQuiz(); setQuizModalOpen(false); setQuizEditing(null); }}
        />
      )}
    </div>
  );
}

// ─── KB constants ─────────────────────────────────────────────────────────────

const KB_CAT_LABELS: Record<string, string> = {
  regulasi: "Regulasi",
  rubrik_exum: "Rubrik Exum",
  contoh_exum: "Contoh Exum",
  panduan_skk: "Panduan SKK",
  umum: "Umum",
};

const KB_CAT_COLORS: Record<string, string> = {
  regulasi: "bg-amber-50 text-amber-600",
  rubrik_exum: "bg-emerald-50 text-emerald-600",
  contoh_exum: "bg-blue-50 text-blue-600",
  panduan_skk: "bg-violet-50 text-violet-600",
  umum: "bg-muted text-muted-foreground",
};

// ─── KB Modal ─────────────────────────────────────────────────────────────────

function KbModal({
  entry, onClose, onSubmit, isPending, error,
}: {
  entry: KbEntry | null;
  onClose: () => void;
  onSubmit: (data: KbInput) => void;
  isPending: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState<KbInput>({
    category: entry?.category ?? "regulasi",
    title: entry?.title ?? "",
    content: entry?.content ?? "",
    klasifikasi: entry?.klasifikasi ?? "",
    jenjang: entry?.jenjang ?? "",
    source: entry?.source ?? "",
    tags: entry?.tags ?? "",
    priority: entry?.priority ?? 0,
    isActive: entry?.isActive ?? true,
  });

  const set = <K extends keyof KbInput>(k: K, v: KbInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold text-sm">{entry ? "Edit Entri" : "Tambah Entri Knowledge Base"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Kategori</label>
            <select value={form.category} onChange={(e) => set("category", e.target.value)}
              className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              {KB_CATEGORIES.map((c) => <option key={c} value={c}>{KB_CAT_LABELS[c]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Judul *</label>
            <input value={form.title} onChange={(e) => set("title", e.target.value)}
              className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Isi / Konten *</label>
            <textarea value={form.content} onChange={(e) => set("content", e.target.value)} rows={6}
              className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Klasifikasi (opsional)</label>
              <input value={form.klasifikasi ?? ""} onChange={(e) => set("klasifikasi", e.target.value)} placeholder="Sipil, Arsitektur..."
                className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Jenjang (opsional)</label>
              <input value={form.jenjang ?? ""} onChange={(e) => set("jenjang", e.target.value)} placeholder="7, 8, 9..."
                className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Sumber (opsional)</label>
            <input value={form.source ?? ""} onChange={(e) => set("source", e.target.value)} placeholder="Permen PUPR 12/2021 Pasal..."
              className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Tags (pisah koma, opsional)</label>
            <input value={form.tags ?? ""} onChange={(e) => set("tags", e.target.value)}
              className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Prioritas (0-10)</label>
              <input type="number" value={form.priority ?? 0} onChange={(e) => set("priority", Number(e.target.value))}
                className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <label className="flex items-center gap-2 text-sm pb-2 cursor-pointer">
              <input type="checkbox" checked={form.isActive ?? true} onChange={(e) => set("isActive", e.target.checked)} className="rounded" />
              Aktif (dipakai AI)
            </label>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border sticky bottom-0 bg-card">
          <button onClick={onClose} className="text-xs px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground">Batal</button>
          <button
            onClick={() => onSubmit(form)}
            disabled={isPending || !form.title.trim() || !form.content.trim()}
            className="text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Menyimpan..." : entry ? "Simpan" : "Tambah"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quiz Modal ───────────────────────────────────────────────────────────────

const OPTION_IDS = ["a", "b", "c", "d"];

function emptyQuestion(idx: number): QuizQuestionAdmin {
  return {
    id: `q${idx + 1}`,
    text: "",
    options: OPTION_IDS.map((id) => ({ id, text: "" })),
    correctId: "a",
    explanation: "",
  };
}

function QuizModal({
  quiz, onClose, onSaved,
}: {
  quiz: QuizFullAdmin | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!quiz;
  const [form, setForm] = useState<QuizCreateInput>({
    title: quiz?.title ?? "",
    description: quiz?.description ?? "",
    jabker: quiz?.jabker ?? "",
    skkUnitCode: quiz?.skkUnitCode ?? "",
    skkUnitName: quiz?.skkUnitName ?? "",
    quizType: quiz?.quizType ?? "learning",
    passingScore: quiz?.passingScore ?? 70,
    questions: (quiz?.questions as QuizQuestionAdmin[] | undefined) ?? [],
    isActive: quiz?.isActive ?? true,
  });
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedQ, setExpandedQ] = useState<string | null>(null);

  const setField = <K extends keyof QuizCreateInput>(k: K, v: QuizCreateInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const questions = (form.questions ?? []) as QuizQuestionAdmin[];

  const setQuestions = (qs: QuizQuestionAdmin[]) => setField("questions", qs);

  const handleGenerate = async () => {
    if (!form.jabker) { setGenError("Pilih jabatan kerja terlebih dahulu."); return; }
    setGenerating(true);
    setGenError(null);
    try {
      const result = await adminGenerateQuestions({
        jabker: form.jabker,
        skkUnitCode: form.skkUnitCode || undefined,
        skkUnitName: form.skkUnitName || undefined,
        quizType: form.quizType,
        count: 10,
      });
      setQuestions(result.questions);
      if (!form.title && result.suggestedTitle) {
        setField("title", `Quiz ${result.suggestedTitle}`);
      }
      // Expand first question
      setExpandedQ(result.questions[0]?.id ?? null);
    } catch (err) {
      setGenError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setSaveError("Judul quiz wajib diisi."); return; }
    if (questions.length === 0) { setSaveError("Quiz harus memiliki minimal 1 soal."); return; }
    setSaving(true);
    setSaveError(null);
    try {
      if (isEdit && quiz) {
        await adminUpdateQuiz(quiz.id, form);
      } else {
        await adminCreateQuiz(form);
      }
      onSaved();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const updateQuestion = (qId: string, updater: (q: QuizQuestionAdmin) => QuizQuestionAdmin) => {
    setQuestions(questions.map((q) => (q.id === qId ? updater(q) : q)));
  };

  const deleteQuestion = (qId: string) => {
    setQuestions(questions.filter((q) => q.id !== qId));
    if (expandedQ === qId) setExpandedQ(null);
  };

  const addQuestion = () => {
    const newQ = emptyQuestion(questions.length);
    setQuestions([...questions, newQ]);
    setExpandedQ(newQ.id);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-semibold text-sm">{isEdit ? "Edit Quiz" : "Buat Quiz Baru"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 flex-1">
          {/* ── Basic info ── */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Informasi Quiz</p>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Judul Quiz *</label>
                <input
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  placeholder="Cth: Quiz Teknik Bangunan Gedung — Unit K3"
                  className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Deskripsi (opsional)</label>
                <input
                  value={form.description ?? ""}
                  onChange={(e) => setField("description", e.target.value)}
                  placeholder="Penjelasan singkat tentang quiz ini"
                  className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">Jabatan Kerja *</label>
                  <select
                    value={form.jabker ?? ""}
                    onChange={(e) => setField("jabker", e.target.value)}
                    className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">-- Pilih Jabker --</option>
                    {JABKER_OPTIONS.map((j) => <option key={j} value={j}>{j}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">Tipe Quiz</label>
                  <select
                    value={form.quizType}
                    onChange={(e) => setField("quizType", e.target.value as "learning" | "proficiency")}
                    className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="learning">Pembelajaran (Learning)</option>
                    <option value="proficiency">Proficiency (Pengalaman)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">Kode Unit SKK (opsional)</label>
                  <input
                    value={form.skkUnitCode ?? ""}
                    onChange={(e) => setField("skkUnitCode", e.target.value)}
                    placeholder="Cth: BGN.GAL.001.A"
                    className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">Nama Unit SKK (opsional)</label>
                  <input
                    value={form.skkUnitName ?? ""}
                    onChange={(e) => setField("skkUnitName", e.target.value)}
                    placeholder="Cth: Melaksanakan K3"
                    className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">Passing Score (%)</label>
                  <input
                    type="number" min={0} max={100}
                    value={form.passingScore}
                    onChange={(e) => setField("passingScore", Number(e.target.value))}
                    className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm pb-2 cursor-pointer">
                  <input
                    type="checkbox" checked={form.isActive ?? true}
                    onChange={(e) => setField("isActive", e.target.checked)}
                    className="rounded"
                  />
                  Aktif (tampil ke pengguna)
                </label>
              </div>
            </div>
          </div>

          {/* ── AI Generate ── */}
          <div className="border border-dashed border-amber-300 bg-amber-50/50 rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" /> Generate Soal dengan AI
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  AI akan membuat 10 soal pilihan ganda berkualitas berdasarkan jabker dan unit SKK yang dipilih.
                  Hasil bisa Anda edit sebelum disimpan.
                </p>
              </div>
              <button
                onClick={handleGenerate}
                disabled={generating || !form.jabker}
                className="shrink-0 inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {generating ? "Generating..." : "Generate Soal"}
              </button>
            </div>
            {genError && (
              <div className="flex items-center gap-1.5 text-xs text-red-600">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {genError}
              </div>
            )}
            {generating && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                Sedang membuat soal, mohon tunggu…
              </div>
            )}
          </div>

          {/* ── Questions ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Soal Quiz ({questions.length})
              </p>
              <button
                onClick={addQuestion}
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground"
              >
                <Plus className="w-3 h-3" /> Tambah Soal Manual
              </button>
            </div>

            {questions.length === 0 ? (
              <div className="border border-dashed border-border rounded-xl p-6 text-center">
                <p className="text-xs text-muted-foreground">
                  Belum ada soal. Generate dengan AI atau tambah secara manual.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {questions.map((q, idx) => (
                  <QuestionEditor
                    key={q.id}
                    question={q}
                    index={idx}
                    expanded={expandedQ === q.id}
                    onToggle={() => setExpandedQ(expandedQ === q.id ? null : q.id)}
                    onChange={(updated) => updateQuestion(q.id, () => updated)}
                    onDelete={() => deleteQuestion(q.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {saveError && (
            <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {saveError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border sticky bottom-0 bg-card">
          <button onClick={onClose} className="text-xs px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground">
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.title.trim() || questions.length === 0}
            className="text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Simpan Quiz"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Question Editor ──────────────────────────────────────────────────────────

function QuestionEditor({
  question, index, expanded, onToggle, onChange, onDelete,
}: {
  question: QuizQuestionAdmin;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onChange: (q: QuizQuestionAdmin) => void;
  onDelete: () => void;
}) {
  const setOptionText = (optId: string, text: string) => {
    onChange({
      ...question,
      options: question.options.map((o) => (o.id === optId ? { ...o, text } : o)),
    });
  };

  const previewText = question.text || "(belum ada teks soal)";
  const isComplete = question.text.trim() && question.options.every((o) => o.text.trim()) && question.correctId;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Collapsed header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        <span className="text-[11px] font-bold text-muted-foreground w-5 shrink-0">
          {index + 1}.
        </span>
        <p className="flex-1 text-sm text-foreground line-clamp-1">{previewText}</p>
        <div className="flex items-center gap-2 shrink-0">
          {isComplete
            ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600">lengkap</span>
            : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">belum lengkap</span>
          }
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded hover:bg-red-50 text-red-400"
            title="Hapus soal"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border bg-muted/20">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Teks Soal *</label>
            <textarea
              value={question.text}
              onChange={(e) => onChange({ ...question, text: e.target.value })}
              rows={3}
              placeholder="Tulis pertanyaan di sini..."
              className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Pilihan Jawaban *</label>
            <div className="space-y-2">
              {question.options.map((opt) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${question.id}`}
                    checked={question.correctId === opt.id}
                    onChange={() => onChange({ ...question, correctId: opt.id })}
                    className="shrink-0 accent-primary"
                    title="Tandai sebagai jawaban benar"
                  />
                  <span className="text-xs font-bold text-muted-foreground uppercase w-4">{opt.id}.</span>
                  <input
                    value={opt.text}
                    onChange={(e) => setOptionText(opt.id, e.target.value)}
                    placeholder={`Opsi ${opt.id.toUpperCase()}`}
                    className={`flex-1 rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                      question.correctId === opt.id
                        ? "border-emerald-400 bg-emerald-50"
                        : "border-border bg-background"
                    }`}
                  />
                  {question.correctId === opt.id && (
                    <span className="text-[10px] text-emerald-600 font-medium shrink-0">✓ benar</span>
                  )}
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground">
                Klik radio button di kiri untuk menandai jawaban yang benar.
              </p>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Penjelasan (opsional)</label>
            <textarea
              value={question.explanation ?? ""}
              onChange={(e) => onChange({ ...question, explanation: e.target.value })}
              rows={2}
              placeholder="Mengapa jawaban tersebut benar? Akan ditampilkan setelah pengguna menjawab."
              className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
            />
          </div>
        </div>
      )}
    </div>
  );
}
