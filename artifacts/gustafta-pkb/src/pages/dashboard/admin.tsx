import { useClerk, useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  LayoutDashboard, LogOut, Users, Video, MessageSquare,
  CheckCircle2, ChevronDown, Search, BookOpen, Plus, Pencil, Trash2, X, Sparkles, Award,
  ClipboardList, ChevronUp, ToggleLeft, ToggleRight, AlertCircle, BarChart2, Loader2, ShoppingBag, Download,
  Star,
} from "lucide-react";
import {
  listAllUsers, updateUserRole, listVideos, type VideoItem, type DbUser,
  listKnowledgeBase, createKnowledgeEntry, updateKnowledgeEntry, deleteKnowledgeEntry,
  seedKnowledgeBase, KB_CATEGORIES, type KbEntry, type KbInput,
  adminListMarketplaceCourses, adminCreateMarketplaceCourse,
  adminUpdateMarketplaceCourse, adminDeleteMarketplaceCourse,
  adminCreateAiReview, adminUpdateAiReview, adminDeleteAiReview,
  adminCreateAskomReview, adminUpdateAskomReview, adminDeleteAskomReview,
  type AdminCourse, type AdminCourseInput,
  type AdminAiReview, type AdminAiReviewInput,
  type AdminAskomReview, type AdminAskomReviewInput,
} from "@/lib/api";
import {
  listAdminQuizzes, adminCreateQuiz, adminUpdateQuiz, adminDeleteQuiz, adminGenerateQuestions,
  getAdminQuizStats, getAdminQuizAllStats,
  type QuizFullAdmin, type QuizQuestionAdmin, type QuizCreateInput, type QuizStats, type QuizBulkStat,
} from "@/lib/api-profile";
import { buildQuizStatsCsv } from "@/lib/quiz-stats-csv";

const ROLE_LABELS: Record<string, string> = {
  user: "Peserta",
  instruktur: "Instruktur",
  lembaga_diklat: "Lembaga Diklat",
  asosiasi: "Asosiasi",
  admin: "Admin",
};

