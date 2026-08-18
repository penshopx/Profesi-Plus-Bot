import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import { getClientForModel, isKnownModel, listModels } from "../lib/llm";
import { buildHelpbotSystemPrompt, type HelpbotMode } from "../lib/regulation-knowledge";
import { helpbotRateLimiter } from "../middlewares/rateLimiter";

const router: IRouter = Router();

// Asisten Gustafta — floating helpbot. Anonymous-friendly (works on landing
// page too) so it is rate-limited per IP (PostgreSQL-backed, survives restarts)
// to protect LLM keys from denial-of-wallet abuse.

type ChatMsg = { role: "user" | "assistant"; content: string };

const MAX_MESSAGES = 12;
const MAX_CONTENT_LEN = 1000;
const PREFERRED_MODELS = ["gpt-4o-mini", "gemini-2.5-flash", "qwen-turbo", "deepseek-chat"];

function pickModel(): string | null {
  const available = listModels().filter((m) => m.available);
  for (const id of PREFERRED_MODELS) {
    if (available.some((m) => m.id === id) && isKnownModel(id)) return id;
  }
  return available[0]?.id ?? null;
}

router.post("/helpbot", helpbotRateLimiter, async (req, res): Promise<void> => {
  try {
    const body = req.body as { messages?: ChatMsg[]; mode?: string };
    const mode: HelpbotMode = body?.mode === "app" ? "app" : "regulasi";
    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    const messages: ChatMsg[] = rawMessages
      .filter(
        (m): m is ChatMsg =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim().length > 0,
      )
      .slice(-MAX_MESSAGES)
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CONTENT_LEN) }));

    if (!messages.some((m) => m.role === "user")) {
      res.status(400).json({ error: "messages must contain at least one user turn" });
      return;
    }

    const model = pickModel();
    if (!model) {
      res
        .status(503)
        .json({ error: "Belum ada model AI yang dikonfigurasi. Tambahkan API key di Secrets." });
      return;
    }

    const { client, model: resolvedModel } = getClientForModel(model);
    const completion = await client.chat.completions.create({
      model: resolvedModel,
      temperature: 0.4,
      max_tokens: 700,
      messages: [{ role: "system", content: buildHelpbotSystemPrompt(mode) }, ...messages],
    });

    const reply = completion.choices[0]?.message?.content?.trim();
    if (!reply) {
      res.status(502).json({ error: "Asisten tidak memberikan jawaban. Coba lagi." });
      return;
    }
    res.json({ reply });
  } catch (err) {
    logger.error({ err }, "helpbot failed");
    res.status(500).json({ error: "Asisten Gustafta sedang sibuk. Coba lagi sebentar." });
  }
});

export default router;
