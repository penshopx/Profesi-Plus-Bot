import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, MessageSquare, Trash2, BookOpen, Briefcase, Layers, ChevronRight, FileText, Award, AlertCircle, CheckCircle2, Package, Search, X, Cpu, Sparkles, HardHat, DraftingCompass, Building2, ShieldCheck, Cog, Droplets, ClipboardList, Users, type LucideIcon } from "lucide-react";
import { listConversations, createConversation, deleteConversation, fetchJabkerList, listModels, listPersonas, recommendPersona, type Conversation } from "@/lib/api";
import { getMyProfile } from "@/lib/api-profile";

const PERSONA_ICONS: Record<string, LucideIcon> = {
  HardHat, DraftingCompass, Building2, ShieldCheck, Cog, Droplets, ClipboardList,
};

const PERSONA_ACCENTS: Record<string, string> = {
  blue: "from-blue-500 to-cyan-500",
  rose: "from-rose-500 to-pink-500",
  amber: "from-amber-500 to-orange-500",
  emerald: "from-emerald-500 to-teal-500",
  violet: "from-violet-500 to-purple-500",
  cyan: "from-cyan-500 to-sky-500",
  indigo: "from-indigo-500 to-blue-500",
};

const MODES = [
  {
    id: "A",
    icon: Briefcase,
    label: "Pengalaman Kerja",
    sublabel: "Berbasis proyek & ESIMPAN",
    description: "Wawancara mendalam tentang pengalaman nyata di lapangan. Cocok untuk TKK yang memiliki proyek aktif atau baru selesai.",
    color: "from-blue-500 to-cyan-500",
    bg: "bg-blue-50 border-blue-200",
    highlight: "text-blue-700",
  },
  {
    id: "B",
    icon: BookOpen,
    label: "Hasil Belajar",
    sublabel: "Webinar, video, modul, buku",
    description: "Wawancara reflektif tentang proses belajar mandiri. Cocok untuk TKK yang aktif mengikuti pelatihan atau membaca.",
    color: "from-emerald-500 to-teal-500",
    bg: "bg-emerald-50 border-emerald-200",
    highlight: "text-emerald-700",
  },
  {
    id: "Hybrid",
    icon: Layers,
    label: "Hybrid",
    sublabel: "Gabungan pengalaman + belajar",
    description: "Kombinasi terkuat. Menggabungkan pengalaman lapangan dengan pembelajaran formal untuk Exum yang komprehensif.",
    color: "from-violet-500 to-purple-500",
    bg: "bg-violet-50 border-violet-200",
    highlight: "text-violet-700",
  },
];

const JENJANG_OPTIONS = ["Jenjang 7 (100 SKPK)", "Jenjang 8 (150 SKPK)", "Jenjang 9 (200 SKPK)"];

