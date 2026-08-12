import { useClerk, useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  LayoutDashboard, LogOut, Users, Video, MessageSquare,
  CheckCircle2, ChevronDown, Search, BookOpen, Plus, Pencil, Trash2, X, Sparkles, Award,
} from "lucide-react";
import {
  listAllUsers, updateUserRole, listVideos, type VideoItem, type DbUser,
  listKnowledgeBase, createKnowledgeEntry, updateKnowledgeEntry, deleteKnowledgeEntry,
  seedKnowledgeBase, KB_CATEGORIES, type KbEntry, type KbInput,
} from "@/lib/api";

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

export default function DashboardAdmin() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"users" | "videos" | "kb">("users");
  const [kbModalOpen, setKbModalOpen] = useState(false);
  const [kbEditing, setKbEditing] = useState<KbEntry | null>(null);

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

  const invalidateKb = () => queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });

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
        <div className="flex gap-2 border-b border-border">
          {(["users", "videos", "kb"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              {tab === "users" ? "Pengguna" : tab === "videos" ? "Video" : "Knowledge Base"}
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
    </div>
  );
}

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
