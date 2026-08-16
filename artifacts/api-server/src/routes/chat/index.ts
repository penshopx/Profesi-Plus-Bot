import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, asc, count, gte, inArray, sql } from "drizzle-orm";
import { db, conversations, messages, evidenceItems, usageEvents, users, exumOutlines, quizAttempts, profiles, competencyAnalysis, pkbActivities, type Conversation } from "@workspace/db";
import { logger } from "../../lib/logger";
import { getClientForModel, listModels, isKnownModel, DEFAULT_MODEL, callWithFallback } from "../../lib/llm";
import { buildSystemPrompt, getPhaseInstruction } from "../../lib/pkb-system-prompt";
import { buildKnowledgeContext } from "../../lib/knowledge-base";
import { buildProjectBrainContextWithMeta, markProjectBrainUsed, getUsedProjectBrainIds, type ProjectBrainContextMeta } from "../../lib/project-brain";
import { buildHistoricalPKBContext, buildCompetencyAnalysisContext, buildQuizContext, buildProfileContext, buildKegiatanContext, buildWatchedModulesContext } from "../../lib/historical-pkb";
import { recommendPersona, isKnownPersona, isConfidentJabkerMatch, DEFAULT_PERSONA_ID } from "../../lib/personas";
import { findJabkerGroup } from "../../lib/skk-data";
import { requireAuth } from "../../middlewares/auth";
import { chatMessageRateLimiter, exumRateLimiter } from "../../middlewares/rateLimiter";
import { applySharedContextBudget } from "../../lib/context-budget";
import { buildChatContextBlocks, buildExumContextBlocks } from "../../lib/chat-context-blocks";
import { sendPushNotification } from "../../lib/push";
import { makeSafeCtx } from "../../lib/safe-ctx";

const router: IRouter = Router();

// ─── Models (public: no data, no cost) ──────────────────────────────────────────

router.get("/chat/models", async (_req, res): Promise<void> => {
  res.json({ models: listModels(), defaultModel: DEFAULT_MODEL });
});

// All /chat routes below require authentication. Scoped to the "/chat" prefix so
// this middleware does not run for other routers mounted after chat at the app root.
router.use("/chat", requireAuth);

/**
 * Load a conversation only if it belongs to the authenticated user.
 * Returns the conversation, or null after sending a 404 response (404 — not 403 —
 * to avoid leaking the existence of other users' conversations).
 */
async function loadOwnedConversation(
  req: Request,
  res: Response,
  id: number,
): Promise<Conversation | null> {
  if (Number.isNaN(id)) {
    res.status(404).json({ error: "Conversation not found" });
    return null;
  }
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!conv || conv.userId !== req.dbUser!.id) {
    res.status(404).json({ error: "Conversation not found" });
    return null;
  }
  return conv;
}

// ─── Conversations ────────────────────────────────────────────────────────────

router.get("/chat/conversations", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, req.dbUser!.id))
    .orderBy(asc(conversations.createdAt));
  const ids = rows.map((r: Conversation) => r.id);
  const countMap: Record<number, number> = {};
  if (ids.length) {
    const counts = await db
      .select({ conversationId: evidenceItems.conversationId, count: count() })
      .from(evidenceItems)
      .where(inArray(evidenceItems.conversationId, ids))
      .groupBy(evidenceItems.conversationId);
    counts.forEach((c: { conversationId: number; count: number }) => {
      countMap[c.conversationId] = Number(c.count);
    });
  }
  res.json(rows.map((r: Conversation) => ({ ...r, evidenceCount: countMap[r.id] ?? 0 })));
});

router.post("/chat/conversations", async (req, res): Promise<void> => {
  const { title, mode, jabker, jenjang, model, personaId } = req.body;
  if (!title || !mode) {
    res.status(400).json({ error: "title and mode are required" });
    return;
  }
  const selectedModel = typeof model === "string" && isKnownModel(model) ? model : DEFAULT_MODEL;
  // Resolve the specialist persona: honor an explicit valid choice, otherwise
  // auto-recommend from the target Jabker's SKK klasifikasi.
  let resolvedPersona = DEFAULT_PERSONA_ID;
  if (typeof personaId === "string" && isKnownPersona(personaId)) {
    resolvedPersona = personaId;
  } else if (typeof jabker === "string" && jabker.trim()) {
    const group = findJabkerGroup(jabker);
    const confident = group && isConfidentJabkerMatch(jabker, group.name);
    resolvedPersona = recommendPersona(confident ? group.klasifikasi : null).id;
  }
  const [conv] = await db
    .update(conversations)
    .set({ title: title.trim() })
    .where(eq(conversations.id, id))
    .returning();
  res.json(conv);
});

router.delete("/chat/conversations/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const conv = await loadOwnedConversation(req, res, convId);
  if (!conv) return;
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, convId))
      .orderBy(asc(messages.createdAt));
    const evidence = await db
      .select()
      .from(evidenceItems)
      .where(eq(evidenceItems.conversationId, convId))
      .orderBy(asc(evidenceItems.createdAt));
  res.json({ ...conv, messages: msgs, evidence });
});

router.patch("/chat/conversations/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { title } = req.body;
  if (!title || typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  const owned = await loadOwnedConversation(req, res, id);
  if (!owned) return;
  const [conv] = await db
    .update(conversations)
    .set({ title: title.trim() })
    .where(eq(conversations.id, id))
    .returning();
  res.json(conv);
});

