/**
 * Unit tests for quiz question validation logic (validateQuestions).
 *
 * Covers:
 *  - blank question text
 *  - blank option text
 *  - missing correctId
 *  - duplicate question IDs
 *  - duplicate question text (different IDs, same content)
 *  - missing/non-array/empty questions on POST (requireNonEmpty=true)
 *  - PATCH semantics: missing questions field is allowed (requireNonEmpty=false)
 *  - malformed question shape (non-object entry)
 *  - valid questions pass
 */

import { describe, it, expect } from "vitest";
import { validateQuestions } from "../routes/quizzes";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: "q1",
    text: "Apa fungsi K3 di proyek konstruksi?",
    options: [
      { id: "a", text: "Menjaga keselamatan pekerja" },
      { id: "b", text: "Mempercepat pekerjaan" },
      { id: "c", text: "Mengurangi biaya" },
      { id: "d", text: "Meningkatkan estetika" },
    ],
    correctId: "a",
    explanation: "K3 bertujuan menjaga keselamatan pekerja.",
    ...overrides,
  };
}

function twoValidQuestions() {
  return [
    makeQuestion({ id: "q1", text: "Pertanyaan pertama?" }),
    makeQuestion({ id: "q2", text: "Pertanyaan kedua yang berbeda?" }),
  ];
}

// ── requireNonEmpty (POST semantics) ─────────────────────────────────────────

describe("validateQuestions — POST (requireNonEmpty=true)", () => {
  it("rejects undefined questions", () => {
    expect(validateQuestions(undefined, true)).toBeTruthy();
  });

  it("rejects null questions", () => {
    expect(validateQuestions(null, true)).toBeTruthy();
  });

  it("rejects non-array questions", () => {
    expect(validateQuestions({ id: "q1" }, true)).toBeTruthy();
  });

  it("rejects empty array", () => {
    expect(validateQuestions([], true)).toBeTruthy();
  });

  it("accepts a valid non-empty array", () => {
    expect(validateQuestions(twoValidQuestions(), true)).toBeNull();
  });
});

// ── PATCH semantics (requireNonEmpty=false) ───────────────────────────────────

describe("validateQuestions — PATCH (requireNonEmpty=false)", () => {
  it("allows undefined (field omitted)", () => {
    expect(validateQuestions(undefined, false)).toBeNull();
  });

  it("rejects non-array value (explicit wrong type)", () => {
    expect(validateQuestions("not-an-array", false)).toBeTruthy();
  });

  it("allows an empty array (admin clears all questions)", () => {
    // PATCH allows clearing; business rules can prevent this elsewhere
    expect(validateQuestions([], false)).toBeNull();
  });
});

// ── blank content ─────────────────────────────────────────────────────────────

describe("validateQuestions — blank content", () => {
  it("rejects a question with blank text", () => {
    const qs = [makeQuestion({ text: "" })];
    const err = validateQuestions(qs);
    expect(err).toMatch(/teks soal tidak boleh kosong/i);
    expect(err).toMatch(/Soal #1/);
  });

  it("rejects a question with whitespace-only text", () => {
    const qs = [makeQuestion({ text: "   " })];
    expect(validateQuestions(qs)).toMatch(/teks soal tidak boleh kosong/i);
  });

  it("rejects a question with a blank option", () => {
    const qs = [makeQuestion({
      options: [
        { id: "a", text: "Opsi valid" },
        { id: "b", text: "" },
        { id: "c", text: "Lainnya" },
        { id: "d", text: "Lainnya 2" },
      ],
    })];
    const err = validateQuestions(qs);
    expect(err).toMatch(/opsi B tidak boleh kosong/i);
    expect(err).toMatch(/Soal #1/);
  });

  it("rejects a question with missing correctId", () => {
    const qs = [makeQuestion({ correctId: "" })];
    const err = validateQuestions(qs);
    expect(err).toMatch(/jawaban benar belum dipilih/i);
  });

  it("rejects a question with no options array", () => {
    const qs = [makeQuestion({ options: [] })];
    expect(validateQuestions(qs)).toMatch(/pilihan jawaban tidak boleh kosong/i);
  });

  it("rejects a question with only 1 option", () => {
    const qs = [makeQuestion({ options: [{ id: "a", text: "Satu-satunya opsi" }], correctId: "a" })];
    const err = validateQuestions(qs);
    expect(err).toMatch(/minimal harus ada 2 pilihan jawaban/i);
    expect(err).toMatch(/Soal #1/);
  });

  it("accepts a question with exactly 2 options", () => {
    const qs = [makeQuestion({
      options: [
        { id: "a", text: "Benar" },
        { id: "b", text: "Salah" },
      ],
      correctId: "a",
    })];
    expect(validateQuestions(qs)).toBeNull();
  });
});

// ── duplicate IDs ─────────────────────────────────────────────────────────────

describe("validateQuestions — duplicate IDs", () => {
  it("rejects two questions with the same ID", () => {
    const qs = [
      makeQuestion({ id: "q1", text: "Pertanyaan satu?" }),
      makeQuestion({ id: "q1", text: "Pertanyaan dua yang berbeda?" }),
    ];
    const err = validateQuestions(qs);
    expect(err).toMatch(/ID soal.*duplikat/i);
  });

  it("accepts questions with distinct IDs", () => {
    expect(validateQuestions(twoValidQuestions())).toBeNull();
  });
});

// ── duplicate question text ───────────────────────────────────────────────────

describe("validateQuestions — duplicate question text", () => {
  it("rejects two questions with identical text (different IDs)", () => {
    const qs = [
      makeQuestion({ id: "q1", text: "Apa fungsi K3?" }),
      makeQuestion({ id: "q2", text: "Apa fungsi K3?" }),
    ];
    const err = validateQuestions(qs);
    expect(err).toMatch(/duplikat/i);
    expect(err).toMatch(/Soal #2/);
  });

  it("rejects duplicate text differing only in case", () => {
    const qs = [
      makeQuestion({ id: "q1", text: "apa fungsi k3?" }),
      makeQuestion({ id: "q2", text: "APA FUNGSI K3?" }),
    ];
    expect(validateQuestions(qs)).toMatch(/duplikat/i);
  });

  it("rejects duplicate text differing only in whitespace", () => {
    const qs = [
      makeQuestion({ id: "q1", text: "Apa  fungsi   K3?" }),
      makeQuestion({ id: "q2", text: "Apa fungsi K3?" }),
    ];
    expect(validateQuestions(qs)).toMatch(/duplikat/i);
  });

  it("accepts questions with genuinely different text", () => {
    const qs = [
      makeQuestion({ id: "q1", text: "Apa fungsi K3 di proyek?" }),
      makeQuestion({ id: "q2", text: "Siapa yang bertanggung jawab atas K3?" }),
    ];
    expect(validateQuestions(qs)).toBeNull();
  });
});

// ── malformed shapes ──────────────────────────────────────────────────────────

describe("validateQuestions — malformed shapes", () => {
  it("rejects a non-object entry in the array", () => {
    expect(validateQuestions(["not-an-object"])).toMatch(/format tidak valid/i);
  });

  it("rejects an entry with non-string text field", () => {
    expect(validateQuestions([makeQuestion({ text: 42 })])).toMatch(/teks soal tidak boleh kosong/i);
  });

  it("rejects an entry with non-object option", () => {
    const qs = [makeQuestion({ options: ["opsi-string"] })];
    expect(validateQuestions(qs)).toMatch(/format opsi tidak valid/i);
  });
});