const ROLE_COLORS: Record<string, string> = {
  user: "bg-blue-50 text-blue-600",
  instruktur: "bg-emerald-50 text-emerald-600",
  lembaga_diklat: "bg-violet-50 text-violet-600",
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
  const [activeTab, setActiveTab] = useState<"users" | "videos" | "kb" | "quiz" | "marketplace">("users");
  const [kbModalOpen, setKbModalOpen] = useState(false);
  const [kbEditing, setKbEditing] = useState<KbEntry | null>(null);
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [quizEditing, setQuizEditing] = useState<QuizFullAdmin | null>(null);
  const [quizStatsId, setQuizStatsId] = useState<number | null>(null);
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [courseEditing, setCourseEditing] = useState<AdminCourse | null>(null);
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const [aiReviewModal, setAiReviewModal] = useState<{ courseId: string; review: AdminAiReview | null } | null>(null);
  const [askomReviewModal, setAskomReviewModal] = useState<{ courseId: string; review: AdminAskomReview | null } | null>(null);

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

  const { data: quizBulkStats = [] } = useQuery<QuizBulkStat[]>({
    queryKey: ["admin-quiz-all-stats"],
    queryFn: getAdminQuizAllStats,
    enabled: activeTab === "quiz",
  });
  const quizStatsMap = Object.fromEntries(quizBulkStats.map((s) => [s.quizId, s]));

  const invalidateKb = () => queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
  const invalidateQuiz = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-quizzes"] });
    queryClient.invalidateQueries({ queryKey: ["admin-quiz-all-stats"] });
  };

  const { data: marketplaceCourses = [], isLoading: marketplaceLoading } = useQuery<AdminCourse[]>({
    queryKey: ["admin-marketplace-courses"],
    queryFn: adminListMarketplaceCourses,
    enabled: activeTab === "marketplace",
  });
  const invalidateMarketplace = () => queryClient.invalidateQueries({ queryKey: ["admin-marketplace-courses"] });

  const courseCreateMut = useMutation({
    mutationFn: (data: AdminCourseInput) => adminCreateMarketplaceCourse(data),
    onSuccess: () => { invalidateMarketplace(); setCourseModalOpen(false); setCourseEditing(null); },
  });
  const courseUpdateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AdminCourseInput> }) => adminUpdateMarketplaceCourse(id, data),
    onSuccess: () => { invalidateMarketplace(); setCourseModalOpen(false); setCourseEditing(null); },
  });
  const courseDeleteMut = useMutation({
    mutationFn: (id: string) => adminDeleteMarketplaceCourse(id),
    onSuccess: invalidateMarketplace,
  });

  const aiReviewCreateMut = useMutation({
    mutationFn: ({ courseId, data }: { courseId: string; data: AdminAiReviewInput }) =>
      adminCreateAiReview(courseId, data),
    onSuccess: () => { invalidateMarketplace(); setAiReviewModal(null); },
  });
  const aiReviewUpdateMut = useMutation({
    mutationFn: ({ courseId, reviewId, data }: { courseId: string; reviewId: number; data: Partial<AdminAiReviewInput> }) =>
      adminUpdateAiReview(courseId, reviewId, data),
    onSuccess: () => { invalidateMarketplace(); setAiReviewModal(null); },
  });
  const aiReviewDeleteMut = useMutation({
    mutationFn: ({ courseId, reviewId }: { courseId: string; reviewId: number }) =>
      adminDeleteAiReview(courseId, reviewId),
    onSuccess: invalidateMarketplace,
  });

  const askomReviewCreateMut = useMutation({
    mutationFn: ({ courseId, data }: { courseId: string; data: AdminAskomReviewInput }) =>
      adminCreateAskomReview(courseId, data),
    onSuccess: () => { invalidateMarketplace(); setAskomReviewModal(null); },
  });
  const askomReviewUpdateMut = useMutation({
    mutationFn: ({ courseId, reviewId, data }: { courseId: string; reviewId: number; data: Partial<AdminAskomReviewInput> }) =>
      adminUpdateAskomReview(courseId, reviewId, data),
    onSuccess: () => { invalidateMarketplace(); setAskomReviewModal(null); },
  });
  const askomReviewDeleteMut = useMutation({
    mutationFn: ({ courseId, reviewId }: { courseId: string; reviewId: number }) =>
      adminDeleteAskomReview(courseId, reviewId),
    onSuccess: invalidateMarketplace,
  });

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
          {(["users", "videos", "kb", "quiz", "marketplace"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              {tab === "users" ? "Pengguna"
                : tab === "videos" ? "Video"
                : tab === "kb" ? "Knowledge Base"
                : tab === "quiz" ? "Kelola Quiz"
                : "Marketplace"}
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
                        {(() => {
                          const s = quizStatsMap[q.id];
                          if (!s) return null;
                          return (
                            <span className="text-[11px] text-muted-foreground/60">
                              • {s.totalAttempts} percobaan
                              {s.totalAttempts > 0 && <> • rata-rata {s.avgScore}% • lulus {s.passRate}%</>}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setQuizStatsId(q.id)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Statistik"
                      >
                        <BarChart2 className="w-3.5 h-3.5" />
                      </button>
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

        {activeTab === "marketplace" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {marketplaceCourses.length} kursus tersimpan di database
              </p>
              <button
                onClick={() => { setCourseEditing(null); setCourseModalOpen(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Kursus
              </button>
            </div>

            {marketplaceLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}</div>
            ) : marketplaceCourses.length === 0 ? (
              <div className="border border-dashed border-border rounded-2xl p-8 text-center">
                <ShoppingBag className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Belum ada kursus. Klik "Tambah Kursus" untuk mulai.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {marketplaceCourses.map((c) => {
                  const isExpanded = expandedCourseId === c.id;
                  const reviewCount = (c.aiReviews?.length ?? 0) + (c.askomReviews?.length ?? 0);
                  return (
                    <div key={c.id} className="bg-card border border-border rounded-xl overflow-hidden">
                      {/* Course row header */}
                      <div className="px-4 py-3 flex items-center gap-3">
                        <span className="text-xl w-8 text-center">{c.providerLogo ?? "📚"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.title}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {c.provider} · {c.type} · {c.price === "gratis" ? "Gratis" : `Rp ${c.priceIdr?.toLocaleString("id-ID") ?? "–"}`} · urutan {c.sortOrder}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${c.isFeatured ? "bg-amber-50 text-amber-600" : c.isBestSeller ? "bg-emerald-50 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                            {c.isFeatured ? "Featured" : c.isBestSeller ? "Best Seller" : c.isNew ? "Baru" : "Standar"}
                          </span>
                          <button
                            onClick={() => setExpandedCourseId(isExpanded ? null : c.id)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${isExpanded ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"}`}
                            title="Kelola Reviews"
                          >
                            <Star className="w-3 h-3" />
                            <span>{reviewCount}</span>
                          </button>
                          <button
                            onClick={() => { setCourseEditing(c); setCourseModalOpen(true); }}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { if (confirm(`Hapus "${c.title}"? Reviews juga akan terhapus.`)) courseDeleteMut.mutate(c.id); }}
                            disabled={courseDeleteMut.isPending}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Expandable reviews panel */}
                      {isExpanded && (
                        <div className="border-t border-border bg-muted/20 px-4 py-4 space-y-5">

                          {/* ── AI Reviews ── */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                <Star className="w-3 h-3 text-amber-500" /> AI Reviews
                              </p>
                              <button
                                onClick={() => setAiReviewModal({ courseId: c.id, review: null })}
                                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium"
                              >
                                <Plus className="w-3 h-3" /> Tambah
                              </button>
                            </div>
                            {(c.aiReviews ?? []).length === 0 ? (
                              <p className="text-[11px] text-muted-foreground italic">Belum ada AI review.</p>
                            ) : (
                              <div className="space-y-2">
                                {(c.aiReviews ?? []).map((r) => (
                                  <div key={r.id} className="bg-card border border-border rounded-lg px-3 py-2 flex items-start gap-2">
                                    <span className="text-base leading-none mt-0.5">{r.platformIcon}</span>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[11px] font-medium">{r.platform}</span>
                                        <span className="text-[11px] text-amber-600">★ {r.rating}</span>
                                        <span className="text-[10px] text-muted-foreground">{r.relevanceScore}% relevan · {r.reviewedAt}</span>
                                      </div>
                                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{r.comment}</p>
                                    </div>
                                    <div className="flex items-center gap-0.5 shrink-0">
                                      <button onClick={() => setAiReviewModal({ courseId: c.id, review: r })}
                                        className="p-1 rounded hover:bg-muted text-muted-foreground">
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => { if (confirm("Hapus AI review ini?")) aiReviewDeleteMut.mutate({ courseId: c.id, reviewId: r.id }); }}
                                        disabled={aiReviewDeleteMut.isPending}
                                        className="p-1 rounded hover:bg-red-50 text-red-400">
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* ── ASKOM Reviews ── */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                <Award className="w-3 h-3 text-violet-500" /> ASKOM Reviews
                              </p>
                              <button
                                onClick={() => setAskomReviewModal({ courseId: c.id, review: null })}
                                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 font-medium"
                              >
                                <Plus className="w-3 h-3" /> Tambah
                              </button>
                            </div>
                            {(c.askomReviews ?? []).length === 0 ? (
                              <p className="text-[11px] text-muted-foreground italic">Belum ada ASKOM review.</p>
                            ) : (
                              <div className="space-y-2">
                                {(c.askomReviews ?? []).map((r) => (
                                  <div key={r.id} className="bg-card border border-border rounded-lg px-3 py-2 flex items-start gap-2">
                                    <Award className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[11px] font-medium">{r.reviewerName}</span>
                                        <span className="text-[10px] text-muted-foreground">{r.credential}</span>
                                        <span className="text-[11px] text-amber-600">★ {r.rating}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                          r.recommendation === "direkomendasikan" ? "bg-emerald-50 text-emerald-700"
                                          : r.recommendation === "direkomendasikan_dengan_catatan" ? "bg-amber-50 text-amber-700"
                                          : "bg-red-50 text-red-600"
                                        }`}>
                                          {r.recommendation === "direkomendasikan" ? "Direkomendasikan"
                                            : r.recommendation === "direkomendasikan_dengan_catatan" ? "Dengan Catatan"
                                            : "Tidak Direkomendasikan"}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-muted-foreground">{r.institution} · {r.reviewedAt}</p>
                                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{r.comment}</p>
                                    </div>
                                    <div className="flex items-center gap-0.5 shrink-0">
                                      <button onClick={() => setAskomReviewModal({ courseId: c.id, review: r })}
                                        className="p-1 rounded hover:bg-muted text-muted-foreground">
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => { if (confirm("Hapus ASKOM review ini?")) askomReviewDeleteMut.mutate({ courseId: c.id, reviewId: r.id }); }}
                                        disabled={askomReviewDeleteMut.isPending}
                                        className="p-1 rounded hover:bg-red-50 text-red-400">
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                        </div>
                      )}
                    </div>
                  );
                })}
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

      {quizStatsId !== null && (
        <QuizStatsModal quizId={quizStatsId} onClose={() => setQuizStatsId(null)} />
      )}

      {courseModalOpen && (
        <CourseModal
          course={courseEditing}
          onClose={() => { setCourseModalOpen(false); setCourseEditing(null); }}
          onSubmit={(data) => {
            if (courseEditing) courseUpdateMut.mutate({ id: courseEditing.id, data });
            else courseCreateMut.mutate(data as AdminCourseInput);
          }}
          isPending={courseCreateMut.isPending || courseUpdateMut.isPending}
          error={(courseCreateMut.error as Error | null)?.message ?? (courseUpdateMut.error as Error | null)?.message ?? null}
        />
      )}

      {aiReviewModal && (
        <AiReviewModal
          courseId={aiReviewModal.courseId}
          review={aiReviewModal.review}
          onClose={() => setAiReviewModal(null)}
          onSubmit={(data) => {
            if (aiReviewModal.review) {
              aiReviewUpdateMut.mutate({ courseId: aiReviewModal.courseId, reviewId: aiReviewModal.review.id, data });
            } else {
              aiReviewCreateMut.mutate({ courseId: aiReviewModal.courseId, data: data as AdminAiReviewInput });
            }
          }}
          isPending={aiReviewCreateMut.isPending || aiReviewUpdateMut.isPending}
          error={(aiReviewCreateMut.error as Error | null)?.message ?? (aiReviewUpdateMut.error as Error | null)?.message ?? null}
        />
      )}

      {askomReviewModal && (
        <AskomReviewModal
          courseId={askomReviewModal.courseId}
          review={askomReviewModal.review}
          onClose={() => setAskomReviewModal(null)}
          onSubmit={(data) => {
            if (askomReviewModal.review) {
              askomReviewUpdateMut.mutate({ courseId: askomReviewModal.courseId, reviewId: askomReviewModal.review.id, data });
            } else {
              askomReviewCreateMut.mutate({ courseId: askomReviewModal.courseId, data: data as AdminAskomReviewInput });
            }
          }}
          isPending={askomReviewCreateMut.isPending || askomReviewUpdateMut.isPending}
          error={(askomReviewCreateMut.error as Error | null)?.message ?? (askomReviewUpdateMut.error as Error | null)?.message ?? null}
        />
      )}
    </div>
  );
}

// ─── Course Modal ─────────────────────────────────────────────────────────────

function CourseModal({
  course,
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  course: AdminCourse | null;
  onClose: () => void;
  onSubmit: (data: Partial<AdminCourseInput>) => void;
  isPending: boolean;
  error: string | null;
}) {
  const isEdit = course !== null;
  const [form, setForm] = useState<Partial<AdminCourseInput>>({
    id: course?.id ?? "",
    title: course?.title ?? "",
    provider: course?.provider ?? "",
    providerLogo: course?.providerLogo ?? "",
    thumbnail: course?.thumbnail ?? "from-blue-500 to-indigo-500",
    type: course?.type ?? "video",
    price: course?.price ?? "gratis",
    priceIdr: course?.priceIdr ?? undefined,
    url: course?.url ?? "",
    rating: course?.rating ?? 4.5,
    ratingCount: course?.ratingCount ?? 0,
    durationMinutes: course?.durationMinutes ?? 0,
    videoCount: course?.videoCount ?? 0,
    quizCount: course?.quizCount ?? 0,
    hasCertificate: course?.hasCertificate ?? false,
    description: course?.description ?? "",
    isBestSeller: course?.isBestSeller ?? false,
    isFeatured: course?.isFeatured ?? false,
    isNew: course?.isNew ?? false,
    sortOrder: course?.sortOrder ?? 0,
    jabker: course?.jabker ?? [],
  });

  const set = (k: keyof AdminCourseInput, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg my-8 shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-semibold">{isEdit ? "Edit Kursus" : "Tambah Kursus Baru"}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {[
            { label: "ID Kursus *", key: "id" as const, placeholder: "mis. k3-dasar-pupr", disabled: isEdit },
            { label: "Judul *", key: "title" as const, placeholder: "Nama kursus" },
            { label: "Provider *", key: "provider" as const, placeholder: "Nama lembaga" },
            { label: "Logo Provider (emoji)", key: "providerLogo" as const, placeholder: "🏛️" },
            { label: "URL Kursus *", key: "url" as const, placeholder: "https://..." },
            { label: "Thumbnail (Tailwind gradient)", key: "thumbnail" as const, placeholder: "from-blue-500 to-indigo-500" },
          ].map(({ label, key, placeholder, disabled }) => (
            <div key={key}>
              <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
              <input
                value={String(form[key] ?? "")}
                onChange={(e) => set(key, e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              />
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Tipe</label>
              <select value={form.type} onChange={(e) => set("type", e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                {["video", "webinar", "diklatkerja", "modul"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Harga</label>
              <select value={form.price} onChange={(e) => set("price", e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="gratis">Gratis</option>
                <option value="berbayar">Berbayar</option>
              </select>
            </div>
          </div>

          {form.price === "berbayar" && (
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Harga (Rp)</label>
              <input type="number" value={form.priceIdr ?? ""} onChange={(e) => set("priceIdr", Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Rating</label>
              <input type="number" min={1} max={5} step={0.1} value={form.rating ?? 4.5} onChange={(e) => set("rating", parseFloat(e.target.value))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Jml Rating</label>
              <input type="number" min={0} value={form.ratingCount ?? 0} onChange={(e) => set("ratingCount", Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Urutan</label>
              <input type="number" value={form.sortOrder ?? 0} onChange={(e) => set("sortOrder", Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Deskripsi</label>
            <textarea rows={3} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y" />
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            {(["isBestSeller", "isFeatured", "isNew", "hasCertificate"] as const).map((k) => (
              <label key={k} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!form[k]} onChange={(e) => set(k, e.target.checked)}
                  className="rounded border-border" />
                <span className="text-muted-foreground">
                  {k === "isBestSeller" ? "Best Seller" : k === "isFeatured" ? "Featured" : k === "isNew" ? "Baru" : "Ada Sertifikat"}
                </span>
              </label>
            ))}
          </div>

          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 pb-5">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted">
            Batal
          </button>
          <button
            onClick={() => onSubmit(form)}
            disabled={isPending || !form.id || !form.title || !form.provider || !form.url}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isEdit ? "Simpan Perubahan" : "Tambah Kursus"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quiz Stats Modal ─────────────────────────────────────────────────────────

function downloadQuizStatsCsv(stats: QuizStats) {
  // BOM so Excel opens UTF-8 correctly
  const blob = new Blob(["\uFEFF" + buildQuizStatsCsv(stats)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeTitle = stats.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "quiz";
  a.href = url;
  a.download = `statistik-quiz-${safeTitle}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function QuizStatsModal({ quizId, onClose }: { quizId: number; onClose: () => void }) {
  const { data: stats, isLoading, error } = useQuery<QuizStats>({
    queryKey: ["admin-quiz-stats", quizId],
    queryFn: () => getAdminQuizStats(quizId),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl my-8 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-foreground">
              {stats?.title ?? "Statistik Quiz"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {stats && stats.questions.length > 0 && (
              <button
                onClick={() => downloadQuizStatsCsv(stats)}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground"
                title="Unduh data statistik sebagai CSV"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Memuat statistik…
            </div>
          )}

          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
              Gagal memuat statistik.
            </div>
          )}

          {stats && (
            <>
              {/* Summary row */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Total Percobaan", value: stats.totalAttempts },
                  { label: "Lulus", value: stats.passCount, cls: "text-emerald-600" },
                  { label: "Pass Rate", value: `${stats.passRate}%`, cls: stats.passRate >= 70 ? "text-emerald-600" : stats.passRate >= 40 ? "text-amber-600" : "text-rose-600" },
                  { label: "Rata-rata Skor", value: `${stats.avgScore}%`, cls: stats.avgScore >= 70 ? "text-emerald-600" : stats.avgScore >= 40 ? "text-amber-600" : "text-rose-600" },
                ].map((s) => (
                  <div key={s.label} className="bg-muted/40 rounded-xl p-3 text-center">
                    <p className={`text-xl font-bold ${s.cls ?? "text-foreground"}`}>{s.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {stats.totalAttempts === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Belum ada peserta yang mengerjakan quiz ini.
                </p>
              )}

              {stats.removedQuestionNote && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                  {stats.removedQuestionNote}
                </p>
              )}

              {/* Per-question breakdown */}
              {stats.totalAttempts > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Soal — Diurutkan dari yang paling banyak salah
                  </h3>
                  {stats.questions.map((q, idx) => {
                    const total = stats.totalAttempts;
                    return (
                      <div key={q.id} className="border border-border rounded-xl p-4 space-y-3">
                        <div className="flex items-start gap-2">
                          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            q.failRate >= 60 ? "bg-rose-100 text-rose-600"
                            : q.failRate >= 30 ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                          }`}>
                            {q.failRate}% salah
                          </span>
                          <p className="text-sm text-foreground leading-snug">
                            {idx + 1}. {q.text}
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          {q.options.map((opt) => {
                            const count = q.optionCounts[opt.id] ?? 0;
                            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                            const isCorrect = opt.id === q.correctId;
                            return (
                              <div key={opt.id} className="flex items-center gap-2">
                                <span className={`text-[10px] font-mono w-5 shrink-0 ${isCorrect ? "text-emerald-600 font-bold" : "text-muted-foreground"}`}>
                                  {opt.id.toUpperCase()}
                                </span>
                                <div className="flex-1 relative h-5 rounded-md bg-muted overflow-hidden">
                                  <div
                                    className={`absolute inset-y-0 left-0 rounded-md transition-all ${isCorrect ? "bg-emerald-400/60" : "bg-rose-300/50"}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                  <span className="absolute inset-y-0 left-2 flex items-center text-[11px] text-foreground/80 truncate pr-2">
                                    {opt.text}
                                  </span>
                                </div>
                                <span className="text-[11px] text-muted-foreground w-12 text-right shrink-0">
                                  {count}× ({pct}%)
                                </span>
                                {isCorrect && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                              </div>
                            );
                          })}
                          {(q.staleAnswerCount ?? 0) > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono w-5 shrink-0 text-amber-600">?</span>
                              <div className="flex-1 relative h-5 rounded-md bg-amber-50 border border-amber-200 overflow-hidden">
                                <span className="absolute inset-y-0 left-2 flex items-center text-[11px] text-amber-700 truncate pr-2">
                                  Opsi sudah diubah/dihapus
                                </span>
                              </div>
                              <span className="text-[11px] text-amber-700 w-12 text-right shrink-0">
                                {q.staleAnswerCount}× ({total > 0 ? Math.round((q.staleAnswerCount / total) * 100) : 0}%)
                              </span>
                            </div>
                          )}
                        </div>
                        {q.staleAnswerNote && (
                          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                            {q.staleAnswerNote}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
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

    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        setSaveError(`Soal #${i + 1}: teks soal tidak boleh kosong.`);
        setExpandedQ(q.id);
        return;
      }
      const blankOption = q.options.find((o) => !o.text.trim());
      if (blankOption) {
        setSaveError(`Soal #${i + 1}: opsi ${blankOption.id.toUpperCase()} tidak boleh kosong.`);
        setExpandedQ(q.id);
        return;
      }
      if (!q.correctId) {
        setSaveError(`Soal #${i + 1}: jawaban benar belum dipilih.`);
        setExpandedQ(q.id);
        return;
      }
      if (!q.options.some((o) => o.id === q.correctId)) {
        setSaveError(`Soal #${i + 1}: jawaban benar ("${q.correctId}") tidak cocok dengan opsi yang ada. Pilih ulang jawaban yang benar.`);
        setExpandedQ(q.id);
        return;
      }
    }

    // Check for duplicate question IDs
    const ids = questions.map((q) => q.id);
    const hasDuplicateId = ids.some((id, idx) => ids.indexOf(id) !== idx);
    if (hasDuplicateId) {
      setSaveError("Terdapat ID soal yang duplikat. Silakan hapus dan tambahkan ulang soal yang bermasalah.");
      return;
    }

    // Check for duplicate question text (trimmed, case-insensitive)
    const normalizedTexts: string[] = [];
    for (let i = 0; i < questions.length; i++) {
      const normalized = questions[i].text.trim().replace(/\s+/g, " ").toLowerCase();
      const dupIdx = normalizedTexts.indexOf(normalized);
      if (dupIdx !== -1) {
        setSaveError(`Soal #${i + 1} memiliki teks yang sama dengan soal #${dupIdx + 1} (duplikat).`);
        setExpandedQ(questions[i].id);
        return;
      }
      normalizedTexts.push(normalized);
    }

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
  // correctId must reference an existing option; a stale/imported value that
  // doesn't match any option means the question can never be answered correctly
  const correctIdInvalid =
    !!question.correctId && !question.options.some((o) => o.id === question.correctId);
  const isComplete =
    question.text.trim() &&
    question.options.every((o) => o.text.trim()) &&
    question.correctId &&
    !correctIdInvalid;

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
            : correctIdInvalid
              ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">jawaban tidak valid</span>
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
              {correctIdInvalid && (
                <div className="flex items-center gap-1.5 text-[11px] text-red-600 bg-red-50 px-2.5 py-1.5 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Jawaban benar ("{question.correctId}") tidak cocok dengan opsi mana pun. Pilih ulang jawaban yang benar.
                </div>
              )}
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

// ─── AI Review Modal ──────────────────────────────────────────────────────────

function AiReviewModal({
  courseId,
  review,
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  courseId: string;
  review: AdminAiReview | null;
  onClose: () => void;
  onSubmit: (data: Partial<AdminAiReviewInput>) => void;
  isPending: boolean;
  error: string | null;
}) {
  const isEdit = review !== null;
  const [form, setForm] = useState<AdminAiReviewInput>({
    platform:       review?.platform       ?? "",
    platformIcon:   review?.platformIcon   ?? "🤖",
    rating:         review?.rating         ?? 4.5,
    relevanceScore: review?.relevanceScore ?? 80,
    comment:        review?.comment        ?? "",
    reviewedAt:     review?.reviewedAt     ?? "",
  });
  const set = <K extends keyof AdminAiReviewInput>(k: K, v: AdminAiReviewInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const canSubmit = form.platform.trim() && form.comment.trim() && form.reviewedAt.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold">{isEdit ? "Edit AI Review" : "Tambah AI Review"}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-[11px] text-muted-foreground">Kursus: <span className="font-mono">{courseId}</span></p>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-[11px] font-medium text-muted-foreground">Platform AI *</label>
              <input value={form.platform} onChange={(e) => set("platform", e.target.value)}
                placeholder="ChatGPT, Gemini, Claude…"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Ikon</label>
              <input value={form.platformIcon} onChange={(e) => set("platformIcon", e.target.value)}
                placeholder="🤖"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Rating (1–5)</label>
              <input type="number" min={1} max={5} step={0.1} value={form.rating}
                onChange={(e) => set("rating", parseFloat(e.target.value))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Relevansi (0–100)</label>
              <input type="number" min={0} max={100} value={form.relevanceScore}
                onChange={(e) => set("relevanceScore", Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Komentar *</label>
            <textarea rows={3} value={form.comment} onChange={(e) => set("comment", e.target.value)}
              placeholder="Ringkasan penilaian dari platform AI ini…"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y" />
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Periode Review *</label>
            <input value={form.reviewedAt} onChange={(e) => set("reviewedAt", e.target.value)}
              placeholder="Oktober 2025"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          {error && (
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 pb-4">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted">
            Batal
          </button>
          <button onClick={() => onSubmit(form)} disabled={isPending || !canSubmit}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isEdit ? "Simpan" : "Tambah Review"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ASKOM Review Modal ───────────────────────────────────────────────────────

function AskomReviewModal({
  courseId,
  review,
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  courseId: string;
  review: AdminAskomReview | null;
  onClose: () => void;
  onSubmit: (data: Partial<AdminAskomReviewInput>) => void;
  isPending: boolean;
  error: string | null;
}) {
  const isEdit = review !== null;
  const [form, setForm] = useState<AdminAskomReviewInput>({
    reviewerName:     review?.reviewerName     ?? "",
    credential:       review?.credential       ?? "",
    institution:      review?.institution      ?? "",
    credentialNumber: review?.credentialNumber ?? "",
    rating:           review?.rating           ?? 4.5,
    relevanceScore:   review?.relevanceScore   ?? 80,
    recommendation:   review?.recommendation  ?? "direkomendasikan",
    comment:          review?.comment          ?? "",
    strengths:        review?.strengths        ?? [],
    notes:            review?.notes            ?? "",
    reviewedAt:       review?.reviewedAt       ?? "",
  });
  const [strengthsText, setStrengthsText] = useState((review?.strengths ?? []).join("\n"));

  const set = <K extends keyof AdminAskomReviewInput>(k: K, v: AdminAskomReviewInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleStrengthsChange = (text: string) => {
    setStrengthsText(text);
    set("strengths", text.split("\n").map((s) => s.trim()).filter(Boolean));
  };

  const canSubmit = form.reviewerName.trim() && form.credential.trim() && form.institution.trim() && form.comment.trim() && form.reviewedAt.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl my-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-violet-500" />
            <h2 className="text-sm font-semibold">{isEdit ? "Edit ASKOM Review" : "Tambah ASKOM Review"}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-[11px] text-muted-foreground">Kursus: <span className="font-mono">{courseId}</span></p>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Nama Reviewer *</label>
            <input value={form.reviewerName} onChange={(e) => set("reviewerName", e.target.value)}
              placeholder="Dr. Ir. Budi Santoso"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Credential *</label>
              <input value={form.credential} onChange={(e) => set("credential", e.target.value)}
                placeholder="Asesor BNSP"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">No. Sertifikat</label>
              <input value={form.credentialNumber ?? ""} onChange={(e) => set("credentialNumber", e.target.value)}
                placeholder="BNSP-XXX-2024"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Institusi *</label>
            <input value={form.institution} onChange={(e) => set("institution", e.target.value)}
              placeholder="Balai Jasa Konstruksi Wilayah V"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Rating (1–5)</label>
              <input type="number" min={1} max={5} step={0.1} value={form.rating}
                onChange={(e) => set("rating", parseFloat(e.target.value))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Relevansi (0–100)</label>
              <input type="number" min={0} max={100} value={form.relevanceScore}
                onChange={(e) => set("relevanceScore", Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Rekomendasi *</label>
            <select value={form.recommendation} onChange={(e) => set("recommendation", e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="direkomendasikan">Direkomendasikan</option>
              <option value="direkomendasikan_dengan_catatan">Direkomendasikan dengan Catatan</option>
              <option value="tidak_direkomendasikan">Tidak Direkomendasikan</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Komentar *</label>
            <textarea rows={3} value={form.comment} onChange={(e) => set("comment", e.target.value)}
              placeholder="Ulasan dari asesor kompetensi…"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y" />
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Kekuatan (satu per baris, opsional)</label>
            <textarea rows={2} value={strengthsText} onChange={(e) => handleStrengthsChange(e.target.value)}
              placeholder={"Materi sesuai standar BNSP\nPengajar berpengalaman"}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y" />
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Catatan (opsional)</label>
            <textarea rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)}
              placeholder="Catatan tambahan untuk admin…"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y" />
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Periode Review *</label>
            <input value={form.reviewedAt} onChange={(e) => set("reviewedAt", e.target.value)}
              placeholder="Oktober 2025"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          {error && (
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 pb-4">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted">
            Batal
          </button>
          <button onClick={() => onSubmit(form)} disabled={isPending || !canSubmit}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isEdit ? "Simpan" : "Tambah Review"}
          </button>
        </div>
      </div>
    </div>
  );
}