router.delete("/chat/conversations/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const owned = await loadOwnedConversation(req, res, id);
  if (!owned) return;
  await db.delete(conversations).where(eq(conversations.id, id));
  res.sendStatus(204);
});

// ─── Evidence Items ───────────────────────────────────────────────────────────

router.get("/chat/conversations/:id/evidence", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const owned = await loadOwnedConversation(req, res, id);
  if (!owned) return;
  const items = await db
    .select()
    .from(evidenceItems)
    .where(eq(evidenceItems.conversationId, id))
    .orderBy(asc(evidenceItems.createdAt));
  res.json(items);
});

router.post("/chat/conversations/:id/evidence", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const {
    type, category, title, url, description, skkNotes,
    skkUnitCode, skkUnitName, socratiDialog, socratiCompleted, tier,
  } = req.body;
  if (!type || !title) {
    res.status(400).json({ error: "type and title are required" });
    return;
  }
  const conv = await loadOwnedConversation(req, res, convId);
  if (!conv) return;

  const socratiStr = socratiDialog ? JSON.stringify(socratiDialog) : null;

  const [item] = await db
    .update(evidenceItems)
    .set({ socratiDialog: socratiStr, socratiCompleted: socratiCompleted === true })
    .where(and(eq(evidenceItems.id, evidenceId), eq(evidenceItems.conversationId, id)))
    .returning();
  if (!item) { res.status(404).json({ error: "Evidence not found" }); return; }
  res.json(item);
});

// ─── Messages / Chat ──────────────────────────────────────────────────────────

router.get("/chat/conversations/:id/messages", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const evidenceId = parseInt(req.params.evidenceId, 10);
  const owned = await loadOwnedConversation(req, res, id);
  if (!owned) return;
  const [item] = await db
    .update(evidenceItems)
    .set({ socratiDialog: socratiStr, socratiCompleted: socratiCompleted === true })
    .where(and(eq(evidenceItems.id, evidenceId), eq(evidenceItems.conversationId, id)))
    .returning();
  if (!item) { res.status(404).json({ error: "Evidence not found" }); return; }
  res.json(item);
});

// ─── Messages / Chat ──────────────────────────────────────────────────────────

router.get("/chat/conversations/:id/messages", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const evidenceId = parseInt(req.params.evidenceId, 10);
  const owned = await loadOwnedConversation(req, res, id);
  if (!owned) return;
  const { socratiDialog, socratiCompleted } = req.body;
  const socratiStr = socratiDialog ? JSON.stringify(socratiDialog) : null;
  const [item] = await db
    .update(evidenceItems)
    .set({ socratiDialog: socratiStr, socratiCompleted: socratiCompleted === true })
    .where(and(eq(evidenceItems.id, evidenceId), eq(evidenceItems.conversationId, id)))
    .returning();
  if (!item) { res.status(404).json({ error: "Evidence not found" }); return; }
  res.json(item);
});

// ─── Messages / Chat ──────────────────────────────────────────────────────────

router.get("/chat/conversations/:id/messages", async (req, res): Promise<void> => {
  const convId = parseInt(req.params.id, 10);
  const owned = await loadOwnedConversation(req, res, convId);
  if (!owned) return;
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, convId))
    .orderBy(asc(messages.createdAt));
  res.json(msgs);
});

