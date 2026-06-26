import { Router, type IRouter } from "express";
import { listPersonas, recommendPersona, isConfidentJabkerMatch, DEFAULT_PERSONA_ID } from "../lib/personas";
import { findJabkerGroup } from "../lib/skk-data";

const router: IRouter = Router();

// Public catalog of specialist personas (no user data, no LLM cost).
router.get("/personas", (_req, res): void => {
  res.json({ personas: listPersonas(), defaultPersonaId: DEFAULT_PERSONA_ID });
});

// Suggest the best specialist for a given Jabker (auto-recommendation). Only
// trusts a confident jabker match; otherwise falls back to the default persona.
router.get("/personas/recommend", (req, res): void => {
  const jabker = typeof req.query.jabker === "string" ? req.query.jabker : "";
  const group = jabker.trim() ? findJabkerGroup(jabker) : null;
  const matched = Boolean(group) && isConfidentJabkerMatch(jabker, group!.name);
  const persona = recommendPersona(matched ? group!.klasifikasi : null);
  res.json({
    personaId: persona.id,
    klasifikasi: matched ? group!.klasifikasi : null,
    matched,
  });
});

export default router;
