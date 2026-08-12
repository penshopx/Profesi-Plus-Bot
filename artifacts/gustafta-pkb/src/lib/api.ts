const BASE = "/api";

export interface Conversation {
  id: number;
  title: string;
  mode: string;
  model: string;
  jabker: string | null;
  jenjang: string | null;
  personaId: string;
  phase: string;
  exumContent: string | null;
  evidenceCount: number;
  createdAt: string;
}

export interface Persona {
  id: string;
  name: string;
  title: string;
  tagline: string;
  expYears: number;
  klasifikasi: string[];
  icon: string;
  accent: string;
}

export async function listPersonas(): Promise<{ personas: Persona[]; defaultPersonaId: string }> {
  const r = await fetch(`${BASE}/personas`);
  return r.json();
}

export async function recommendPersona(jabker: string): Promise<{ personaId: string; klasifikasi: string | null; matched: boolean }> {
  const r = await fetch(`${BASE}/personas/recommend?jabker=${encodeURIComponent(jabker)}`);
  return r.json();
}

export interface ModelOption {
  id: string;
  label: string;
  provider: string;
  providerLabel: string;
  available: boolean;
}

export async function listModels(): Promise<{ models: ModelOption[]; defaultModel: string }> {
  const r = await fetch(`${BASE}/chat/models`);
  return r.json();
}

export interface Message {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  createdAt: string;
}

export interface SocratiDialog {
  q1: string; a1: string;
  q2: string; a2: string;
  q3: string; a3: string;
  q4: string; a4: string;
}

export interface EvidenceItem {
  id: number;
  conversationId: number;
  type: "learning" | "work_experience";
  category: string;
  title: string;
  url: string | null;
  description: string | null;
  skkNotes: string | null;
  skkUnitCode: string | null;
  skkUnitName: string | null;
  socratiDialog: string | null;
  socratiCompleted: boolean;
  tier: string;
  createdAt: string;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
  evidence: EvidenceItem[];
}

export interface SkkUnit {
  code: string;
  name: string;
  description: string;
}

export interface SkkUnitsResponse {
  jabker: string;
  isKnown: boolean;
  jenjang?: string;
  klasifikasi?: string;
  subklasifikasi?: string;
  units: SkkUnit[];
}