router.post("/chat/conversations/:id/messages", chatMessageRateLimiter, async (req, res): Promise<void> => {
  const convId = parseInt(req.params.id, 10);
  const { content } = req.body;

  if (!content || typeof content !== "string") {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const conv = await loadOwnedConversation(req, res, convId);
  if (!conv) return;

  await db.insert(messages).values({ conversationId: convId, role: "user", content });

  const existingMsgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, convId))
    .orderBy(asc(messages.createdAt));

    const evidence = await db
      .select()
      .from(evidenceItems)
      .where(eq(evidenceItems.conversationId, convId))
      .orderBy(asc(evidenceItems.createdAt));

  const lastUserMsg = [...existingMsgs].reverse().find((m: { role: string; content: string }) => m.role === "user")?.content ?? null;
  // safeCtx wraps each context builder so a single DB/network failure cannot
  // kill the entire chat request. Failures are logged and tracked so the
  // client can surface a non-blocking warning when personalisation blocks fail.
  const contextErrors: string[] = [];
  const safeCtx = makeSafeCtx(req.log, contextErrors);

  let pbMeta: ProjectBrainContextMeta = { text: "", blocks: [] };
  const [knowledgeContext, projectBrainContext, historicalPKBContext, competencyContext, quizContext, profileContext, kegiatanContext, watchedModulesContext] = await Promise.all([
    safeCtx("knowledge",       () => buildKnowledgeContext({ jabker: conv.jabker, jenjang: conv.jenjang, query: lastUserMsg })),
    safeCtx("projectBrain",    async () => {
      pbMeta = await buildProjectBrainContextWithMeta(req.dbUser!.id);
      return pbMeta.text;
    }),
    safeCtx("historical",      () => buildHistoricalPKBContext(req.dbUser!.id, convId)),
    safeCtx("competency",      () => buildCompetencyAnalysisContext(req.dbUser!.id)),
    safeCtx("quiz",            () => buildQuizContext(req.dbUser!.id)),
    safeCtx("profile",         () => buildProfileContext(req.dbUser!.id)),
    safeCtx("kegiatan",        () => buildKegiatanContext(req.dbUser!.id)),
    safeCtx("watchedModules",  () => buildWatchedModulesContext(req.dbUser!.id)),
  ]);

  // Detect silent context degradation: warn in logs if no personalisation data
  // reached the prompt. The AI would otherwise give generic advice without the
  // user knowing anything went wrong.
  const hasPersonalisation = profileContext || projectBrainContext || competencyContext || kegiatanContext;
  if (!hasPersonalisation) {
    req.log.warn({ userId: req.dbUser!.id, convId }, "All personalisation context blocks are empty — AI will give generic advice");
  }
  // Enforce a shared character budget across all context blocks.
  // Priority table lives in lib/chat-context-blocks.ts so the integration tests
  // can import and exercise the same wiring without maintaining a duplicate.
  const combinedContext = applySharedContextBudget(
    buildChatContextBlocks({
      profileContext,
      competencyContext,
      quizContext,
      watchedModulesContext,
      kegiatanContext,
      knowledgeContext,
      projectBrainContext,
      historicalPKBContext,
    }),
  );
  // Mark only entries whose block survived the shared budget (fire-and-forget).
  markProjectBrainUsed(pbMeta, combinedContext);
  // Also surface the used-entry IDs to the client so the Project Brain screen
  // can badge entries the AI actually read this turn.
  const usedBrainEntryIds = getUsedProjectBrainIds(pbMeta, combinedContext);
  const systemPrompt = buildSystemPrompt(
    conv.mode, conv.jabker, conv.jenjang, conv.phase, evidence,
    combinedContext,
    conv.personaId,
    req.dbUser!.name,
  );
  const phaseInstruction = getPhaseInstruction(conv.phase, conv.mode);

  const chatMessages = existingMsgs.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const primaryModel = conv.model ?? DEFAULT_MODEL;

  // Obtain a working stream BEFORE setting SSE headers so we can still fall back
  // to a different provider if the primary model's request fails on connection.
  let activeStream: AsyncIterable<import("openai/resources/chat/completions").ChatCompletionChunk>;
  let modelUsed = primaryModel;
  try {
    const { result: stream, modelUsed: mu } = await callWithFallback(
      primaryModel,
      (llm) => llm.client.chat.completions.create({
        model: llm.model,
        max_tokens: 8192,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt + "\n\n" + phaseInstruction },
          ...chatMessages,
        ],
      }),
      (msg) => req.log.warn({ msg }, "LLM fallback"),
    );
    activeStream = stream;
    modelUsed = mu;
  } catch (err) {
    req.log.error({ err }, "All LLM providers failed for stream");
    res.status(503).json({ error: "Semua layanan AI sedang tidak tersedia. Coba lagi dalam beberapa menit." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  if (modelUsed !== primaryModel) {
    res.setHeader("X-Model-Fallback", modelUsed);
  }

  // If any personalisation block threw (not just legitimately empty for a new
  // user), surface a non-blocking warning so the client can tell the user that
  // their profile data could not be loaded this turn.
  const PERSONALISATION_BLOCKS = ["profile", "projectBrain", "competency", "kegiatan"];
  const failedPersonalisation = contextErrors.filter((b) => PERSONALISATION_BLOCKS.includes(b));
  if (failedPersonalisation.length > 0) {
    res.write(`data: ${JSON.stringify({ contextWarning: true, failedBlocks: failedPersonalisation })}\n\n`);
    req.log.warn({ userId: req.dbUser!.id, convId, failedPersonalisation }, "Personalisation context failed — user notified");
  }

  // Tell the client which Project Brain entries were injected into the prompt
  // this turn. Sent even when empty so stale "used" badges can be cleared.
  res.write(`data: ${JSON.stringify({ usedBrainEntryIds })}\n\n`);

  let fullResponse = "";

  try {
    for await (const chunk of activeStream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullResponse += delta;
        res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
    }

    const MARKER = "[[FASE_NAIK]]";
    const hasMarker = fullResponse.includes(MARKER);
    const cleanResponse = fullResponse.replace(MARKER, "").trimEnd();

    await db.insert(messages).values({ conversationId: convId, role: "assistant", content: cleanResponse });

  const phases = ["profiling", "context", "core_interview", "evidence", "synthesis", "done"];
  const currentIdx = phases.indexOf(conv.phase);
  let nextPhase = (hasMarker && currentIdx >= 0 && currentIdx < phases.length - 2)
    ? phases[currentIdx + 1]
    : conv.phase;
    if (nextPhase !== conv.phase) {
      await db.update(conversations).set({ phase: nextPhase }).where(eq(conversations.id, convId));
    }

    res.write(`data: ${JSON.stringify({ done: true, phase: nextPhase })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "LLM stream error mid-stream");
    res.write(`data: ${JSON.stringify({ error: "Koneksi AI terputus. Coba kirim ulang pesan Anda." })}\n\n`);
    res.end();
  }
});

// ─── Manual Phase Advance ─────────────────────────────────────────────────────

router.post("/chat/conversations/:id/advance-phase", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const conv = await loadOwnedConversation(req, res, convId);
  if (!conv) return;

  const phases = ["profiling", "context", "core_interview", "evidence", "synthesis", "done"];
  const currentIdx = phases.indexOf(conv.phase);
  if (currentIdx < 0 || currentIdx >= phases.length - 2) {
    res.status(400).json({ error: "Cannot advance phase from current state", phase: conv.phase });
    return;
  }
  const nextPhase = phases[currentIdx + 1];
  await db.update(conversations).set({ phase: nextPhase }).where(eq(conversations.id, id));
  res.json({ phase: nextPhase });
});

// ─── Generate Exum ────────────────────────────────────────────────────────────

router.post("/chat/generate-exum", exumRateLimiter, async (req, res): Promise<void> => {
  const { conversationId } = req.body;
  if (!conversationId) {
    res.status(400).json({ error: "conversationId is required" });
    return;
  }

  const convId = parseInt(String(conversationId), 10);
  const conv = await loadOwnedConversation(req, res, convId);
  if (!conv) return;

  // Pay-per-Exum: each generation consumes one credit. New accounts get a free
  // trial. We reserve atomically (locking the user row so two concurrent requests
  // can't both pass) and refund on failure so a failed attempt never costs the user.
  const reservation = await db.transaction(async (tx) => {
    const [u] = await tx
      .select({ credits: users.exumCredits, freeUsed: users.freeExumUsed })
      .from(users)
      .where(eq(users.id, req.dbUser!.id))
      .for("update");
    if (!u) return { allowed: false as const };
    if (u.credits > 0) {
      await tx.update(users).set({ exumCredits: u.credits - 1 }).where(eq(users.id, req.dbUser!.id));
      return { allowed: true as const, source: "paid" as const };
    }
    if (!u.freeUsed) {
      await tx.update(users).set({ freeExumUsed: true }).where(eq(users.id, req.dbUser!.id));
      return { allowed: true as const, source: "free" as const };
    }
    return { allowed: false as const };
  });

  if (!reservation.allowed) {
    res.status(402).json({
      error: "Kredit Exum Anda sudah habis. Beli 1 Exum untuk membuat Executive Summary berikutnya.",
      code: "plan_limit",
    });
    return;
  }
  const creditSource: "paid" | "free" = reservation.source;

  // Refund the reserved credit/trial so ANY failure after reservation (context
  // build, model resolution, or the LLM call) never costs the user. Idempotent
  // per request: we only reach a failure path once.
  // Returns true only when the refund write is confirmed. Callers must NOT
  // claim "credit not deducted" / retrySafe unless this returns true — a DB
  // outage can cause both the original failure and a failed refund.
  const refundReservation = async (): Promise<boolean> => {
    try {
      if (creditSource === "paid") {
        await db.update(users).set({ exumCredits: sql`${users.exumCredits} + 1` }).where(eq(users.id, req.dbUser!.id));
      } else {
        await db.update(users).set({ freeExumUsed: false }).where(eq(users.id, req.dbUser!.id));
      }
      return true;
    } catch (refundErr) {
      req.log.error({ err: refundErr, userId: req.dbUser!.id, creditSource }, "Failed to refund Exum reservation");
      return false;
    }
  };

  try {
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, convId))
      .orderBy(asc(messages.createdAt));

    const evidence = await db
      .select()
      .from(evidenceItems)
      .where(eq(evidenceItems.conversationId, convId))
      .orderBy(asc(evidenceItems.createdAt));

    const transcript = msgs
      .map((m) => `${m.role === "user" ? "TKK" : "Pak Budi"}: ${m.content}`)
      .join("\n\n");

    const exumContextErrors: string[] = [];
    const safeExumCtx = makeSafeCtx(req.log, exumContextErrors);

    let exumPbMeta: ProjectBrainContextMeta = { text: "", blocks: [] };
    const [exumKnowledge, exumProjectBrain, exumHistorical, exumCompetency, exumQuiz, exumProfile, exumKegiatan, exumWatched, approvedOutlineRow] = await Promise.all([
      safeExumCtx("exum:knowledge",       () => buildKnowledgeContext({ jabker: conv.jabker, jenjang: conv.jenjang, query: conv.jabker })),
      safeExumCtx("exum:projectBrain",    async () => {
        exumPbMeta = await buildProjectBrainContextWithMeta(req.dbUser!.id);
        return exumPbMeta.text;
      }),
      safeExumCtx("exum:historical",      () => buildHistoricalPKBContext(req.dbUser!.id, conversationId)),
      safeExumCtx("exum:competency",      () => buildCompetencyAnalysisContext(req.dbUser!.id)),
      safeExumCtx("exum:quiz",            () => buildQuizContext(req.dbUser!.id)),
      safeExumCtx("exum:profile",         () => buildProfileContext(req.dbUser!.id)),
      safeExumCtx("exum:kegiatan",        () => buildKegiatanContext(req.dbUser!.id)),
      safeExumCtx("exum:watchedModules",  () => buildWatchedModulesContext(req.dbUser!.id)),
      db.select().from(exumOutlines)
        .where(and(eq(exumOutlines.conversationId, convId), eq(exumOutlines.isApproved, true)))
        .then((rows) => rows[0] ?? null)
        .catch((err) => { req.log.warn({ err }, "Failed to load approved outline — proceeding without it"); return null; }),
    ]);

    // Emit a structured alert for each monitored personalisation block that
    // failed so it can be monitored (quiz, profile, competency, kegiatan).
    const MONITORED_EXUM_BLOCKS = ["quiz", "profile", "competency", "kegiatan"] as const;
    for (const block of MONITORED_EXUM_BLOCKS) {
      if (exumContextErrors.includes(`exum:${block}`)) {
        req.log.warn(
          { userId: req.dbUser!.id, convId, context_block_failed: block },
          `${block} context block failed for Exum — generation will proceed without ${block} data`,
        );
      }
    }

    // Build outline context — inject user-approved structure when present
    // The sections column is free-form JSON from the DB — validate its shape
    // before use so a corrupt row degrades to "no blueprint" instead of a 500
    // (which would burn the user's credit without producing an Exum).
    let outlineContext = "";
    if (approvedOutlineRow) {
      const raw = approvedOutlineRow.sections;
      const isValidSection = (
        s: unknown,
      ): s is { title: string; points: string[]; userNotes?: string } =>
        !!s &&
        typeof s === "object" &&
        typeof (s as { title?: unknown }).title === "string" &&
        Array.isArray((s as { points?: unknown }).points) &&
        ((s as { points: unknown[] }).points).every((p) => typeof p === "string") &&
        (typeof (s as { userNotes?: unknown }).userNotes === "string" ||
          (s as { userNotes?: unknown }).userNotes === undefined);
      // All-or-nothing: a partially valid blueprint would send a broken,
      // half-rendered structure to the model, which is worse than none at all.
      const secs =
        Array.isArray(raw) && raw.length > 0 && raw.every(isValidSection)
          ? raw
          : null;
      if (secs) {
        const outline = secs.map((s, i) => {
          const pts = s.points.map((p) => `    - ${p}`).join("\n");
          const note = s.userNotes ? `\n    [Instruksi khusus: ${s.userNotes}]` : "";
          return `${i + 1}. ${s.title}\n${pts}${note}`;
        }).join("\n");
        outlineContext = `\n\nBLUEPRINT YANG TELAH DISETUJUI PENGGUNA:\nGunakan struktur berikut sebagai kerangka wajib penulisan Exum:\n${outline}\n\nPENTING: Ikuti urutan dan judul bagian di atas dengan tepat. Setiap bagian wajib memuat semua poin yang disebutkan.`;
      } else {
        req.log.warn(
          { convId, outlineId: approvedOutlineRow.id },
          "Approved outline row has malformed or empty sections — proceeding without blueprint context",
        );
      }
    }

    // Enforce the same shared budget for Exum context.
    // outlineContext (approved blueprint) gets highest priority since it drives
    // the document structure. historicalPKBContext is trimmed first.
    // Priority table lives in lib/chat-context-blocks.ts (buildExumContextBlocks)
    // so the integration tests exercise the same wiring without a duplicate.
    const exumCombinedContext = applySharedContextBudget(
      buildExumContextBlocks({
        outlineContext,
        profileContext:        exumProfile,
        competencyContext:     exumCompetency,
        quizContext:           exumQuiz,
        watchedModulesContext: exumWatched,
        kegiatanContext:       exumKegiatan,
        knowledgeContext:      exumKnowledge,
        projectBrainContext:   exumProjectBrain,
        historicalPKBContext:  exumHistorical,
      }),
    );
    markProjectBrainUsed(exumPbMeta, exumCombinedContext);
    const exumPrompt = buildExumPrompt(
      conv.mode, conv.jabker, conv.jenjang, transcript, evidence,
      exumCombinedContext,
      req.dbUser!.name,
    );

    let exumResponse: string;
    try {
      const { result } = await callWithFallback(
        conv.model ?? DEFAULT_MODEL,
        (llm) => llm.client.chat.completions.create({
          model: llm.model,
          max_tokens: 8192,
          messages: [{ role: "user", content: exumPrompt }],
        }),
        (msg) => req.log.warn({ msg }, "Exum LLM fallback"),
      );
      exumResponse = result.choices[0]?.message?.content ?? "";
    } catch (err) {
      const refunded = await refundReservation();
      req.log.error({ err }, "All LLM providers failed for Exum generation");
      // Only claim the credit is intact (and mark retrySafe) when the refund
      // write was actually confirmed.
      res.status(503).json(
        refunded
          ? {
              error: "Semua layanan AI sedang tidak tersedia. Kredit tidak dikurangi. Coba lagi dalam beberapa menit.",
              // Credit was refunded and no partial Exum was persisted — the
              // client can safely offer an immediate retry.
              retrySafe: true,
            }
          : {
              error: "Semua layanan AI sedang tidak tersedia. Coba lagi dalam beberapa menit. Jika kredit Anda terpotong, hubungi admin.",
            },
      );
      return;
    }

    // If a personalisation context builder threw, the Exum was written without
    // that data. Show a visible footer notice naming what could not be loaded.
    // For each failed block we suppress its notice only when we can positively
    // confirm the user has zero relevant rows (nothing was lost). If the
    // confirmation query itself fails we fail conservatively and keep the notice.
    let finalExumResponse = exumResponse;
    // Surfaced to the client so it can show a visible warning banner and offer
    // a retry — mirrors the SSE contextWarning pattern used in the chat stream.
    let quizContextUnavailable = false;

    /** True when the user actually has data for the block (or we can't confirm otherwise). */
    const userLikelyHasData = async (countQuery: () => Promise<number>): Promise<boolean> => {
      try {
        return (await countQuery()) > 0;
      } catch (_err) {
        return true; // cannot confirm zero rows — fail conservatively
      }
    };

    // Human-readable labels for the footer note (Indonesian, matching the Exum language).
    const FOOTER_LABELS: Record<string, string> = {
      quiz: "data skor quiz",
      profile: "data profil APL 01",
      competency: "hasil analisis kompetensi (Studio Kompetensi)",
      kegiatan: "catatan kegiatan PKB",
    };

    const countFor = async (block: string): Promise<number> => {
      const uid = req.dbUser!.id;
      switch (block) {
        case "quiz": {
          const [row] = await db.select({ total: count() }).from(quizAttempts).where(eq(quizAttempts.userId, uid));
          return Number(row?.total ?? 1);
        }
        case "profile": {
          const [row] = await db.select({ total: count() }).from(profiles).where(eq(profiles.userId, uid));
          return Number(row?.total ?? 1);
        }
        case "competency": {
          const [row] = await db.select({ total: count() }).from(competencyAnalysis).where(eq(competencyAnalysis.userId, uid));
          return Number(row?.total ?? 1);
        }
        case "kegiatan": {
          const [row] = await db.select({ total: count() }).from(pkbActivities).where(eq(pkbActivities.userId, uid));
          return Number(row?.total ?? 1);
        }
        default:
          return 1;
      }
    };

    const lostBlocks: string[] = [];
    for (const block of MONITORED_EXUM_BLOCKS) {
      if (!exumContextErrors.includes(`exum:${block}`)) continue;
      if (await userLikelyHasData(() => countFor(block))) {
        lostBlocks.push(block);
      }
    }

    quizContextUnavailable = lostBlocks.includes("quiz");
    if (lostBlocks.length > 0) {
      const labels = lostBlocks.map((b) => FOOTER_LABELS[b] ?? b).join(", ");
      finalExumResponse +=
        `\n\n---\n*Catatan sistem: ${labels.charAt(0).toUpperCase() + labels.slice(1)} tidak dapat dimuat saat Exum ini dibuat. ` +
        "Informasi tersebut mungkin tidak tercermin dalam ringkasan di atas.*";
      req.log.info({ userId: req.dbUser!.id, convId, lostBlocks }, "Appended context-unavailable footer to Exum response");
    }

    const content = finalExumResponse;
    await db.update(conversations)
      .set({ phase: "done", exumContent: content })
      .where(eq(conversations.id, conversationId));

    // Audit log of a successfully delivered Exum (source: paid credit or free trial).
    // Non-fatal: the Exum is already persisted, so a failed audit write must not
    // trigger the outer catch (which would refund the credit and return 500 for
    // a document the user already has).
    try {
      await db.insert(usageEvents).values({ userId: req.dbUser!.id, kind: `exum_${creditSource}` });
    } catch (auditErr) {
      req.log.warn({ err: auditErr, userId: req.dbUser!.id, conversationId }, "Failed to write Exum usage audit event (non-fatal)");
    }

    // Non-blocking push notification to the user's device.
    // sendPushNotification handles Expo ticket parsing and stale-token cleanup
    // (DeviceNotRegistered → clear expoPushToken) in a shared helper so all
    // push call sites get the same behaviour.
    const pushToken = req.dbUser!.expoPushToken;
    const pushUserId = req.dbUser!.id;
    if (pushToken) {
      sendPushNotification(pushUserId, pushToken, {
        title: "Exum Anda Siap! 🎉",
        body: "Executive Summary PKB telah selesai dibuat. Ketuk untuk melihat.",
        data: { conversationId: String(conversationId) },
        channelId: "exum",
      }, req.log).catch(() => {/* already logged inside helper */});
    }

    res.json({ content, conversationId, quizContextUnavailable });
  } catch (err) {
    const refunded = await refundReservation();
    req.log.error({ err }, "Generate Exum error");
    // retrySafe (and the "credit not deducted" reassurance) is only sent when
    // the refund write was confirmed; a DB outage can fail both the original
    // operation and the refund, in which case we must not invite a retry that
    // would consume another credit.
    res.status(500).json(
      refunded
        ? {
            error: "Gagal membuat Executive Summary. Kredit Anda tidak terpotong — silakan coba lagi.",
            // Credit was refunded and no partial Exum was persisted (the only
            // Exum write is a single atomic update on success) — retry is safe.
            retrySafe: true,
          }
        : {
            error: "Gagal membuat Executive Summary. Jika kredit Anda terpotong, hubungi admin.",
          },
    );
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface SocratiEntry { q1: string; a1: string; q2: string; a2: string; q3: string; a3: string; q4: string; a4: string }

type EvidenceRow = {
  type: string; category: string; title: string; url: string | null;
  description: string | null; skkNotes: string | null;
  skkUnitCode: string | null; skkUnitName: string | null;
  socratiDialog: string | null; socratiCompleted: boolean; tier: string;
};

function buildEvidenceContext(evidence: EvidenceRow[]): string {
  if (!evidence.length) return "";

  const learning = evidence.filter((e) => e.type === "learning");
  const workExp = evidence.filter((e) => e.type === "work_experience");

  const lines: string[] = ["\n\n=== BUKTI & SUMBER PENGETAHUAN PKB (SERPIHAN) ==="];
  lines.push("Setiap serpihan di bawah ini telah melalui Dialog Sokratik dengan Pak Budi untuk menggali pemahaman TKK secara mendalam.\n");

  if (learning.length) {
    lines.push("📚 PEMBELAJARAN PKB (Video/Webinar/Diklatkerja):");
    learning.forEach((e, i) => {
      lines.push(`\n  SERPIHAN L${i + 1}: [${e.category || "Video"}] ${e.title}`);
      if (e.url) lines.push(`    Link: ${e.url}`);
      if (e.description) lines.push(`    Deskripsi: ${e.description}`);
      if (e.skkUnitCode && e.skkUnitName) {
        lines.push(`    ✅ Unit SKK: ${e.skkUnitCode} — ${e.skkUnitName}`);
      } else if (e.skkNotes) {
        lines.push(`    ✅ Kesesuaian SKK: ${e.skkNotes}`);
      }
      if (e.socratiCompleted && e.socratiDialog) {
        try {
          const d: SocratiEntry = JSON.parse(e.socratiDialog);
          lines.push(`    💬 Dialog Sokratik:`);
          if (d.q1 && d.a1) lines.push(`      Pak Budi: "${d.q1}"\n      TKK: "${d.a1}"`);
          if (d.q2 && d.a2) lines.push(`      Pak Budi: "${d.q2}"\n      TKK: "${d.a2}"`);
          if (d.q3 && d.a3) lines.push(`      Pak Budi: "${d.q3}"\n      TKK: "${d.a3}"`);
          if (d.q4 && d.a4) lines.push(`      Pak Budi: "${d.q4}"\n      TKK: "${d.a4}"`);
        } catch {}
      }
    });
  }

  if (workExp.length) {
    lines.push("\n🏗️ PENGALAMAN PEKERJAAN (Bukti Lapangan):");
    workExp.forEach((e, i) => {
      lines.push(`\n  SERPIHAN K${i + 1}: [${e.category || "Dokumen"}] ${e.title}`);
      if (e.url) lines.push(`    Referensi: ${e.url}`);
      if (e.description) lines.push(`    Keterangan: ${e.description}`);
      if (e.skkUnitCode && e.skkUnitName) {
        lines.push(`    ✅ Unit SKK: ${e.skkUnitCode} — ${e.skkUnitName}`);
      } else if (e.skkNotes) {
        lines.push(`    ✅ Kesesuaian SKK: ${e.skkNotes}`);
      }
      if (e.socratiCompleted && e.socratiDialog) {
        try {
          const d: SocratiEntry = JSON.parse(e.socratiDialog);
          lines.push(`    💬 Dialog Sokratik:`);
          if (d.q1 && d.a1) lines.push(`      Pak Budi: "${d.q1}"\n      TKK: "${d.a1}"`);
          if (d.q2 && d.a2) lines.push(`      Pak Budi: "${d.q2}"\n      TKK: "${d.a2}"`);
          if (d.q3 && d.a3) lines.push(`      Pak Budi: "${d.q3}"\n      TKK: "${d.a3}"`);
          if (d.q4 && d.a4) lines.push(`      Pak Budi: "${d.q4}"\n      TKK: "${d.a4}"`);
        } catch {}
      }
    });
  }

  lines.push("\nGUNAKAN narasi TKK dari setiap serpihan di atas sebagai bahan utama wawancara dan penulisan Exum — gunakan kata-kata TKK sendiri.");
  return lines.join("\n");
}

function buildExumPrompt(
  mode: string,
  jabker: string | null,
  jenjang: string | null,
  transcript: string,
  evidence: EvidenceRow[],
  knowledgeContext: string = "",
  userName: string | null = null,
): string {
  const modeLabel =
    mode === "A" ? "Pengalaman Kerja" : mode === "B" ? "Hasil Belajar" : "Hybrid (Pengalaman + Hasil Belajar)";

  const evidenceContext = buildEvidenceContext(evidence);

  const socratiSummary = evidence
    .filter((e) => e.socratiCompleted && e.socratiDialog)
    .map((e, i) => {
      try {
        const d: SocratiEntry = JSON.parse(e.socratiDialog!);
        return `Serpihan ${i + 1} (${e.title}): pemahaman mendalam TKK — "${d.a1}" | "${d.a2}"`;
      } catch { return ""; }
    })
    .filter(Boolean)
    .join("\n");

  const skkCovered = [...new Set(
    evidence
      .filter((e) => e.skkUnitCode)
      .map((e) => `${e.skkUnitCode} — ${e.skkUnitName}`)
  )].join("\n  - ");

  return `Kamu adalah penulis profesional yang ahli dalam membuat Executive Summary (Exum) PKB (Pengembangan Keprofesian Berkelanjutan) sesuai Permen PUPR No. 12 Tahun 2021 dan SK Dirjen Bina Konstruksi No. 114 Tahun 2024.

Berdasarkan transkrip wawancara dan serpihan bukti di bawah ini, buatlah Executive Summary yang lengkap, profesional, dan berkualitas tinggi (setara 10-15 halaman A4).

INFORMASI PENULIS:
${userName ? `- Nama: ${userName}\n` : ""}- Jabatan Kerja: ${jabker ?? "Tenaga Ahli Konstruksi"}
- Jenjang SKK: ${jenjang ?? "Ahli"}
- Mode Exum: ${modeLabel}
${skkCovered ? `\nUNIT SKK YANG DICAKUP:\n  - ${skkCovered}` : ""}
${socratiSummary ? `\nINTISARI PEMAHAMAN TKK (dari Dialog Sokratik):\n${socratiSummary}` : ""}
${evidenceContext}${knowledgeContext}

TRANSKRIP WAWANCARA:
${transcript}

INSTRUKSI PENULISAN:
1. Tulis dalam bahasa Indonesia yang profesional, akademis, dan mudah dipahami
2. Gunakan struktur yang rapi dengan heading dan sub-heading yang jelas
3. WAJIB merujuk narasi dan kata-kata TKK dari Dialog Sokratik di setiap serpihan
4. Sebutkan secara eksplisit kode dan nama unit SKK yang dicakup setiap bagian
5. Kaitkan setiap bagian dengan unit SKK yang relevan (SK DJBK No. 114/2024)
6. Perkuat dengan data kuantitatif dari wawancara
7. Panjang total setara 10-15 halaman A4 (2500-4000 kata)
8. Exum harus mencerminkan perjalanan belajar NYATA TKK — bukan generik

${
  mode === "B"
    ? `STRUKTUR EXUM (Mode Hasil Belajar):
# EXECUTIVE SUMMARY
## Pengembangan Keprofesian Berkelanjutan — Hasil Belajar Mandiri

**1. PENDAHULUAN DAN IDENTITAS JABATAN KERJA** (1 halaman)
**2. RINGKASAN MATERI YANG DIPELAJARI** (1,5-2 halaman)
**3. ANALISIS DAN REFLEKSI PEMBELAJARAN** (2 halaman)
**4. RELEVANSI DENGAN KOMPETENSI JABATAN KERJA (SK DJBK 114/2024)** (2 halaman)
**5. PENERAPAN DALAM KONTEKS PEKERJAAN** (2-3 halaman)
**6. DAMPAK DAN MANFAAT YANG DIPEROLEH** (1,5 halaman)
**7. REKOMENDASI DAN RENCANA TINDAK LANJUT** (1,5 halaman)
**8. KESIMPULAN** (0,5 halaman)`
  : mode === "Hybrid"
    ? `STRUKTUR EXUM (Mode Hybrid — Pengalaman + Hasil Belajar):
# EXECUTIVE SUMMARY
## Pengembangan Keprofesian Berkelanjutan — Hybrid (Pengalaman & Pembelajaran)

**1. PENDAHULUAN DAN IDENTITAS JABATAN KERJA** (1 halaman)
**2. RINGKASAN EKSEKUTIF** (1 halaman)
**3. KONTEKS PROYEK DAN LATAR BELAKANG PEMBELAJARAN** (1,5-2 halaman — gabungkan proyek + motivasi belajar)
**4. RUANG LINGKUP PEKERJAAN DAN PENGALAMAN LAPANGAN** (1,5-2 halaman — STAR dari proyek utama)
**5. HASIL PEMBELAJARAN DAN REFLEKSI** (1,5-2 halaman — dari video/webinar/diklatkerja, metode Sokratik)
**6. SINERGI PENGALAMAN + PENGETAHUAN (BENANG MERAH SKK)** (2-2,5 halaman — bagaimana keduanya saling memperkuat, kaitkan ke unit SKK spesifik)
**7. CAPAIAN TERUKUR DAN BUKTI KOMPETENSI** (1,5-2 halaman — angka kuantitatif, dokumen ESIMPAN)
**8. PEMBELAJARAN DAN RENCANA TINDAK LANJUT** (1 halaman)
**9. KESIMPULAN** (0,5 halaman)`
    : `STRUKTUR EXUM (Mode Pengalaman Kerja):
# EXECUTIVE SUMMARY
## Pengembangan Keprofesian Berkelanjutan — Pengalaman Kerja

**1. HALAMAN JUDUL DAN IDENTITAS** (1 halaman)
**2. RINGKASAN EKSEKUTIF** (1-1,5 halaman)
**3. LATAR BELAKANG DAN KONTEKS PROYEK** (1,5-2 halaman)
**4. RUANG LINGKUP DAN PERAN TENAGA KERJA KONSTRUKSI** (1,5-2 halaman)
**5. TANTANGAN UTAMA DAN ANALISIS MASALAH** (1,5-2 halaman)
**6. PENDEKATAN DAN METODOLOGI YANG DITERAPKAN** (2-3 halaman)
**7. CAPAIAN DAN HASIL** (2-3 halaman — sertakan data kuantitatif)
**8. PEMBELAJARAN DAN REKOMENDASI** (1-1,5 halaman)
**9. PENUTUP** (0,5 halaman)`
}

Mulai langsung dengan konten, tanpa pengantar atau catatan tambahan.`;
}

export default router;
