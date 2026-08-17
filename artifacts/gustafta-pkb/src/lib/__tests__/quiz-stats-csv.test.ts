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

  it("quotes cells containing newlines so rows stay intact", () => {
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
    expect(csvEscape("line1\r\nline2")).toBe('"line1\r\nline2"');

    const multiline = {
      ...stats,
      removedQuestionNote: null,
      questions: [{ ...stats.questions[1], text: 'Soal "sulit",\ndengan baris baru' }],
    };
    const csv = buildQuizStatsCsv(multiline);
    expect(csv).toContain('"Soal ""sulit"",\ndengan baris baru"');
    // Naively splitting on \r\n must still yield header + 1 data segment split
    // only where the quoted newline sits — the quoted cell keeps its bare \n.
    expect(csv.split("\r\n")).toHaveLength(2);
  });

  it("leaves plain values unquoted", () => {
    expect(csvEscape("abc")).toBe("abc");
    expect(csvEscape(42)).toBe("42");
  });

  it("pads questions with fewer options than the widest question", () => {
    const uneven = {
      ...stats,
      removedQuestionNote: null,
      questions: [
        stats.questions[0], // 2 options
        {
          ...stats.questions[1],
          id: "q3",
          options: [
            { id: "a", text: "A" },
            { id: "b", text: "B" },
            { id: "c", text: "C" },
            { id: "d", text: "D" },
          ],
          correctId: "d",
          optionCounts: { a: 0, b: 0, c: 1, d: 1 },
        },
      ],
    };
    const csv = buildQuizStatsCsv(uneven);
    const lines = csv.split("\r\n");
    const header = lines[0].split(",");
    expect(header).toContain("Opsi 4 ID");
    expect(header).not.toContain("Opsi 5 ID");
    // Every row has exactly as many cells as the header.
    for (const line of lines.slice(1)) {
      expect(line.split(",")).toHaveLength(header.length);
    }
    // The 2-option question's option-3/4 cells are empty.
    const row1 = lines[1].split(",");
    const opt3Idx = header.indexOf("Opsi 3 ID");
    expect(row1.slice(opt3Idx, opt3Idx + 6)).toEqual(["", "", "", "", "", ""]);
  });

  it("resolves the correct-answer text from the matching option", () => {
    const csv = buildQuizStatsCsv({ ...stats, removedQuestionNote: null });
    const lines = csv.split("\r\n");
    const header = lines[0].split(",");
    const idIdx = header.indexOf("Jawaban Benar");
    const textIdx = header.indexOf("Teks Jawaban Benar");
    const row1 = lines[1].split(",");
    expect(row1[idIdx]).toBe("A");
    expect(row1[textIdx]).toBe("Opsi A");
    const row2 = lines[2].split(",");
    expect(row2[idIdx]).toBe("B");
    expect(row2[textIdx]).toBe("Opsi B");
  });

  it("emits empty text when the correct answer matches no option", () => {
    const broken = {
      ...stats,
      removedQuestionNote: null,
      questions: [{ ...stats.questions[0], correctId: "z" }],
    };
    const csv = buildQuizStatsCsv(broken);
    const lines = csv.split("\r\n");
    const header = lines[0].split(",");
    const row = lines[1].split(",");
    expect(row[header.indexOf("Jawaban Benar")]).toBe("Z");
    expect(row[header.indexOf("Teks Jawaban Benar")]).toBe("");
  });

  it("produces a header-only CSV for a quiz with no questions", () => {
    const empty = {
      ...stats,
      removedQuestionNote: null,
      removedQuestionCount: 0,
      removedAnswerCount: 0,
      questions: [],
    };
    const csv = buildQuizStatsCsv(empty);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(1);
    expect(lines[0].startsWith("No,Pertanyaan,")).toBe(true);
    // No option columns when there are no questions.
    expect(lines[0]).not.toContain("Opsi 1 ID");
  });
});
