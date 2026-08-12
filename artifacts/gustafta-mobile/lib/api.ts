/**
 * Thin API client for the Gustafta API server.
 * Bearer-token auth: set a getter with setAuthTokenGetter() in the home layout.
 * Base URL is built from EXPO_PUBLIC_DOMAIN env var.
 */

import { fetch as expoFetch } from 'expo/fetch';

let _authTokenGetter: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(getter: () => Promise<string | null>) {
  _authTokenGetter = getter;
}

/** Scalev checkout URL for buying Exum credits (set via EXPO_PUBLIC_SCALEV_CHECKOUT_URL). */
export const SCALEV_CHECKOUT_URL: string =
  process.env.EXPO_PUBLIC_SCALEV_CHECKOUT_URL ?? '';

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : '';
}

async function buildHeaders(
  extra: Record<string, string> = {},
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };
  if (_authTokenGetter) {
    const token = await _authTokenGetter();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = await buildHeaders(
    (options.headers as Record<string, string>) || {},
  );
  const url = `${getBaseUrl()}/api${path}`;
  // expo/fetch doesn't accept null values; only pass defined properties.
  const { body, signal, method } = options;
  const response = await expoFetch(url, {
    method,
    headers,
    ...(body != null ? { body } : {}),
    ...(signal != null ? { signal } : {}),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    throw new Error(`API ${response.status}: ${text}`);
  }
  return response;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type Conversation = {
  id: number;
  title: string;
  mode: string;
  jabker?: string | null;
  jenjang?: string | null;
  phase: string;
  createdAt: string;
  exumContent?: string | null;
};

export type Message = {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  createdAt: string;
};

export type ConversationWithMessages = Conversation & { messages: Message[] };

export type CompetencyUnitResult = {
  code: string;
  name: string;
  status: 'covered' | 'partial' | 'gap';
  rationale: string;
  evidenceRef: string | null;
};

export type CompetencyAnalysisResult = {
  summary: string;
  estimatedSkpk: number;
  readiness: string;
  units: CompetencyUnitResult[];
  gaps: string[];
  recommendations: string[];
};

/** Summary fields returned by GET /competency-studio (list endpoint) */
export type StudioAnalysis = {
  id: number;
  jabkerId?: string;
  jabkerName: string;
  jenjang?: string | null;
  klasifikasi?: string | null;
  estimatedSkpk: number;
  readiness: string;
  summary?: string | null;
  model?: string | null;
  createdAt: string;
  /** Present only on POST /competency-studio/analyze (full row with result JSON) */
  result?: CompetencyAnalysisResult | null;
};

export type UserProfile = {
  id: number;
  clerkUserId: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

export type UserPlan = {
  plan: string;
  expiresAt?: string | null;
  exumCredits?: number;
  canGenerate?: boolean;
};

// ─── Conversations ─────────────────────────────────────────────────────────────

export async function listConversations(): Promise<Conversation[]> {
  const res = await apiFetch('/chat/conversations');
  return res.json();
}

export async function createConversation(data: {
  title: string;
  mode: string;
  jabker?: string;
  jenjang?: string;
  model?: string;
}): Promise<Conversation> {
  const res = await apiFetch('/chat/conversations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getConversation(
  id: number,
): Promise<ConversationWithMessages> {
  const res = await apiFetch(`/chat/conversations/${id}`);
  return res.json();
}

export async function deleteConversation(id: number): Promise<void> {
  await apiFetch(`/chat/conversations/${id}`, { method: 'DELETE' });
}

// ─── Streaming chat ────────────────────────────────────────────────────────────

export async function streamMessage(
  conversationId: number,
  content: string,
  onChunk: (text: string) => void,
  onPhaseAdvance?: () => void,
  onContextWarning?: () => void,
): Promise<void> {
  const headers = await buildHeaders({ Accept: 'text/event-stream' });
  const url = `${getBaseUrl()}/api/chat/conversations/${conversationId}/messages`;
  const response = await expoFetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => 'Error');
    throw new Error(`API ${response.status}: ${text}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      if (data.includes('[[FASE_NAIK]]')) {
        onPhaseAdvance?.();
        continue;
      }
      try {
        const parsed = JSON.parse(data);
        if (parsed.contextWarning) onContextWarning?.();
        const chunk = parsed.content ?? parsed.text ?? parsed.delta;
        if (chunk) onChunk(chunk);
      } catch {
        // Not JSON; treat as raw text if non-empty and not a marker
        if (data && !data.startsWith('[')) onChunk(data);
      }
    }
  }
}

// ─── Usage / quota ─────────────────────────────────────────────────────────

export interface UsageInfo {
  resetAt: string | null;
  /** Server wall-clock at response time. Use to compute accurate countdown
   *  independent of device clock skew. */
  serverNow: string;
  used: number;
  limit: number;
  remaining: number;
  /** @deprecated use resetAt instead */
  windowMs?: number;
}

export async function getMyUsage(): Promise<UsageInfo> {
  const r = await apiFetch('/users/me/usage');
  return r.json();
}

export async function generateExum(
  conversationId: number,
): Promise<{ content: string }> {
  const res = await apiFetch('/chat/generate-exum', {
    method: 'POST',
    body: JSON.stringify({ conversationId }),
  });
  return res.json();
}

export async function advancePhase(
  conversationId: number,
): Promise<{ phase: string }> {
  const res = await apiFetch(
    `/chat/conversations/${conversationId}/advance-phase`,
    { method: 'POST' },
  );
  return res.json();
}

// ─── SKK / Jabker ─────────────────────────────────────────────────────────────

export async function listJabkers(): Promise<string[]> {
  const res = await apiFetch('/skk/jabkers');
  const data = await res.json();
  // Server returns { jabkers: string[] }
  if (data && Array.isArray(data.jabkers)) return data.jabkers;
  // Fallback: bare array
  if (Array.isArray(data)) {
    if (data.length === 0 || typeof data[0] === 'string') return data;
    return data.map((d: Record<string, unknown>) =>
      String(d.name ?? d.jabker ?? d.code ?? d),
    );
  }
  return [];
}

// ─── Competency Studio ────────────────────────────────────────────────────────

export async function listStudioAnalyses(): Promise<StudioAnalysis[]> {
  const res = await apiFetch('/competency-studio');
  return res.json();
}

export async function runStudioAnalysis(
  jabker: string,
  model?: string,
): Promise<StudioAnalysis> {
  const res = await apiFetch('/competency-studio/analyze', {
    method: 'POST',
    body: JSON.stringify({ jabker, ...(model ? { model } : {}) }),
  });
  return res.json();
}

/**
 * Returns true when the authenticated user already has at least one competency
 * analysis for the given jabker string. Used to decide whether to show the
 * Studio Kompetensi nudge banner in the chat screen.
 */
export async function checkCompetencyAnalysisForJabker(jabker: string): Promise<boolean> {
  const res = await apiFetch(`/competency-studio/check?jabker=${encodeURIComponent(jabker)}`);
  if (!res.ok) throw new Error('Failed to check competency analysis');
  const data = await res.json();
  return !!data.hasAnalysis;
}

// ─── Users / Profile ──────────────────────────────────────────────────────────

/**
 * Register an Expo push token with the server so it can notify this device
 * when an Exum finishes generating. `authToken` is passed explicitly because
 * this runs at app startup before setAuthTokenGetter has been called.
 */
export async function registerPushToken(
  pushToken: string,
  authToken: string,
): Promise<void> {
  const url = `${getBaseUrl()}/api/users/me/push-token`;
  await expoFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ token: pushToken }),
  }).catch(() => {}); // Non-fatal
}

/**
 * Transcribes an audio file to Indonesian text using Whisper.
 * `audioUri` is the local file URI from expo-av recording.
 * Returns the transcribed text.
 */
export async function transcribeAudio(
  audioUri: string,
  authToken: string,
): Promise<string> {
  const url = `${getBaseUrl()}/api/transcribe`;
  const formData = new FormData();
  formData.append('audio', {
    uri: audioUri,
    type: 'audio/m4a',
    name: 'voice-note.m4a',
  } as unknown as Blob);

  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Transcription failed: ${text || response.status}`);
  }

  const data = await response.json() as { text: string };
  return data.text ?? '';
}

export async function getMe(): Promise<UserProfile> {
  const res = await apiFetch('/users/me');
  return res.json();
}

export async function getMyPlan(): Promise<UserPlan> {
  const res = await apiFetch('/users/me/plan');
  return res.json();
}

// ─── Project Brain ────────────────────────────────────────────────────────────

export type ProjectBrainEntry = {
  id: number;
  userId: number;
  kind: string;
  title: string;
  organization: string | null;
  role: string | null;
  period: string | null;
  location: string | null;
  description: string;
  skkUnitCodes: string | null;
  jenjang: string | null;
  highlights: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function listProjectBrain(): Promise<ProjectBrainEntry[]> {
  const res = await apiFetch('/project-brain');
  return res.json();
}

export async function createProjectBrainEntry(data: {
  title: string;
  description: string;
  kind?: string;
  organization?: string;
  role?: string;
  period?: string;
  location?: string;
  highlights?: string;
  skkUnitCodes?: string;
  jenjang?: string;
}): Promise<ProjectBrainEntry> {
  const res = await apiFetch('/project-brain', {
    method: 'POST',
    body: JSON.stringify({ kind: 'project', ...data }),
  });
  return res.json();
}

export async function updateProjectBrainEntry(
  id: number,
  data: Partial<{
    title: string;
    description: string;
    kind: string;
    organization: string | null;
    role: string | null;
    period: string | null;
    location: string | null;
  }>,
): Promise<ProjectBrainEntry> {
  const res = await apiFetch(`/project-brain/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteProjectBrainEntry(id: number): Promise<void> {
  await apiFetch(`/project-brain/${id}`, { method: 'DELETE' });
}

// ─── Kegiatan PKB ─────────────────────────────────────────────────────────────

export interface PkbSkkUnit {
  id?: number;
  skkCode: string;
  skkName: string;
  jabkerId?: string;
  jabkerName?: string;
}

export interface PkbActivity {
  id: number;
  namaKegiatan: string;
  tanggalMulai: string;
  tanggalSelesai?: string | null;
  tempatKegiatan?: string | null;
  modePelaksanaan?: string | null;
  namaMateri?: string | null;
  penyelenggara?: string | null;
  namaInstruktur?: string | null;
  uraianSingkat?: string | null;
  linkRekaman?: string | null;
  jenisPkb?: string | null;
  jpPkb?: number | null;
  status: string;
  askomNote?: string | null;
  createdAt: string;
  updatedAt: string;
  skk: PkbSkkUnit[];
  docCount?: number;
}

export async function listMyKegiatanPkb(): Promise<PkbActivity[]> {
  const res = await apiFetch('/kegiatan');
  if (!res.ok) throw new Error('Gagal memuat daftar kegiatan');
  return res.json();
}

export async function getKegiatanPkb(id: number): Promise<PkbActivity> {
  const res = await apiFetch(`/kegiatan/${id}`);
  if (!res.ok) throw new Error('Gagal memuat detail kegiatan');
  return res.json();
}

export interface CreateKegiatanBody {
  namaKegiatan: string;
  tanggalMulai: string;
  tanggalSelesai?: string;
  tempatKegiatan?: string;
  modePelaksanaan?: string;
  namaMateri?: string;
  penyelenggara?: string;
  namaInstruktur?: string;
  uraianSingkat?: string;
  linkRekaman?: string;
  jenisPkb?: string;
  jpPkb?: number;
  /** Marketplace link — auto-marks course as watched server-side when present */
  marketplaceId?: string;
  courseTitle?: string;
  courseProvider?: string;
  courseJabkerList?: string[];
  courseSkkTagsList?: string[];
}

export async function createKegiatanPkb(body: CreateKegiatanBody): Promise<PkbActivity> {
  const res = await apiFetch('/kegiatan', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Gagal membuat kegiatan');
  }
  return res.json();
}

export async function updateKegiatanPkb(id: number, body: Partial<CreateKegiatanBody>): Promise<PkbActivity> {
  const patchRes = await apiFetch(`/kegiatan/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!patchRes.ok) {
    const err = await patchRes.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Gagal memperbarui kegiatan');
  }
  // Refetch the full activity (PATCH returns only { success, status })
  return getKegiatanPkb(id);
}

export async function deleteKegiatanPkb(id: number): Promise<void> {
  await apiFetch(`/kegiatan/${id}`, { method: 'DELETE' });
}

export async function updateKegiatanSkk(
  id: number,
  skk: PkbSkkUnit[],
): Promise<{ success: boolean; status: string; skk: PkbSkkUnit[] }> {
  const res = await apiFetch(`/kegiatan/${id}/skk`, {
    method: 'PUT',
    body: JSON.stringify({ skk }),
  });
  if (!res.ok) throw new Error('Gagal memperbarui SKK');
  return res.json();
}

export async function ajukanKegiatanPkb(id: number): Promise<{ success: boolean }> {
  const res = await apiFetch(`/kegiatan/${id}/ajukan`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Gagal mengajukan kegiatan');
  }
  return res.json();
}

export interface PkbActivityDoc {
  id: number;
  activityId: number;
  docType: string;
  filename: string;
  objectPath: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  caption?: string | null;
  uploadedAt: string;
}

export interface PkbJourneyEntry {
  id: number;
  activityId: number;
  event: string;
  label: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface PkbActivityDetail extends PkbActivity {
  docs: PkbActivityDoc[];
  journey: PkbJourneyEntry[];
}

export async function getKegiatanDetail(id: number): Promise<PkbActivityDetail> {
  const res = await apiFetch(`/kegiatan/${id}`);
  return res.json();
}

export async function requestUploadUrl(
  name: string,
  size: number,
  contentType: string,
): Promise<{ uploadURL: string; objectPath: string }> {
  const res = await apiFetch('/storage/uploads/request-url', {
    method: 'POST',
    body: JSON.stringify({ name, size, contentType }),
  });
  return res.json();
}

export async function registerKegiatanDoc(
  activityId: number,
  docType: string,
  filename: string,
  objectPath: string,
  mimeType: string,
  sizeBytes?: number,
): Promise<PkbActivityDoc> {
  const res = await apiFetch(`/kegiatan/${activityId}/docs`, {
    method: 'POST',
    body: JSON.stringify({ docType, filename, objectPath, mimeType, sizeBytes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Gagal mendaftarkan dokumen');
  }
  return res.json();
}

export async function deleteKegiatanDoc(activityId: number, docId: number): Promise<void> {
  await apiFetch(`/kegiatan/${activityId}/docs/${docId}`, { method: 'DELETE' });
}

// ─── Marketplace ──────────────────────────────────────────────────────────────

export interface MarketplaceWatchRecord {
  id: number;
  courseId: string;
  courseTitle?: string | null;
  watchedAt: string;
}

export interface MarketplaceWatchedResponse {
  watched: MarketplaceWatchRecord[];
  watchedIds: string[];
}

export async function getWatchedCourses(): Promise<MarketplaceWatchedResponse> {
  const res = await apiFetch('/marketplace/watched');
  return res.json();
}

export interface WatchMetadata {
  courseTitle?: string;
  /** Must match the `provider` field on the marketplace_courses table */
  provider?: string;
}

// ─── Marketplace catalog ──────────────────────────────────────────────────────

export interface MarketplaceSkkTag {
  code: string;
  name: string;
}

export interface MarketplaceAiReview {
  platform: string;
  platformIcon: string;
  rating: number;
  comment: string;
  relevanceScore: number;
  reviewedAt: string;
}

export interface MarketplaceAskomReview {
  reviewerName: string;
  credential: string;
  credentialNumber?: string;
  institution: string;
  rating: number;
  recommendation: string;
  comment: string;
  relevanceScore: number;
  strengths: string[];
  notes?: string;
  reviewedAt: string;
}

export interface MarketplaceCourseReviews {
  aiReviews: MarketplaceAiReview[];
  askomReview: MarketplaceAskomReview | null;
}

export interface MarketplaceCatalogCourse {
  id: string;
  title: string;
  provider: string;
  providerLogo: string;
  thumbnail: string;
  type: string;
  price: string;
  priceIdr: number | null;
  priceOriginalIdr: number | null;
  rating: number;
  ratingCount: number;
  durationMinutes: number;
  videoCount: number;
  quizCount: number;
  hasCertificate: boolean;
  jabker: string[];
  skkTags: MarketplaceSkkTag[];
  description: string;
  highlights: string[];
  curriculum: { type: string; title: string; duration: string }[];
  url: string;
  isBestSeller: boolean;
  isNew: boolean;
  isFeatured: boolean;
  sortOrder: number;
  reviews: MarketplaceCourseReviews;
}

export async function getMarketplaceCatalog(): Promise<MarketplaceCatalogCourse[]> {
  const res = await apiFetch('/marketplace/courses');
  const json = await res.json();
  return json.courses as MarketplaceCatalogCourse[];
}

export async function markCourseWatched(
  courseId: string,
  meta?: WatchMetadata,
): Promise<void> {
  await apiFetch(`/marketplace/${encodeURIComponent(courseId)}/watch`, {
    method: 'POST',
    body: JSON.stringify(meta ?? {}),
  });
}

export async function unmarkCourseWatched(courseId: string): Promise<void> {
  await apiFetch(`/marketplace/watched/${encodeURIComponent(courseId)}`, {
    method: 'DELETE',
  });
}

// ─── Credits & payments ───────────────────────────────────────────────────────

export interface PaymentRecord {
  id: number;
  provider: string;
  externalId: string;
  customerEmail: string;
  status: string;
  amount: number;
  creditsGranted: number;
  createdAt: string;
}

// ─── APL Profile & Claims ─────────────────────────────────────────────────────

export interface AplProfile {
  id: number;
  userId: number;
  nik?: string | null;
  tempatLahir?: string | null;
  tanggalLahir?: string | null;
  jenisKelamin?: string | null;
  agama?: string | null;
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

export interface AplClaim {
  id: number;
  skkUnitCode: string;
  skkUnitName: string;
  jabker: string;
  jenjang?: string | null;
  pencapaian: string;
  buktiUtama?: string | null;
  jenisBukti?: string | null;
  catatanTambahan?: string | null;
}

/** Returns (or creates) the authenticated user's APL 01 profile. */
export async function getMyAplProfile(): Promise<AplProfile> {
  const res = await apiFetch('/profiles/me');
  return res.json();
}

/** Returns the user's APL 02 competency claims. */
export async function getMyAplClaims(): Promise<AplClaim[]> {
  const res = await apiFetch('/profiles/me/claims');
  return res.json();
}

export async function getMyPayments(): Promise<PaymentRecord[]> {
  const res = await apiFetch('/users/me/payments');
  return res.json();
}

export async function claimPayment(
  orderId: string,
  customerEmail: string,
): Promise<{ ok: boolean; creditsGranted: number; alreadyClaimed?: boolean }> {
  const res = await apiFetch('/users/me/claim-payment', {
    method: 'POST',
    body: JSON.stringify({ orderId, customerEmail }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(
      new Error((body as { error?: string }).error ?? 'Gagal klaim pesanan'),
      { status: res.status, body },
    );
  }
  return res.json();
}

// ─── Quiz Admin ────────────────────────────────────────────────────────────────

export type QuizAdminSummary = {
  id: number;
  title: string;
  description?: string | null;
  jabker?: string | null;
  skkUnitCode?: string | null;
  skkUnitName?: string | null;
  quizType: 'learning' | 'proficiency';
  passingScore: number;
  isActive: boolean;
  questions?: unknown[];
  createdAt?: string;
  updatedAt?: string;
};

export type QuizQuestionAdmin = {
  id: string;
  text: string;
  options: { id: string; text: string }[];
  correctId: string;
  explanation?: string;
};

export type GeneratedQuestionsResult = {
  questions: QuizQuestionAdmin[];
  suggestedTitle: string;
};

export async function listAdminQuizzes(): Promise<QuizAdminSummary[]> {
  const res = await apiFetch('/quizzes/admin/all');
  return res.json();
}

export async function adminToggleQuiz(
  id: number,
  isActive: boolean,
): Promise<QuizAdminSummary> {
  const res = await apiFetch(`/quizzes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
  return res.json();
}

export async function adminGenerateQuestions(params: {
  jabker: string;
  skkUnitCode?: string;
  skkUnitName?: string;
  quizType?: 'learning' | 'proficiency';
  count?: number;
}): Promise<GeneratedQuestionsResult> {
  const res = await apiFetch('/quizzes/generate', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return res.json();
}

export async function adminCreateQuiz(data: {
  title: string;
  description?: string;
  jabker?: string;
  skkUnitCode?: string;
  skkUnitName?: string;
  quizType: 'learning' | 'proficiency';
  passingScore: number;
  questions: QuizQuestionAdmin[];
  isActive?: boolean;
}): Promise<QuizAdminSummary> {
  const res = await apiFetch('/quizzes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.json();
}
