const BASE = "/api";

export interface Conversation {
  id: number;
  title: string;
  mode: string;
  jabker: string | null;
  jenjang: string | null;
  phase: string;
  createdAt: string;
}

export interface Message {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  createdAt: string;
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
  createdAt: string;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
  evidence: EvidenceItem[];
}

export async function listConversations(): Promise<Conversation[]> {
  const r = await fetch(`${BASE}/chat/conversations`);
  return r.json();
}

export async function createConversation(data: {
  title: string;
  mode: string;
  jabker?: string;
  jenjang?: string;
}): Promise<Conversation> {
  const r = await fetch(`${BASE}/chat/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function getConversation(id: number): Promise<ConversationWithMessages> {
  const r = await fetch(`${BASE}/chat/conversations/${id}`);
  return r.json();
}

export async function deleteConversation(id: number): Promise<void> {
  await fetch(`${BASE}/chat/conversations/${id}`, { method: "DELETE" });
}

// ─── Evidence ─────────────────────────────────────────────────────────────────

export async function listEvidence(conversationId: number): Promise<EvidenceItem[]> {
  const r = await fetch(`${BASE}/chat/conversations/${conversationId}/evidence`);
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
  }
): Promise<EvidenceItem> {
  const r = await fetch(`${BASE}/chat/conversations/${conversationId}/evidence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function deleteEvidence(conversationId: number, evidenceId: number): Promise<void> {
  await fetch(`${BASE}/chat/conversations/${conversationId}/evidence/${evidenceId}`, {
    method: "DELETE",
  });
}

// ─── Generate Exum ────────────────────────────────────────────────────────────

export async function generateExum(
  conversationId: number
): Promise<{ content: string; conversationId: number }> {
  const r = await fetch(`${BASE}/chat/generate-exum`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId }),
  });
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
          body: JSON.stringify({ content }),
          signal: controller.signal,
        }
      );

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
