/**
 * QuizSummaryPanel
 *
 * Collapsible "Data Quiz Saya" panel shown in the synthesis phase before Exum
 * generation. Lists the user's best pre/post/proficiency score per quiz so they
 * can see exactly what the AI already knows about their competency.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, BookOpen, Trophy, CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";
import { getMyQuizSummary, type MyQuizSummaryEntry } from "@/lib/api-profile";
import { useLocation } from "wouter";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(passed: boolean) {
  return passed ? "text-green-600" : "text-amber-600";
}

function PassBadge({ passed }: { passed: boolean }) {
  return passed ? (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
      <CheckCircle2 className="w-3 h-3" /> Lulus
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
      <XCircle className="w-3 h-3" /> Belum lulus
    </span>
  );
}

function LearningRow({ entry }: { entry: MyQuizSummaryEntry }) {
  const { pre, post, passingScore } = entry;
  const delta = pre && post ? post.score - pre.score : null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="text-muted-foreground w-8 shrink-0">Pre</span>
      <span className={`font-semibold tabular-nums ${pre ? scoreColor(pre.passed) : "text-muted-foreground"}`}>
        {pre ? `${pre.score}%` : "—"}
      </span>
      <span className="text-muted-foreground">→</span>
      <span className="text-muted-foreground w-8 shrink-0">Post</span>
      <span className={`font-semibold tabular-nums ${post ? scoreColor(post.passed) : "text-muted-foreground"}`}>
        {post ? `${post.score}%` : "—"}
      </span>
      {delta !== null && (
        <span className={`text-xs font-medium ${delta > 0 ? "text-green-600" : delta < 0 ? "text-red-500" : "text-muted-foreground"}`}>
          ({delta > 0 ? "+" : ""}{delta}%)
        </span>
      )}
      <span className="ml-auto">
        {post ? (
          <PassBadge passed={post.passed} />
        ) : pre ? (
          <span className="text-xs text-muted-foreground">Post belum dikerjakan</span>
        ) : null}
      </span>
      <span className="text-xs text-muted-foreground">min. {passingScore}%</span>
    </div>
  );
}

function ProficiencyRow({ entry }: { entry: MyQuizSummaryEntry }) {
  const { proficiency, passingScore } = entry;
  if (!proficiency) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className={`font-semibold tabular-nums ${scoreColor(proficiency.passed)}`}>
        {proficiency.score}%
      </span>
      <PassBadge passed={proficiency.passed} />
      <span className="ml-auto text-xs text-muted-foreground">min. {passingScore}%</span>
    </div>
  );
}

function QuizCard({ entry }: { entry: MyQuizSummaryEntry }) {
  const isLearning = entry.quizType === "learning";
  const hasData = isLearning ? (entry.pre || entry.post) : entry.proficiency;
  if (!hasData) return null;

  return (
    <div className="border border-border rounded-lg px-3 py-2.5 bg-background">
      <div className="flex items-start gap-2 mb-1.5">
        {isLearning ? (
          <BookOpen className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
        ) : (
          <Trophy className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug text-foreground">{entry.quizTitle}</p>
          {entry.skkUnitCode && (
            <p className="text-xs text-muted-foreground">{entry.skkUnitCode}</p>
          )}
        </div>
      </div>
      {isLearning ? <LearningRow entry={entry} /> : <ProficiencyRow entry={entry} />}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface QuizSummaryPanelProps {
  /** Filter to a specific jabker; if undefined, shows all quizzes */
  jabker?: string | null;
}

export function QuizSummaryPanel({ jabker }: QuizSummaryPanelProps) {
  const [open, setOpen] = useState(true);
  const [, navigate] = useLocation();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-quiz-summary"],
    queryFn: getMyQuizSummary,
    staleTime: 60_000,
  });

  // Filter to relevant jabker when one is provided
  const entries = data
    ? jabker
      ? data.filter((e) => !e.jabker || e.jabker === jabker)
      : data
    : [];

  const passed = entries.filter((e) =>
    e.quizType === "learning" ? e.post?.passed || e.pre?.passed : e.proficiency?.passed
  ).length;

  return (
    <div className="border border-border rounded-xl bg-card/60 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-semibold text-foreground">Data Quiz Saya</span>
          {!isLoading && data && (
            <span className="text-xs text-muted-foreground font-normal">
              {entries.length === 0
                ? "Belum ada quiz"
                : `${passed}/${entries.length} lulus`}
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Body */}
      {open && (
        <div className="px-4 pb-4">
          {isLoading && (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Memuat data quiz…
            </div>
          )}

          {isError && (
            <p className="text-sm text-red-500 py-3">
              Gagal memuat data quiz. Coba muat ulang halaman.
            </p>
          )}

          {!isLoading && !isError && entries.length === 0 && (
            <div className="py-3">
              <p className="text-sm text-muted-foreground mb-2">
                Kamu belum mengerjakan quiz apapun. Quiz membantu AI memahami kompetensi terukurmu saat membuat Exum.
              </p>
              <button
                onClick={() => navigate("/quiz")}
                className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Kerjakan quiz di Marketplace
              </button>
            </div>
          )}

          {!isLoading && !isError && entries.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                AI akan menggunakan data ini saat membuat Exum-mu. Skor yang ditampilkan adalah hasil terbaikmu.
              </p>
              <div className="flex flex-col gap-2">
                {entries.map((entry) => (
                  <QuizCard key={entry.quizId} entry={entry} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
