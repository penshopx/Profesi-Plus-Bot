/**
 * Unit tests for the client-side quiz validation mirror (validateQuizQuestions).
 * Focus: correctId must reference an existing option (mirrors API validateQuestions).
 */

// kelola-quiz.tsx imports expo-router and react-query at module level; mock the
// non-CJS-friendly ones so we can import the pure validation function.
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));

import { validateQuizQuestions } from '../app/(home)/kelola-quiz';
import type { QuizQuestionAdmin } from '../lib/api';

function makeQuestion(overrides: Partial<QuizQuestionAdmin> = {}): QuizQuestionAdmin {
  return {
    id: 'q1',
    text: 'Apa fungsi K3 di proyek konstruksi?',
    options: [
      { id: 'a', text: 'Menjaga keselamatan pekerja' },
      { id: 'b', text: 'Mempercepat pekerjaan' },
      { id: 'c', text: 'Mengurangi biaya' },
      { id: 'd', text: 'Meningkatkan estetika' },
    ],
    correctId: 'a',
    explanation: 'K3 bertujuan menjaga keselamatan pekerja.',
    ...overrides,
  };
}

describe('validateQuizQuestions — correctId matches an option', () => {
  it('rejects a question whose correctId points to a non-existent option', () => {
    const err = validateQuizQuestions([makeQuestion({ correctId: 'z' })]);
    expect(err).toMatch(/Soal #1/);
    expect(err).toMatch(/tidak cocok dengan opsi/i);
  });

  it('reports the correct question number for a later mismatch', () => {
    const qs = [
      makeQuestion({ id: 'q1', text: 'Soal pertama?' }),
      makeQuestion({ id: 'q2', text: 'Soal kedua?', correctId: 'x' }),
    ];
    expect(validateQuizQuestions(qs)).toMatch(/Soal #2/);
  });

  it('accepts a question whose correctId matches an option id', () => {
    expect(validateQuizQuestions([makeQuestion({ correctId: 'b' })])).toBeNull();
  });

  it('still rejects an empty correctId with the "belum dipilih" message', () => {
    expect(validateQuizQuestions([makeQuestion({ correctId: '' })])).toMatch(
      /jawaban benar belum dipilih/i,
    );
  });
});