export async function listConversations(): Promise<Conversation[]> {
  const r = await fetch(`${BASE}/chat/conversations`, { credentials: "include" });
  if (!r.ok) return [];
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

export async function createConversation(data: {
  title: string;
  mode: string;
  model?: string;
  jabker?: string;
  jenjang?: string;
  personaId?: string;
}): Promise<Conversation> {
  const r = await fetch(`${BASE}/chat/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function getConversation(id: number): Promise<ConversationWithMessages> {
  const r = await fetch(`${BASE}/chat/conversations/${id}`, { credentials: "include" });
  return r.json();
}

export async function updateConversation(id: number, data: { title: string }): Promise<Conversation> {
  const r = await fetch(`${BASE}/chat/conversations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function deleteConversation(id: number): Promise<void> {
  await fetch(`${BASE}/chat/conversations/${id}`, { method: "DELETE", credentials: "include" });
}

// ─── SKK ──────────────────────────────────────────────────────────────────────

export async function fetchSkkUnits(jabker: string): Promise<SkkUnitsResponse> {
  const r = await fetch(`${BASE}/skk/units?jabker=${encodeURIComponent(jabker)}`);
  return r.json();
}

export async function fetchJabkerList(): Promise<string[]> {
  const r = await fetch(`${BASE}/skk/jabkers`);
  const data = await r.json();
  return data.jabkers ?? [];
}

// ─── Evidence ─────────────────────────────────────────────────────────────────

export async function listEvidence(conversationId: number): Promise<EvidenceItem[]> {
  const r = await fetch(`${BASE}/chat/conversations/${conversationId}/evidence`, { credentials: "include" });
  return r.json();
}

export async function createEvidence(
  conversationId: number,
  data: {
    type: string;
    category: string;
    title: string;
    url?: string;
    description?: string;
    skkNotes?: string;
    skkUnitCode?: string;
    skkUnitName?: string;
    socratiDialog?: SocratiDialog;
    socratiCompleted?: boolean;
    tier?: string;
  }
): Promise<EvidenceItem> {
  const r = await fetch(`${BASE}/chat/conversations/${conversationId}/evidence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function deleteEvidence(conversationId: number, evidenceId: number): Promise<void> {
  await fetch(`${BASE}/chat/conversations/${conversationId}/evidence/${evidenceId}`, {
    method: "DELETE",
    credentials: "include",
  });
}

export async function patchEvidence(
  conversationId: number,
  evidenceId: number,
  data: { socratiDialog: SocratiDialog; socratiCompleted: boolean }
): Promise<EvidenceItem> {
  const r = await fetch(`${BASE}/chat/conversations/${conversationId}/evidence/${evidenceId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  return r.json();
}

// ─── Generate Exum ────────────────────────────────────────────────────────────

export async function generateExum(
  conversationId: number
): Promise<{ content: string; conversationId: number }> {
  const r = await fetch(`${BASE}/chat/generate-exum`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ conversationId }),
  });
  if (r.status === 402) {
    const body = await r.json().catch(() => ({}));
    throw new PlanLimitError(body.error ?? "Kredit Exum Anda sudah habis.");
  }
  if (!r.ok) throw new Error("Gagal membuat Executive Summary");
  return r.json();
}

export async function advancePhase(conversationId: number): Promise<{ phase: string }> {
  const r = await fetch(`${BASE}/chat/conversations/${conversationId}/advance-phase`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!r.ok) throw new Error("Cannot advance phase");
  return r.json();
}

// ─── Streaming ────────────────────────────────────────────────────────────────

export function streamMessage(
  conversationId: number,
  content: string,
  onChunk: (text: string) => void,
  onDone: (phase: string) => void,
  onError: (err: string) => void
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(
        `${BASE}/chat/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ content }),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        let msg = `Terjadi kesalahan (${response.status})`;
        try {
          const data = await response.json();
          if (data?.error) msg = data.error;
        } catch {}
        onError(msg);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) { onError("No stream"); return; }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const json = line.slice(6).trim();
            if (!json) continue;
            try {
              const parsed = JSON.parse(json);
              if (parsed.content) onChunk(parsed.content);
              if (parsed.done) onDone(parsed.phase ?? "profiling");
              if (parsed.error) onError(parsed.error);
            } catch {}
          }
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") onError(String(e));
    }
  })();

  return () => controller.abort();
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface DbUser {
  id: number;
  clerkId: string;
  role: string;
  name: string;
  email: string;
  createdAt: string;
}

export async function getMe(): Promise<DbUser> {
  const res = await fetch(`${BASE}/users/me`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch user");
  return res.json();
}

// ─── Plan & Monetisasi ─────────────────────────────────────────────────────────

export interface PlanInfo {
  exumCredits: number;
  freeExumUsed: boolean;
  freeExumRemaining: number;
  canGenerate: boolean;
}

export async function getMyPlan(): Promise<PlanInfo> {
  const res = await fetch(`${BASE}/users/me/plan`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch plan");
  return res.json();
}

/** Thrown by generateExum when the user has no Exum credit left (HTTP 402). */
export class PlanLimitError extends Error {
  readonly code = "plan_limit";
  constructor(message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}

/** Scalev checkout URL for upgrading to Pro (set via VITE_SCALEV_CHECKOUT_URL). */
export const SCALEV_CHECKOUT_URL: string =
  (import.meta.env.VITE_SCALEV_CHECKOUT_URL as string | undefined) ?? "";

export async function listAllUsers(): Promise<DbUser[]> {
  const res = await fetch(`${BASE}/users`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

export async function updateUserRole(id: number, role: string): Promise<DbUser> {
  const res = await fetch(`${BASE}/users/${id}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error("Failed to update role");
  return res.json();
}

// ─── Otak Proyek (Project Brain) ───────────────────────────────────────────────

export const PROJECT_BRAIN_KINDS = ["project", "role", "achievement", "skill", "profile"] as const;
export type ProjectBrainKind = (typeof PROJECT_BRAIN_KINDS)[number];

export interface ProjectBrainEntry {
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
}

export interface ProjectBrainInput {
  kind: string;
  title: string;
  organization?: string | null;
  role?: string | null;
  period?: string | null;
  location?: string | null;
  description?: string;
  skkUnitCodes?: string | null;
  jenjang?: string | null;
  highlights?: string | null;
  isActive?: boolean;
}

export async function listProjectBrain(): Promise<ProjectBrainEntry[]> {
  const res = await fetch(`${BASE}/project-brain`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch project brain");
  return res.json();
}

export async function createProjectBrain(data: ProjectBrainInput): Promise<ProjectBrainEntry> {
  const res = await fetch(`${BASE}/project-brain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? "Failed to create entry");
  }
  return res.json();
}

export async function updateProjectBrain(id: number, data: Partial<ProjectBrainInput>): Promise<ProjectBrainEntry> {
  const res = await fetch(`${BASE}/project-brain/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? "Failed to update entry");
  }
  return res.json();
}

export async function deleteProjectBrain(id: number): Promise<void> {
  const res = await fetch(`${BASE}/project-brain/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete entry");
}

// ─── Studio Kompetensi (Competency Mapping) ─────────────────────────────────────

export type CompetencyUnitStatus = "covered" | "partial" | "gap";

export interface CompetencyUnitResult {
  code: string;
  name: string;
  status: CompetencyUnitStatus;
  rationale: string;
  evidenceRef: string | null;
}

export interface CompetencyResult {
  summary: string;
  estimatedSkpk: number;
  readiness: "kuat" | "cukup" | "lemah";
  units: CompetencyUnitResult[];
  gaps: string[];
  recommendations: string[];
}

export interface CompetencyAnalysisSummary {
  id: number;
  jabkerId: string;
  jabkerName: string;
  jenjang: string | null;
  klasifikasi: string | null;
  estimatedSkpk: number;
  readiness: "kuat" | "cukup" | "lemah";
  summary: string;
  model: string;
  createdAt: string;
}

export interface CompetencyAnalysisFull extends CompetencyAnalysisSummary {
  result: CompetencyResult;
}

export async function listCompetencyAnalyses(): Promise<CompetencyAnalysisSummary[]> {
  const res = await fetch(`${BASE}/competency-studio`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch analyses");
  return res.json();
}

export async function getCompetencyAnalysis(id: number): Promise<CompetencyAnalysisFull> {
  const res = await fetch(`${BASE}/competency-studio/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch analysis");
  return res.json();
}

export async function analyzeCompetency(jabker: string, model?: string): Promise<CompetencyAnalysisFull> {
  const res = await fetch(`${BASE}/competency-studio/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ jabker, model }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? "Gagal memetakan kompetensi");
  }
  return res.json();
}

export async function deleteCompetencyAnalysis(id: number): Promise<void> {
  const res = await fetch(`${BASE}/competency-studio/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete analysis");
}

// ─── Videos ───────────────────────────────────────────────────────────────────

export interface VideoUploader {
  id: number;
  name: string;
  role: string;
}

export interface VideoItem {
  id: number;
  title: string;
  url: string;
  platform: string;
  jabker: string | null;
  skkUnitCode: string | null;
  skkUnitName: string | null;
  description: string | null;
  tags: string | null;
  createdAt: string;
  uploader: VideoUploader | null;
}

export async function listVideos(params?: { jabker?: string; q?: string; skk?: string }): Promise<VideoItem[]> {
  const qs = new URLSearchParams();
  if (params?.jabker) qs.set("jabker", params.jabker);
  if (params?.q) qs.set("q", params.q);
  if (params?.skk) qs.set("skk", params.skk);
  const url = `${BASE}/videos${qs.toString() ? "?" + qs.toString() : ""}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch videos");
  return res.json();
}

export async function createVideo(data: {
  title: string;
  url: string;
  jabker?: string;
  skkUnitCode?: string;
  skkUnitName?: string;
  description?: string;
  tags?: string;
}): Promise<VideoItem> {
  const res = await fetch(`${BASE}/videos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? "Failed to create video");
  }
  return res.json();
}

export async function deleteVideo(id: number): Promise<void> {
  const res = await fetch(`${BASE}/videos/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete video");
}

// ─── Knowledge Base ──────────────────────────────────────────────────────────

export const KB_CATEGORIES = ["regulasi", "rubrik_exum", "contoh_exum", "panduan_skk", "umum"] as const;
export type KbCategory = (typeof KB_CATEGORIES)[number];

export interface KbEntry {
  id: number;
  category: string;
  title: string;
  content: string;
  klasifikasi: string | null;
  jenjang: string | null;
  skkUnitCode: string | null;
  tags: string | null;
  source: string | null;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KbInput {
  category: string;
  title: string;
  content: string;
  klasifikasi?: string | null;
  jenjang?: string | null;
  skkUnitCode?: string | null;
  tags?: string | null;
  source?: string | null;
  priority?: number;
  isActive?: boolean;
}

export async function listKnowledgeBase(params?: { q?: string; category?: string }): Promise<KbEntry[]> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.category) qs.set("category", params.category);
  const url = `${BASE}/knowledge-base${qs.toString() ? "?" + qs.toString() : ""}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch knowledge base");
  return res.json();
}

export async function createKnowledgeEntry(data: KbInput): Promise<KbEntry> {
  const res = await fetch(`${BASE}/knowledge-base`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? "Failed to create entry");
  }
  return res.json();
}

export async function updateKnowledgeEntry(id: number, data: Partial<KbInput>): Promise<KbEntry> {
  const res = await fetch(`${BASE}/knowledge-base/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? "Failed to update entry");
  }
  return res.json();
}

export async function deleteKnowledgeEntry(id: number): Promise<void> {
  const res = await fetch(`${BASE}/knowledge-base/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete entry");
}

export async function seedKnowledgeBase(): Promise<{ inserted: number; skipped: number }> {
  const res = await fetch(`${BASE}/knowledge-base/seed`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to seed knowledge base");
  return res.json();
}

// ─── Dialog Gustafta (public landing demo) ──────────────────────────────────

export interface DialogProfile {
  bidang: string;
  keahlian: string[];
  tantangan: string;
  potensiAwal: string;
}

export interface DialogBlueprintTeaser {
  ringkasan: string;
  potensiCount: number;
  unitSkkCount: number;
  materiExumCount: number;
  potensiPreview: string[];
}

export interface DialogGustaftaResponse {
  stage: 1 | 2;
  reply: string;
  profile?: DialogProfile;
  blueprintTeaser?: DialogBlueprintTeaser;
  locked?: boolean;
}

export async function dialogGustafta(
  messages: { role: "user" | "assistant"; content: string }[],
): Promise<DialogGustaftaResponse> {
  const res = await fetch(`${BASE}/dialog-gustafta`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? "Dialog Gustafta gagal merespons.");
  }
  return res.json();
}
