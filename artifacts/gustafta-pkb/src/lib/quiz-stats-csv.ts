/**
 * CSV export builder for admin quiz statistics.
 *
 * Extracted from the admin dashboard so it can be unit-tested — in particular
 * the stale-answer columns ("Jawaban Opsi Terhapus" / "Catatan") that surface
 * attempt answers referencing options edited or deleted after submission.
 */
import type { QuizStats } from "./api-profile";

export function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildHeader(maxOptions: number): string[] {
  const header = [
    "No", "Pertanyaan", "Persen Salah (%)", "Jawaban Benar", "Teks Jawaban Benar", "Total Percobaan",
    "Jawaban Opsi Terhapus", "Catatan",
  ];
  for (let i = 0; i < maxOptions; i++) {
    header.push(`Opsi ${i + 1} ID`, `Opsi ${i + 1} Teks`, `Opsi ${i + 1} Jumlah`);
  }
  return header;
}

function buildQuestionRows(stats: QuizStats, maxOptions: number): (string | number)[][] {
  return stats.questions.map((q, idx) => {
    const correct = q.options.find((o) => o.id === q.correctId);
    const row: (string | number)[] = [
      idx + 1, q.text, q.failRate, q.correctId.toUpperCase(), correct?.text ?? "", stats.totalAttempts,
      q.staleAnswerCount ?? 0, q.staleAnswerNote ?? "",
    ];
    for (let i = 0; i < maxOptions; i++) {
      const opt = q.options[i];
      if (opt) row.push(opt.id.toUpperCase(), opt.text, q.optionCounts[opt.id] ?? 0);
      else row.push("", "", "");
    }
    return row;
  });
}

export function buildQuizStatsCsv(stats: QuizStats): string {
  const maxOptions = Math.max(0, ...stats.questions.map((q) => q.options.length));
  const rows = buildQuestionRows(stats, maxOptions);
  const lines = [buildHeader(maxOptions), ...rows].map((r) => r.map(csvEscape).join(","));
  // Quiz-level note for questions deleted after users answered — appended as a
  // trailing row so exported statistics are not silently incomplete.
  if (stats.removedQuestionNote) {
    lines.push(["", `CATATAN: ${stats.removedQuestionNote}`].map(csvEscape).join(","));
  }
  return lines.join("\r\n");
}

/**
 * Combined CSV covering every quiz — same columns as the single-quiz export,
 * prefixed with "Quiz ID" and "Judul Quiz" so rows stay distinguishable.
 */
export function buildAllQuizStatsCsv(statsList: QuizStats[]): string {
  const maxOptions = Math.max(
    0,
    ...statsList.flatMap((s) => s.questions.map((q) => q.options.length)),
  );
  const header = ["Quiz ID", "Judul Quiz", ...buildHeader(maxOptions)];
  const lines = [header.map(csvEscape).join(",")];
  for (const stats of statsList) {
    for (const row of buildQuestionRows(stats, maxOptions)) {
      lines.push([stats.quizId, stats.title, ...row].map(csvEscape).join(","));
    }
    if (stats.removedQuestionNote) {
      lines.push([stats.quizId, stats.title, "", `CATATAN: ${stats.removedQuestionNote}`].map(csvEscape).join(","));
    }
  }
  return lines.join("\r\n");
}