export default function Home() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(
    () => new URLSearchParams(window.location.search).get("new") === "1",
  );
  const [selectedMode, setSelectedMode] = useState("");
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [filterPhase, setFilterPhase] = useState<string>("all");
  const [jabker, setJabker] = useState("");
  const [jenjang, setJenjang] = useState("");
  const [model, setModel] = useState("gpt-4o");
  const [personaId, setPersonaId] = useState("");
  const [showJabkerDropdown, setShowJabkerDropdown] = useState(false);
  const jabkerRef = useRef<HTMLDivElement>(null);

  const { data: personaData } = useQuery({
    queryKey: ["personas"],
    queryFn: listPersonas,
    staleTime: 60 * 60 * 1000,
  });
  const personas = personaData?.personas ?? [];

  const { data: recommendation } = useQuery({
    queryKey: ["personaRecommend", jabker],
    queryFn: () => recommendPersona(jabker),
    enabled: jabker.trim().length > 2,
    staleTime: 10 * 60 * 1000,
  });
  const recommendedId = recommendation?.personaId ?? personaData?.defaultPersonaId ?? "pak-budi";

  const { data: jabkerList = [] } = useQuery({
    queryKey: ["jabkerList"],
    queryFn: fetchJabkerList,
    staleTime: 60 * 60 * 1000,
  });

  const { data: modelData } = useQuery({
    queryKey: ["models"],
    queryFn: listModels,
    staleTime: 10 * 60 * 1000,
  });
  const models = modelData?.models ?? [];

  const filteredJabkers = jabker.trim().length > 0
    ? jabkerList.filter((j) => j.toLowerCase().includes(jabker.toLowerCase())).slice(0, 8)
    : [];
  const jabkerIsKnown = jabker.trim().length > 0 && jabkerList.some(
    (j) => j.toLowerCase() === jabker.toLowerCase().trim()
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (jabkerRef.current && !jabkerRef.current.contains(e.target as Node)) {
        setShowJabkerDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: listConversations,
  });

  const { data: myProfile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: getMyProfile,
    retry: false,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createConversation({
        title: `Exum PKB — ${jabker || "TKK"} (${selectedMode === "A" ? "Pengalaman" : selectedMode === "B" ? "Hasil Belajar" : "Hybrid"})`,
        mode: selectedMode,
        model,
        jabker,
        jenjang,
        ...(personaId ? { personaId } : {}),
      }),
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      navigate(`/chat/${conv.id}`);
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteConversation,
    onSuccess: () => {
      setDeleteConfirmId(null);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const phaseLabel: Record<string, string> = {
    profiling: "Profiling",
    context: "Konteks",
    core_interview: "Wawancara Inti",
    evidence: "Bukti & Data",
    synthesis: "Sintesis",
    done: "Selesai",
  };

  const phaseColor: Record<string, string> = {
    profiling: "bg-blue-100 text-blue-700",
    context: "bg-yellow-100 text-yellow-700",
    core_interview: "bg-orange-100 text-orange-700",
    evidence: "bg-purple-100 text-purple-700",
    synthesis: "bg-teal-100 text-teal-700",
    done: "bg-green-100 text-green-700",
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-72 bg-sidebar text-sidebar-foreground flex flex-col shrink-0">
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-sidebar-primary/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-sidebar-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">Gustafta PKB</h1>
              <p className="text-[11px] text-sidebar-foreground/60">Exum Interviewer v2.0</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-2">
          <button
            data-testid="button-new-session"
            onClick={() => setShowNew(true)}
            className="w-full flex items-center gap-2 bg-sidebar-primary text-sidebar-primary-foreground rounded-xl px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Sesi Baru
          </button>
          <div className="flex gap-2">
            <a href="/profil"
              className="flex-1 flex items-center justify-center gap-1.5 bg-sidebar-accent/60 hover:bg-sidebar-accent text-sidebar-foreground rounded-xl px-3 py-2 text-xs font-medium transition-colors border border-sidebar-border/50">
              <Users className="w-3.5 h-3.5" /> Profil
            </a>
            <a href="/quiz"
              className="flex-1 flex items-center justify-center gap-1.5 bg-sidebar-accent/60 hover:bg-sidebar-accent text-sidebar-foreground rounded-xl px-3 py-2 text-xs font-medium transition-colors border border-sidebar-border/50">
              <Award className="w-3.5 h-3.5" /> Quiz
            </a>
          </div>
        </div>

        {/* Search + filter */}
        <div className="px-3 pb-2 space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-sidebar-foreground/30 pointer-events-none" />
            <input
              type="text"
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              placeholder="Cari sesi..."
              className="w-full rounded-xl bg-sidebar-accent/60 border border-sidebar-border/50 pl-7 pr-7 py-1.5 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/30 focus:outline-none focus:ring-1 focus:ring-sidebar-primary/40"
            />
            {sidebarSearch && (
              <button onClick={() => setSidebarSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-sidebar-foreground/30 hover:text-sidebar-foreground transition-colors">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex gap-1 flex-wrap">
            {["all", "done", "synthesis", "evidence", "profiling"].map(f => (
              <button key={f} onClick={() => setFilterPhase(f === filterPhase ? "all" : f)}
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                  filterPhase === f
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "bg-sidebar-accent/60 text-sidebar-foreground/50 hover:text-sidebar-foreground"
                }`}>
                {f === "all" ? "Semua" : f === "done" ? "Selesai" : f === "synthesis" ? "Sintesis" : f === "evidence" ? "Bukti" : "Profiling"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 px-3 mb-2">
            Riwayat Sesi
          </p>
          {isLoading ? (
            <div className="space-y-2 px-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-xl bg-sidebar-accent/40 animate-pulse" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-xs text-sidebar-foreground/40 px-3 py-4 text-center">Belum ada sesi. Mulai yang baru!</p>
          ) : (
            <div className="space-y-1">
              {conversations
                .filter(c =>
                  (filterPhase === "all" || c.phase === filterPhase) &&
                  (!sidebarSearch.trim() ||
                    c.title.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
                    (c.jabker ?? "").toLowerCase().includes(sidebarSearch.toLowerCase()))
                )
                .map((c) => {
                const modeIcon = c.mode === "A" ? Briefcase : c.mode === "B" ? BookOpen : Layers;
                const ModeIcon = modeIcon;
                const modeColor = c.mode === "A" ? "text-blue-400" : c.mode === "B" ? "text-emerald-400" : "text-violet-400";
                const phases = ["profiling","context","core_interview","evidence","synthesis","done"];
                const phaseProgress = Math.max(0, phases.indexOf(c.phase)) / (phases.length - 1);
                const isDone = c.phase === "done";
                return (
                  <div
                    key={c.id}
                    data-testid={`conversation-item-${c.id}`}
                    className="group rounded-xl px-3 py-2.5 cursor-pointer hover:bg-sidebar-accent transition-colors"
                    onClick={() => navigate(`/chat/${c.id}`)}
                  >
                    <div className="flex items-start gap-2">
                      <ModeIcon className={`w-3.5 h-3.5 mt-0.5 ${modeColor} shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate text-sidebar-foreground leading-tight">{c.title}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${phaseColor[c.phase] || "bg-sidebar-accent text-sidebar-foreground/60"}`}>
                            {phaseLabel[c.phase] || c.phase}
                          </span>
                          {c.jabker && (
                            <span className="text-[10px] text-sidebar-foreground/50 truncate max-w-[80px]">{c.jabker}</span>
                          )}
                          {c.evidenceCount > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] text-sidebar-foreground/40">
                              <Package className="w-2.5 h-2.5" />{c.evidenceCount}
                            </span>
                          )}
                        </div>
                        {!isDone && (
                          <div className="mt-1.5 w-full bg-sidebar-accent rounded-full h-1">
                            <div
                              className="h-1 rounded-full bg-sidebar-primary/60 transition-all"
                              style={{ width: `${phaseProgress * 100}%` }}
                            />
                          </div>
                        )}
                        {isDone && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-green-400">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Exum siap
                          </div>
                        )}
                      </div>
                      <button
                        data-testid={`button-delete-${c.id}`}
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(c.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-destructive/20 hover:text-destructive transition-all shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Delete confirmation modal */}
        {deleteConfirmId !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xs p-6 animate-in fade-in slide-in-from-bottom-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center mb-3">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Hapus sesi ini?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Semua pesan, serpihan, dan Exum dalam sesi ini akan terhapus permanen.
              </p>
              <div className="flex gap-2.5">
                <button onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-medium hover:bg-muted transition-colors">
                  Batal
                </button>
                <button
                  onClick={() => deleteMut.mutate(deleteConfirmId)}
                  disabled={deleteMut.isPending}
                  className="flex-1 rounded-xl bg-destructive text-destructive-foreground py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                  {deleteMut.isPending ? "Menghapus..." : "Ya, Hapus"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-sidebar-accent/50">
            <Award className="w-4 h-4 text-yellow-400 shrink-0" />
            <p className="text-[11px] text-sidebar-foreground/70 leading-tight">
              Exum bernilai hingga <span className="font-bold text-yellow-400">25 SKPK</span> sesuai Permen PUPR No. 12/2021
            </p>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        {showNew ? (
          <div className="w-full max-w-2xl">
            <h2 className="text-2xl font-bold text-foreground mb-1">Buat Sesi Wawancara Baru</h2>
            <p className="text-muted-foreground text-sm mb-8">Pilih mode penulisan Exum PKB Anda</p>

            <div className="space-y-3 mb-8">
              {MODES.map((m) => {
                const Icon = m.icon;
                const active = selectedMode === m.id;
                return (
                  <button
                    key={m.id}
                    data-testid={`mode-option-${m.id}`}
                    onClick={() => setSelectedMode(m.id)}
                    className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${active ? `border-primary ring-2 ring-primary/20 bg-primary/5` : "border-border hover:border-muted-foreground/40 bg-card"}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center shrink-0`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{m.label}</span>
                          <span className="text-xs text-muted-foreground">{m.sublabel}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{m.description}</p>
                      </div>
                      {active && <ChevronRight className="w-5 h-5 text-primary shrink-0 mt-1" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedMode && (
              <div className="space-y-4 mb-8 animate-in fade-in slide-in-from-bottom-2">
                <div ref={jabkerRef} className="relative">
                  <label className="text-sm font-medium text-foreground block mb-1.5">Jabatan Kerja (Jabker)</label>
                  <div className="relative">
                    <input
                      data-testid="input-jabker"
                      type="text"
                      value={jabker}
                      onChange={(e) => { setJabker(e.target.value); setShowJabkerDropdown(true); }}
                      onFocus={() => setShowJabkerDropdown(true)}
                      placeholder="Ketik jabatan kerja atau cari dari daftar..."
                      className="w-full rounded-xl border border-border bg-card px-4 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                    {jabker.trim().length > 0 && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {jabkerIsKnown
                          ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                          : <AlertCircle className="w-4 h-4 text-amber-500" />
                        }
                      </div>
                    )}
                  </div>
                  {showJabkerDropdown && filteredJabkers.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-xl shadow-lg max-h-52 overflow-y-auto">
                      {filteredJabkers.map((j) => (
                        <button
                          key={j}
                          type="button"
                          onClick={() => { setJabker(j); setShowJabkerDropdown(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl"
                        >
                          {j}
                        </button>
                      ))}
                    </div>
                  )}
                  {jabker.trim().length > 2 && !jabkerIsKnown && (
                    <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      Jabker ini belum ada di database — Anda tetap dapat melanjutkan, unit SKK dapat diisi manual nanti.
                    </p>
                  )}
                  {jabkerIsKnown && (
                    <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      Jabker ini ada dalam database SKK kami.
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">Jenjang SKK</label>
                  <select
                    data-testid="select-jenjang"
                    value={jenjang}
                    onChange={(e) => setJenjang(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  >
                    <option value="">Pilih jenjang SKK...</option>
                    {JENJANG_OPTIONS.map((j) => <option key={j} value={j}>{j}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5 mb-1.5">
                    <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
                    Model AI
                  </label>
                  <select
                    data-testid="select-model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  >
                    {models.length === 0 && <option value="gpt-4o">GPT-4o</option>}
                    {Array.from(new Set(models.map((m) => m.providerLabel))).map((providerLabel) => (
                      <optgroup key={providerLabel} label={providerLabel}>
                        {models
                          .filter((m) => m.providerLabel === providerLabel)
                          .map((m) => (
                            <option key={m.id} value={m.id} disabled={!m.available}>
                              {m.label}{m.available ? "" : " — belum dikonfigurasi"}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                  {(() => {
                    const sel = models.find((m) => m.id === model);
                    if (sel && !sel.available) {
                      return (
                        <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          API key untuk {sel.providerLabel} belum diatur — pilih model lain atau tambahkan key di Secrets.
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5 mb-1.5">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    Pewawancara Spesialis
                  </label>
                  <p className="text-xs text-muted-foreground mb-2.5">
                    Pilih pendamping AI sesuai bidang Anda. Setiap spesialis menggali pengalaman dengan keahlian dan gaya berbeda.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      data-testid="persona-option-auto"
                      onClick={() => setPersonaId("")}
                      className={`text-left rounded-2xl border-2 p-3.5 transition-all ${personaId === "" ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border hover:border-muted-foreground/40 bg-card"}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0">
                          <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-foreground text-sm">Otomatis (Disarankan)</span>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                            {(() => {
                              const rec = personas.find((p) => p.id === recommendedId);
                              return rec ? `Sistem memilih ${rec.name} untuk jabker Anda.` : "Sistem memilih spesialis terbaik dari jabker Anda.";
                            })()}
                          </p>
                        </div>
                      </div>
                    </button>

                    {personas.map((p) => {
                      const Icon = PERSONA_ICONS[p.icon] ?? HardHat;
                      const active = personaId === p.id;
                      const isRecommended = p.id === recommendedId;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          data-testid={`persona-option-${p.id}`}
                          onClick={() => setPersonaId(p.id)}
                          className={`relative text-left rounded-2xl border-2 p-3.5 transition-all ${active ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border hover:border-muted-foreground/40 bg-card"}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${PERSONA_ACCENTS[p.accent] ?? PERSONA_ACCENTS.blue} flex items-center justify-center shrink-0`}>
                              <Icon className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-foreground text-sm">{p.name}</span>
                                {isRecommended && (
                                  <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                                    Sesuai
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{p.tagline}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowNew(false)}
                className="flex-1 rounded-xl border border-border bg-card px-6 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Batal
              </button>
              <button
                data-testid="button-start-session"
                disabled={!selectedMode || createMut.isPending}
                onClick={() => createMut.mutate()}
                className="flex-1 rounded-xl bg-primary text-primary-foreground px-6 py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              >
                {createMut.isPending ? "Memulai..." : "Mulai Wawancara"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 max-w-md w-full">
            {/* Profile completeness banner */}
            {myProfile && !myProfile.isComplete && (
              <a href="/profil"
                className="w-full flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5 hover:bg-amber-100 transition-colors group">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-800">Profil APL 01 belum lengkap</p>
                  <p className="text-xs text-amber-700 mt-0.5">Lengkapi data identitas agar Exum Anda dapat dipersonalisasi secara resmi</p>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </a>
            )}

            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Selamat Datang di Gustafta PKB</h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                Pewawancara mandiri untuk membantu Anda membuat <span className="font-semibold text-foreground">Executive Summary PKB</span> berkualitas tinggi (10-15 halaman, hingga 25 SKPK) sesuai Permen PUPR No. 12 Tahun 2021.
              </p>
              <button
                data-testid="button-get-started"
                onClick={() => setShowNew(true)}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-6 py-3 font-semibold hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                Buat Exum Baru
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
