/**
 * Halaman Quiz PKB
 *
 * Dua mode:
 *  • Learning quiz  — Pre-test sebelum belajar, Post-test setelah belajar.
 *                     Delta skor = bukti PKB resmi.
 *  • Proficiency quiz — Sekali saja, memvalidasi penguasaan pengalaman kerja yang diklaim.
 *
 * Flow:
 *  Daftar quiz → Pilih quiz → (Pre/Post/Proficiency) → Kerjakan → Hasil & feedback
 */

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  listQuizzes, getQuiz, submitQuizAttempt, getMyAttempts,
  type QuizSummary, type QuizFull, type AttemptResult, type QuizAttempt,
} from "@/lib/api-profile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft, ChevronRight, BookOpen, Star, CheckCircle2, XCircle,
  Award, RotateCcw, Play, Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Quiz list ────────────────────────────────────────────────────────────────

function QuizCard({
  quiz, attempts, onSelect,
}: {
  quiz: QuizSummary;
  attempts: QuizAttempt[];
  onSelect: (quiz: QuizSummary) => void;
}) {
  const quizAttempts = attempts.filter((a) => a.quizId === quiz.id);
  const preAttempt = quizAttempts.find((a) => a.attemptType === "pre");
  const postAttempt = quizAttempts.find((a) => a.attemptType === "post");
  const profAttempt = quizAttempts.find((a) => a.attemptType === "proficiency");

  const isLearning = quiz.quizType === "learning";
  const bestAttempt = postAttempt ?? preAttempt ?? profAttempt;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
      onClick={() => onSelect(quiz)}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${isLearning ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}>
            {isLearning ? <BookOpen className="h-5 w-5" /> : <Star className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{quiz.title}</p>
            {quiz.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{quiz.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {isLearning ? "Pembelajaran" : "Proficiency"}
              </Badge>
              {quiz.jabker && (
                <Badge variant="secondary" className="text-xs">{quiz.jabker.replace(/_/g, " ")}</Badge>
              )}
              {bestAttempt && (
                <Badge
                  className={`text-xs ${bestAttempt.passed ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-amber-100 text-amber-700 hover:bg-amber-100"}`}>
                  {bestAttempt.scorePercent}% {bestAttempt.passed ? "✓" : ""}
                </Badge>
              )}
              {isLearning && (
                <span className="text-xs text-muted-foreground">
                  {preAttempt ? "Pre ✓" : "Pre ○"} → {postAttempt ? "Post ✓" : "Post ○"}
                </span>
              )}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Attempt type selector ────────────────────────────────────────────────────

function AttemptTypeSelector({
  quiz, attempts, onSelect,
}: {
  quiz: QuizSummary;
  attempts: QuizAttempt[];
  onSelect: (type: "pre" | "post" | "proficiency") => void;
}) {
  const quizAttempts = attempts.filter((a) => a.quizId === quiz.id);
  const hasPretest = quizAttempts.some((a) => a.attemptType === "pre");
  const hasPosttest = quizAttempts.some((a) => a.attemptType === "post");
  const hasProficiency = quizAttempts.some((a) => a.attemptType === "proficiency");

  const isLearning = quiz.quizType === "learning";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{quiz.title}</h2>
        {quiz.description && <p className="text-sm text-muted-foreground mt-1">{quiz.description}</p>}
        <p className="text-xs text-muted-foreground mt-1">
          Passing score: {quiz.passingScore}%
        </p>
      </div>

      {isLearning ? (
        <div className="space-y-3">
          <p className="text-sm font-medium">Pilih jenis pengerjaan:</p>

          <Card className={`border-2 cursor-pointer hover:border-blue-400 transition-colors ${hasPretest ? "opacity-60" : ""}`}
            onClick={() => onSelect("pre")}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Play className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Pre-Test</p>
                  <p className="text-xs text-muted-foreground">Ukur pengetahuan awal sebelum belajar</p>
                </div>
                {hasPretest && <Badge className="ml-auto bg-green-100 text-green-700 hover:bg-green-100">Selesai ✓</Badge>}
              </div>
            </CardContent>
          </Card>

          <Card className={`border-2 cursor-pointer hover:border-green-400 transition-colors ${!hasPretest ? "opacity-40 pointer-events-none" : ""}`}
            onClick={() => hasPretest && onSelect("post")}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-green-50 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Post-Test</p>
                  <p className="text-xs text-muted-foreground">
                    {hasPretest ? "Ukur peningkatan setelah belajar" : "Selesaikan Pre-Test dulu"}
                  </p>
                </div>
                {hasPosttest && <Badge className="ml-auto bg-green-100 text-green-700 hover:bg-green-100">Selesai ✓</Badge>}
              </div>
            </CardContent>
          </Card>

          {hasPretest && hasPosttest && (
            <Card className="border-2 border-dashed cursor-pointer hover:border-blue-400 transition-colors"
              onClick={() => onSelect("pre")}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <RotateCcw className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Ulangi Pre-Test</p>
                    <p className="text-xs text-muted-foreground">Latihan tambahan</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <Card className="border-2 cursor-pointer hover:border-purple-400 transition-colors"
            onClick={() => onSelect("proficiency")}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Award className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Uji Proficiency</p>
                  <p className="text-xs text-muted-foreground">Validasi penguasaan pengalaman yang diklaim</p>
                </div>
                {hasProficiency && <Badge className="ml-auto bg-green-100 text-green-700 hover:bg-green-100">Pernah Diujikan</Badge>}
              </div>
            </CardContent>
          </Card>
          {hasProficiency && (
            <p className="text-xs text-muted-foreground text-center">
              Klik untuk mengulang — skor terbaru yang digunakan sebagai bukti PKB
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Quiz runner ──────────────────────────────────────────────────────────────

function QuizRunner({
  quiz, attemptType, onComplete,
}: {
  quiz: QuizFull;
  attemptType: "pre" | "post" | "proficiency";
  onComplete: (result: AttemptResult) => void;
}) {
  const { toast } = useToast();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const total = quiz.questions.length;
  const q = quiz.questions[currentIdx];
  const answered = Object.keys(answers).length;
  const progress = Math.round(((currentIdx + 1) / total) * 100);

  const submitMut = useMutation({
    mutationFn: () => submitQuizAttempt(quiz.id, answers, attemptType),
    onSuccess: onComplete,
    onError: () => toast({ title: "Gagal submit", variant: "destructive" }),
  });

  const typeLabel = attemptType === "pre" ? "Pre-Test" : attemptType === "post" ? "Post-Test" : "Uji Proficiency";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <Badge variant="outline">{typeLabel}</Badge>
          <span className="text-muted-foreground">{currentIdx + 1} / {total}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Question */}
      {q && (
        <Card>
          <CardContent className="pt-6 pb-6 space-y-5">
            <p className="font-medium leading-relaxed">{q.text}</p>
            <RadioGroup
              value={answers[q.id] ?? ""}
              onValueChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
              className="space-y-2"
            >
              {q.options.map((opt) => (
                <div key={opt.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    answers[q.id] === opt.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt.id }))}>
                  <RadioGroupItem value={opt.id} id={`${q.id}-${opt.id}`} />
                  <Label htmlFor={`${q.id}-${opt.id}`} className="cursor-pointer flex-1">
                    {opt.text}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          disabled={currentIdx === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Sebelumnya
        </Button>
        <span className="flex-1 text-center text-sm text-muted-foreground">
          {answered} / {total} dijawab
        </span>
        {currentIdx < total - 1 ? (
          <Button onClick={() => setCurrentIdx((i) => i + 1)} disabled={!answers[q?.id ?? ""]}>
            Berikutnya <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={() => submitMut.mutate()}
            disabled={answered < total || submitMut.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {submitMut.isPending ? "Menilai…" : "Selesai & Kumpulkan"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Result view ──────────────────────────────────────────────────────────────

function QuizResult({
  result, quiz, attemptType, onRetry, onBack,
}: {
  result: AttemptResult;
  quiz: QuizFull;
  attemptType: "pre" | "post" | "proficiency";
  onRetry: () => void;
  onBack: () => void;
}) {
  const { scorePercent, passed, passingScore, feedback } = result;
  const typeLabel = attemptType === "pre" ? "Pre-Test" : attemptType === "post" ? "Post-Test" : "Uji Proficiency";

  return (
    <div className="space-y-6">
      {/* Score card */}
      <Card className={`border-2 ${passed ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"}`}>
        <CardContent className="pt-6 pb-6 text-center space-y-3">
          {passed
            ? <CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />
            : <XCircle className="h-12 w-12 mx-auto text-amber-600" />}
          <div>
            <p className="text-3xl font-bold">{scorePercent}<span className="text-lg">%</span></p>
            <p className="text-sm text-muted-foreground mt-1">{typeLabel} — {quiz.title}</p>
          </div>
          <Badge className={passed ? "bg-green-600 hover:bg-green-600" : "bg-amber-500 hover:bg-amber-500"}>
            {passed ? "LULUS ✓" : `Belum Lulus (min. ${passingScore}%)`}
          </Badge>
          <p className="text-xs text-muted-foreground">
            {result.attempt.score} dari {result.attempt.totalQuestions} soal benar
          </p>
        </CardContent>
      </Card>

      {/* Feedback per question */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm">Pembahasan Soal</h3>
        {quiz.questions.map((q, i) => {
          const fb = feedback.find((f) => f.questionId === q.id);
          return (
            <Card key={q.id} className={`border ${fb?.correct ? "border-green-200" : "border-red-200"}`}>
              <CardContent className="pt-3 pb-3 space-y-2">
                <div className="flex gap-2">
                  {fb?.correct
                    ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                    : <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />}
                  <p className="text-sm">{q.text}</p>
                </div>
                {fb?.explanation && (
                  <p className="text-xs text-muted-foreground pl-6">{fb.explanation}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onRetry}>
          <RotateCcw className="h-4 w-4 mr-1.5" /> Ulangi
        </Button>
        <Button onClick={onBack} className="flex-1">Kembali ke Daftar Quiz</Button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Stage =
  | { type: "list" }
  | { type: "select"; quiz: QuizSummary }
  | { type: "run"; quiz: QuizFull; attemptType: "pre" | "post" | "proficiency" }
  | { type: "result"; quiz: QuizFull; result: AttemptResult; attemptType: "pre" | "post" | "proficiency" };

export default function QuizPage() {
  const [stage, setStage] = useState<Stage>({ type: "list" });
  const { data: quizzes = [], isLoading } = useQuery({ queryKey: ["quizzes"], queryFn: () => listQuizzes() });
  const { data: attempts = [] } = useQuery({ queryKey: ["my-attempts"], queryFn: getMyAttempts });

  const loadQuizMut = useMutation({
    mutationFn: (id: number) => getQuiz(id),
    onSuccess: (quiz) => {
      if (stage.type === "select") {
        setStage((s) => ({ ...s, quiz } as Stage));
      }
    },
  });

  const handleSelectQuiz = useCallback((quiz: QuizSummary) => {
    setStage({ type: "select", quiz });
  }, []);

  const handleStartAttempt = useCallback(async (type: "pre" | "post" | "proficiency") => {
    if (stage.type !== "select") return;
    const fullQuiz = await loadQuizMut.mutateAsync(stage.quiz.id);
    setStage({ type: "run", quiz: fullQuiz, attemptType: type });
  }, [stage, loadQuizMut]);

  const backLabel = stage.type === "list" ? null
    : stage.type === "select" ? "← Semua Quiz"
    : stage.type === "run" ? "← Pilih Mode"
    : "← Pilih Mode";

  const goBack = () => {
    if (stage.type === "select") setStage({ type: "list" });
    else if (stage.type === "run") setStage({ type: "select", quiz: stage.quiz });
    else if (stage.type === "result") setStage({ type: "list" });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          {stage.type === "list" ? (
            <Link href="/sessions">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goBack}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-xl font-bold">Quiz PKB</h1>
            <p className="text-sm text-muted-foreground">
              {stage.type === "list" && "Pilih quiz untuk mengukur penguasaan Anda"}
              {stage.type === "select" && "Pilih mode pengerjaan"}
              {stage.type === "run" && stage.quiz.title}
              {stage.type === "result" && "Hasil Quiz"}
            </p>
          </div>
        </div>

        {/* Content */}
        {stage.type === "list" && (
          isLoading ? (
            <div className="text-sm text-muted-foreground">Memuat quiz…</div>
          ) : quizzes.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Belum ada quiz tersedia.</p>
                <p className="text-xs mt-1">Admin akan menambahkan quiz sesuai jabatan kerja Anda.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {quizzes.map((q) => (
                <QuizCard key={q.id} quiz={q} attempts={attempts} onSelect={handleSelectQuiz} />
              ))}
            </div>
          )
        )}

        {stage.type === "select" && (
          <AttemptTypeSelector
            quiz={stage.quiz}
            attempts={attempts}
            onSelect={handleStartAttempt}
          />
        )}

        {stage.type === "run" && (
          <QuizRunner
            quiz={stage.quiz}
            attemptType={stage.attemptType}
            onComplete={(result) =>
              setStage({ type: "result", quiz: stage.quiz, result, attemptType: stage.attemptType })
            }
          />
        )}

        {stage.type === "result" && (
          <QuizResult
            result={stage.result}
            quiz={stage.quiz}
            attemptType={stage.attemptType}
            onRetry={() => setStage({ type: "run", quiz: stage.quiz, attemptType: stage.attemptType })}
            onBack={() => setStage({ type: "list" })}
          />
        )}

      </div>
    </div>
  );
}
