import { useState, useMemo, useEffect } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchJabkerList,
  listModels,
  listProjectBrain,
  listCompetencyAnalyses,
  getCompetencyAnalysis,
  analyzeCompetency,
  deleteCompetencyAnalysis,
  listQuizzesByJabker,
  getMyQuizAttempts,
  type CompetencyAnalysisFull,
  type CompetencyUnitStatus,
} from "@/lib/api";
import { getMyUsage } from "@/lib/api-profile";
import { useResetCountdown } from "@/hooks/useResetCountdown";
import {
  Target, ArrowLeft, Sparkles, Brain, CheckCircle2, AlertTriangle,
  XCircle, Trash2, Loader2, Lightbulb, TrendingUp, ChevronDown, History, BookOpen,
} from "lucide-react";

const STATUS_META: Record<CompetencyUnitStatus, { label: string; icon: typeof CheckCircle2; cls: string; dot: string }> = {
  covered: { label: "Terpenuhi", icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
  partial: { label: "Sebagian", icon: AlertTriangle, cls: "text-amber-600 bg-amber-50 border-amber-200", dot: "bg-amber-500" },
  gap: { label: "Kosong", icon: XCircle, cls: "text-rose-600 bg-rose-50 border-rose-200", dot: "bg-rose-400" },
};

const READINESS_META: Record<string, { label: string; cls: string }> = {
  kuat: { label: "Siap Menyusun Exum", cls: "text-emerald-700 bg-emerald-100" },
  cukup: { label: "Perlu Sedikit Penguatan", cls: "text-amber-700 bg-amber-100" },
  lemah: { label: "Bukti Masih Minim", cls: "text-rose-700 bg-rose-100" },
};

export default function StudioPage() {
  const { user } = useUser();
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [jabker, setJabker] = useState("");
  const [model, setModel] = useState("");
  const [active, setActive] = useState<CompetencyAnalysisFull | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const { data: usage } = useQuery({
    queryKey: ["my-usage"],
    queryFn: getMyUsage,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // Live countdown to the competency-quota reset (#184), skew-safe via serverNow.
  const compCountdown = useResetCountdown(usage?.competency?.resetAt, usage?.serverNow);

  const { data: jabkers = [] } = useQuery({ queryKey: ["jabkers"], queryFn: fetchJabkerList });
  const { data: modelData } = useQuery({ queryKey: ["models"], queryFn: listModels });
  const { data: brain = [] } = useQuery({ queryKey: ["project-brain"], queryFn: listProjectBrain });
  const { data: history = [], fetchStatus } = useQuery({ queryKey: ["competency-analyses"], queryFn: listCompetencyAnalyses });
  const { data: jabkerQuizzes = [] } = useQuery({
    queryKey: ["quizzes-by-jabker", jabker],
    queryFn: () => listQuizzesByJabker(jabker),
    enabled: !!jabker,
    staleTime: 5 * 60 * 1000,
  });
  const { data: myAttempts = [] } = useQuery({
    queryKey: ["my-quiz-attempts"],
    queryFn: getMyQuizAttempts,
    enabled: !!jabker,
    staleTime: 2 * 60 * 1000,
  });

  // True when the list is showing stale/cached data because the network is unavailable
  const showingCached = !isOnline && history.length > 0;

  const models = modelData?.models.filter((m) => m.available) ?? [];

  const analyzeMut = useMutation({
    mutationFn: () => analyzeCompetency(jabker, model || undefined),
    onSuccess: (data) => {
      setActive(data);
      setError(null);
      qc.invalidateQueries({ queryKey: ["competency-analyses"] });
      // Refresh the quota indicator so the count drops immediately after each analysis.
      qc.invalidateQueries({ queryKey: ["my-usage"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => deleteCompetencyAnalysis(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["competency-analyses"] });
      if (active?.id === id) setActive(null);
    },
  });

  async function openHistory(id: number) {
    setError(null);
    try {
      const full = await getCompetencyAnalysis(id);
      setActive(full);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Gagal memuat analisis.");
    }
  }

  // Quiz coverage: quizzes for this jabker whose SKK unit has no passing attempt,
  // AND that unit is not already fully covered in the active analysis.
  const quizGaps = useMemo(() => {
    if (!jabkerQuizzes.length) return [];
    const passedQuizIds = new Set(myAttempts.filter((a) => a.passed).map((a) => a.quizId));
    const coveredSkk = new Set(
      (active?.result.units ?? []).filter((u) => u.status === "covered").map((u) => u.code)
    );
    return jabkerQuizzes.filter((q) =>
      !passedQuizIds.has(q.id) &&
      !(q.skkUnitCode && coveredSkk.has(q.skkUnitCode))
    );
  }, [jabkerQuizzes, myAttempts, active]);

  const counts = useMemo(() => {
    const u = active?.result.units ?? [];
    return {
      covered: u.filter((x) => x.status === "covered").length,
      partial: u.filter((x) => x.status === "partial").length,
      gap: u.filter((x) => x.status === "gap").length,
      total: u.length,
    };
  }, [active]);

  const hasBrain = brain.length > 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/dashboard/user")} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" title="Kembali">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Target className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">Studio Kompetensi</p>
            <p className="text-[11px] text-muted-foreground">Pemetaan pengalaman → SKK → SKPK</p>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-foreground">{user?.fullName ?? user?.firstName}</p>
        </div>
      </header>

      {/* Offline cached-data banner */}
      {showingCached && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center gap-2 text-amber-800 text-sm">
          <span className="shrink-0">📶</span>
          <span>Anda sedang offline — menampilkan analisis tersimpan. Data akan diperbarui saat koneksi pulih.</span>
        </div>
      )}

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        {/* Intro */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Petakan Kompetensi Anda</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Pilih jabatan kerja target. Studio akan mencocokkan rekam jejak di Otak Proyek Anda
            dengan unit-unit SKK yang dibutuhkan, lalu memperkirakan nilai SKPK untuk Exum.
          </p>
        </div>

        {/* No brain warning */}
        {!hasBrain && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <Brain className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">Otak Proyek masih kosong</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Tambahkan pengalaman proyek Anda dulu agar pemetaan bisa berjalan.
              </p>
            </div>
            <button
              onClick={() => navigate("/dashboard/user")}
              className="text-xs font-semibold bg-amber-500 text-white px-3 py-2 rounded-xl hover:bg-amber-600 transition-colors shrink-0"
            >
              Buka Otak Proyek
            </button>
          </div>
        )}

        {/* Analyze control */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Jabatan Kerja Target</label>
              <div className="relative mt-1">
                <select
                  value={jabker}
                  onChange={(e) => setJabker(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 pr-9"
                >
                  <option value="">— Pilih jabatan kerja —</option>
                  {jabkers.map((j) => (
                    <option key={j} value={j}>{j}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Model AI</label>
              <div className="relative mt-1">
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 pr-9"
                >
                  <option value="">Default ({modelData?.defaultModel ?? "gpt-4o"})</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>{m.label} · {m.providerLabel}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {error && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => { setError(null); analyzeMut.mutate(); }}
              disabled={!jabker || !hasBrain || analyzeMut.isPending}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {analyzeMut.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Memetakan kompetensi…</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Petakan Sekarang</>
              )}
            </button>

            {/* Competency analysis quota pill */}
            {usage?.competency && (() => {
              const { remaining, limit, resetAt } = usage.competency;
              const exhausted = remaining <= 0;
              const low = remaining <= 1;
              const resetStr = resetAt
                ? new Date(resetAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })
                : null;
              return (
                <span className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${
                  exhausted ? "bg-red-50 border-red-200 text-red-600"
                  : low     ? "bg-amber-50 border-amber-200 text-amber-700"
                  :           "bg-indigo-50 border-indigo-200 text-indigo-600"
                }`}>
                  {exhausted
                    ? `Batas analisis hari ini tercapai${
                        compCountdown ? ` · reset dalam ${compCountdown}` : resetStr ? ` · reset ${resetStr}` : ""
                      }`
                    : `${remaining}/${limit} analisis tersisa hari ini`}
                </span>
              );
            })()}
          </div>
        </div>

        {/* Result */}
        {active && (
          <div className="space-y-5">
            {/* Score header */}
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-6 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/70">{active.jabkerName} · Jenjang {active.jenjang}</p>
                  <div className="flex items-end gap-2 mt-2">
                    <span className="text-5xl font-bold leading-none">{active.result.estimatedSkpk}</span>
                    <span className="text-lg text-white/80 mb-1">/ 25 SKPK</span>
                  </div>
                  <span className={`inline-block mt-3 text-xs font-semibold px-2.5 py-1 rounded-full ${READINESS_META[active.result.readiness]?.cls ?? ""}`}>
                    {READINESS_META[active.result.readiness]?.label ?? active.result.readiness}
                  </span>
                </div>
                <TrendingUp className="w-8 h-8 text-white/40" />
              </div>
              {active.result.summary && (
                <p className="text-sm text-white/90 mt-4 leading-relaxed">{active.result.summary}</p>
              )}
              <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-white/15 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-300" /> {counts.covered} terpenuhi</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-300" /> {counts.partial} sebagian</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-300" /> {counts.gap} kosong</span>
                <span className="text-white/60">dari {counts.total} unit SKK</span>
              </div>
            </div>

            {/* Quiz evidence nudge — shown when passing quizzes exist for uncovered SKK units */}
            {quizGaps.length > 0 && (
              <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <BookOpen className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-rose-800">
                    {quizGaps.length} unit SKK belum ada bukti kuis
                  </p>
                  <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                    Kerjakan kuis berikut agar Pak Budi punya bukti nyata saat menyusun Exum Anda:
                  </p>
                  <ul className="mt-2 space-y-0.5">
                    {quizGaps.slice(0, 5).map((q) => (
                      <li key={q.id} className="text-xs text-rose-700 flex gap-1.5 items-baseline">
                        <span className="shrink-0 text-rose-400">•</span>
                        <a href={`/quiz?quizId=${q.id}`} className="underline underline-offset-2 hover:text-rose-900" title={`Buka kuis — ${q.title}`}>
                          {q.title}{q.skkUnitCode ? <span className="font-mono text-[10px] ml-1 opacity-60">{q.skkUnitCode}</span> : null}
                        </a>
                      </li>
                    ))}
                    {quizGaps.length > 5 && (
                      <li className="text-[11px] text-rose-500 ml-3">… dan {quizGaps.length - 5} kuis lainnya</li>
                    )}
                  </ul>
                </div>
                <a
                  href="/quiz"
                  className="shrink-0 text-xs font-semibold bg-rose-500 text-white px-3 py-2 rounded-xl hover:bg-rose-600 transition-colors"
                >
                  Buka Kuis
                </a>
              </div>
            )}

            {/* Gaps + recommendations */}
            <div className="grid md:grid-cols-2 gap-4">
              {active.result.gaps.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <h3 className="text-sm font-semibold text-foreground">Yang Masih Kurang</h3>
                  </div>
                  <ul className="space-y-2">
                    {active.result.gaps.map((g, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-2">
                        <span className="text-amber-500 shrink-0">•</span><span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {active.result.recommendations.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-4 h-4 text-indigo-500" />
                    <h3 className="text-sm font-semibold text-foreground">Langkah Berikutnya</h3>
                  </div>
                  <ul className="space-y-2">
                    {active.result.recommendations.map((r, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-2">
                        <span className="text-indigo-500 shrink-0">{i + 1}.</span><span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Unit map */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Peta Unit SKK ({counts.total})</h3>
              <div className="space-y-2">
                {active.result.units.map((u) => {
                  const meta = STATUS_META[u.status];
                  const Icon = meta.icon;
                  return (
                    <div key={u.code} className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${meta.cls}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-mono text-muted-foreground/70">{u.code}</span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${meta.cls}`}>{meta.label}</span>
                          </div>
                          <p className="text-sm font-medium text-foreground mt-0.5">{u.name}</p>
                          {u.rationale && <p className="text-xs text-muted-foreground mt-1">{u.rationale}</p>}
                          {u.evidenceRef && (
                            <p className="text-[11px] text-indigo-500 mt-1 flex items-center gap-1">
                              <Brain className="w-3 h-3" /> {u.evidenceRef}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Riwayat Pemetaan</h3>
            </div>
            <div className="space-y-2">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 group hover:border-indigo-300 transition-colors"
                >
                  <div
                    onClick={() => openHistory(h.id)}
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex flex-col items-center justify-center shrink-0">
                      <span className="text-sm font-bold leading-none">{h.estimatedSkpk}</span>
                      <span className="text-[8px] text-indigo-400">SKPK</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{h.jabkerName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {READINESS_META[h.readiness]?.label} · {new Date(h.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => { if (confirm("Hapus analisis ini?")) delMut.mutate(h.id); }}
                    className="p-1.5 rounded-lg hover:bg-rose-50 text-muted-foreground hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Hapus"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
