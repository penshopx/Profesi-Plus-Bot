/**
 * buildQuizStatsCsv — verifies the CSV export includes the stale-answer
 * columns so exported statistics are not silently incomplete when a question
 * was edited/deleted after users answered it (Task: quiz stats after edits).
 */
import { describe, it, expect } from "vitest";
import { buildQuizStatsCsv, csvEscape } from "../quiz-stats-csv";
import type { QuizStats } from "../api-profile";

const stats: QuizStats = {
  quizId: 7,
  title: "Quiz Uji",
  totalAttempts: 2,
  passCount: 1,
  passRate: 50,
  avgScore: 50,
  removedQuestionCount: 1,
  removedAnswerCount: 2,
  removedQuestionNote:
    "1 soal dihapus dari quiz setelah 2 jawaban peserta tercatat; jawaban tersebut tidak muncul di rincian per soal.",
  questions: [
    {
      id: "q1",
      text: "Pertanyaan 1",
      options: [
        { id: "a", text: "Opsi A" },
        { id: "b", text: "Opsi B" },
      ],
      correctId: "a",
      optionCounts: { a: 1, b: 0, unknown: 1 },
      staleAnswerCount: 1,
      staleAnswerNote:
        "1 jawaban merujuk opsi yang sudah diubah/dihapus setelah peserta mengerjakan.",
      failRate: 50,
    },
    {
      id: "q2",
      text: "Pertanyaan 2",
      options: [
        { id: "a", text: "Opsi A" },
        { id: "b", text: "Opsi B" },
      ],
      correctId: "b",
      optionCounts: { a: 0, b: 2 },
      staleAnswerCount: 0,
      staleAnswerNote: null,
      failRate: 0,
    },
  ],
};

describe("buildQuizStatsCsv", () => {
  it("includes stale-answer count and note columns", () => {
    const csv = buildQuizStatsCsv(stats);
    const lines = csv.split("\r\n");

    const header = lines[0].split(",");
    expect(header).toContain("Jawaban Opsi Terhapus");
    expect(header).toContain("Catatan");
    const staleIdx = header.indexOf("Jawaban Opsi Terhapus");
    const noteIdx = header.indexOf("Catatan");

    // q1 has one stale answer + a note
    const row1 = lines[1].split(",");
    expect(row1[staleIdx]).toBe("1");
    expect(lines[1]).toContain("diubah/dihapus");

    // q2 is clean: zero stale, empty note
    const row2 = lines[2].split(",");
    expect(row2[staleIdx]).toBe("0");
    expect(row2[noteIdx]).toBe("");
  });

  it("tolerates responses missing the stale fields (older cached payloads)", () => {
    const legacy = {
      ...stats,
      questions: [{ ...stats.questions[1], staleAnswerCount: undefined, staleAnswerNote: undefined }],
    } as unknown as QuizStats;
    const csv = buildQuizStatsCsv(legacy);
    const header = csv.split("\r\n")[0].split(",");
    const staleIdx = header.indexOf("Jawaban Opsi Terhapus");
    expect(csv.split("\r\n")[1].split(",")[staleIdx]).toBe("0");
  });

  it("appends a trailing note row when questions were deleted after attempts", () => {
    const csv = buildQuizStatsCsv(stats);
    const lines = csv.split("\r\n");
    expect(lines[lines.length - 1]).toContain("CATATAN:");
    expect(lines[lines.length - 1]).toContain("dihapus dari quiz");
  });

  it("omits the note row when no questions were removed", () => {
    const clean = { ...stats, removedQuestionCount: 0, removedAnswerCount: 0, removedQuestionNote: null };
    const csv = buildQuizStatsCsv(clean);
    expect(csv).not.toContain("CATATAN:");
  });

  it("escapes commas and quotes in cell values", () => {
    expect(csvEscape('a "b", c')).toBe('"a ""b"", c"');
  });
});
