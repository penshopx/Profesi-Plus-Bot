/**
 * API client — APL 01 (profiles), APL 02 (competency claims), quizzes, outlines.
 */

const BASE = "/api";

// ─── Plan & usage ─────────────────────────────────────────────────────────────

export interface PlanInfo {
  exumCredits: number;
  freeExumUsed: boolean;
  freeExumRemaining: number;
  canGenerate: boolean;
}

export interface UsageInfo {
  used: number;
  limit: number;
  remaining: number;
  windowMs: number;
}

export async function getMyPlan(): Promise<PlanInfo> {
  return (await f("/users/me/plan")).json();
}

export async function getMyUsage(): Promise<UsageInfo> {
  return (await f("/users/me/usage")).json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Profile {
  id: number;
  userId: number;
  nik?: string | null;
  tempatLahir?: string | null;
  tanggalLahir?: string | null;
  jenisKelamin?: string | null;
  agama?: string | null;
  kewarganegaraan?: string | null;
  alamat?: string | null;
  rt?: string | null;
  rw?: string | null;
  kelurahan?: string | null;
  kecamatan?: string | null;
  kotaKabupaten?: string | null;
  provinsi?: string | null;
  kodePos?: string | null;
  nomorHp?: string | null;
  jenjangPendidikan?: string | null;
  namaInstitusi?: string | null;
  jurusan?: string | null;
  tahunLulus?: number | null;
  namaPerusahaan?: string | null;
  alamatPerusahaan?: string | null;
  jabatanSekarang?: string | null;
  tahunMulaiBekerja?: number | null;
  nomorSkk?: string | null;
  masaBerlakuSkk?: string | null;
  lembagaSertifikasi?: string | null;
  isComplete: boolean;
}

export interface CompetencyClaim {
  id: number;
  userId: number;
  skkUnitCode: string;
  skkUnitName: string;
  jabker: string;
  jenjang?: string | null;
  pencapaian: string;
  buktiUtama?: string | null;
  jenisBukti?: string | null;
  catatanTambahan?: string | null;
  lastProficiencyScore?: number | null;
  lastProficiencyAt?: string | null;
}

export interface QuizSummary {
  id: number;
  title: string;
  description?: string | null;
  jabker?: string | null;
  skkUnitCode?: string | null;
  quizType: "learning" | "proficiency";
  passingScore: number;
  isActive: boolean;
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: { id: string; text: string }[];
}

export interface QuizFull extends QuizSummary {
  questions: QuizQuestion[];
}

export interface QuizAttempt {
  id: number;
  userId: number;
  quizId: number;
  attemptType: "pre" | "post" | "proficiency";
  answers: Record<string, string>;
  score: number;
  totalQuestions: number;
  scorePercent: number;
  passed: boolean;
  completedAt: string;
}

export interface AttemptResult {
  attempt: QuizAttempt;
  feedback: { questionId: string; correct: boolean; explanation?: string }[];
  scorePercent: number;
  passed: boolean;
  passingScore: number;
}

export interface OutlineSection {
  id: string;
  title: string;
  points: string[];
  userNotes: string;
  order: number;
}

export interface ExumOutline {
  id: number;
  conversationId: number;
  sections: OutlineSection[];
  isApproved: boolean;
  approvedAt?: string | null;
}

// ─── APL 01 ──────────────────────────────────────────────────────────────────

async function f(path: string, init: RequestInit = {}) {
  const r = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init.headers as Record<string, string>) },
    ...init,
  });
  if (!r.ok) { const t = await r.text().catch(() => ""); throw new Error(`API ${r.status}: ${t}`); }
  return r;
}

// ─── APL 01 ──────────────────────────────────────────────────────────────────

export async function getMyProfile(): Promise<Profile> {
  return (await f("/profiles/me")).json();
}

export async function updateMyProfile(data: Partial<Profile>): Promise<Profile> {
  return (await f("/profiles/me", { method: "PATCH", body: JSON.stringify(data) })).json();
}

// ─── APL 02 ──────────────────────────────────────────────────────────────────

export async function listMyClaims(): Promise<CompetencyClaim[]> {
  return (await f("/profiles/me/claims")).json();
}

export async function createClaim(
  data: Omit<CompetencyClaim, "id" | "userId" | "lastProficiencyScore" | "lastProficiencyAt">,
): Promise<CompetencyClaim> {
  return (await f("/profiles/me/claims", { method: "POST", body: JSON.stringify(data) })).json();
}

export async function updateClaim(id: number, data: Partial<CompetencyClaim>): Promise<CompetencyClaim> {
  return (await f(`/profiles/me/claims/${id}`, { method: "PATCH", body: JSON.stringify(data) })).json();
}

export async function deleteClaim(id: number): Promise<void> {
  await f(`/profiles/me/claims/${id}`, { method: "DELETE" });
}

// ─── Quizzes ─────────────────────────────────────────────────────────────────

export async function listQuizzes(params?: { jabker?: string; type?: string }): Promise<QuizSummary[]> {
  const qs = new URLSearchParams();
  if (params?.jabker) qs.set("jabker", params.jabker);
  if (params?.type) qs.set("type", params.type);
  return (await f(`/quizzes${qs.toString() ? `?${qs}` : ""}`)).json();
}

export async function getQuiz(id: number): Promise<QuizFull> {
  return (await f(`/quizzes/${id}`)).json();
}

export async function submitQuizAttempt(
  quizId: number,
  answers: Record<string, string>,
  attemptType: "pre" | "post" | "proficiency",
): Promise<AttemptResult> {
  return (await f(`/quizzes/${quizId}/attempt`, { method: "POST", body: JSON.stringify({ answers, attemptType }) })).json();
}

export async function getMyAttempts(): Promise<QuizAttempt[]> {
  return (await f("/quizzes/my-attempts")).json();
}

// ─── Exum Outline ─────────────────────────────────────────────────────────────

export async function getExumOutline(conversationId: number): Promise<ExumOutline> {
  return (await f(`/outlines/${conversationId}`)).json();
}

export async function updateExumOutline(conversationId: number, sections: OutlineSection[]): Promise<ExumOutline> {
  return (await f(`/outlines/${conversationId}`, { method: "PATCH", body: JSON.stringify({ sections }) })).json();
}

export async function approveExumOutline(conversationId: number): Promise<ExumOutline> {
  return (await f(`/outlines/${conversationId}/approve`, { method: "POST" })).json();
}

export async function regenerateExumOutline(conversationId: number): Promise<ExumOutline> {
  return (await f(`/outlines/${conversationId}/regenerate`, { method: "POST" })).json();
}
