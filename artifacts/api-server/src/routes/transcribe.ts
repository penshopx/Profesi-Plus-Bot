/**
 * POST /transcribe
 *
 * Transcribes an audio file to text using OpenAI Whisper.
 * Accepts multipart/form-data with a single `audio` field.
 * Rate-limited to 20 requests/hour per user to control costs.
 */

import { Router, type IRouter } from "express";
import multer from "multer";
import { requireAuth } from "../middlewares/auth";
import { chatMessageRateLimiter } from "../middlewares/rateLimiter";
import { getClientForModel } from "../lib/llm";
import { toFile } from "openai";

const router: IRouter = Router();

// Store uploads in memory (files are small voice clips — typically < 5 MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB Whisper limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("audio/") || file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Hanya file audio yang diperbolehkan"));
    }
  },
});

router.post(
  "/transcribe",
  requireAuth,
  chatMessageRateLimiter,
  upload.single("audio"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "File audio tidak ditemukan" });
      return;
    }

    let llm: ReturnType<typeof getClientForModel>;
    try {
      // Use OpenAI for Whisper (whisper-1 is OpenAI-only)
      llm = getClientForModel("gpt-4o");
    } catch {
      res.status(400).json({ error: "OpenAI belum dikonfigurasi. Set OPENAI_API_KEY di Secrets." });
      return;
    }

    try {
      const audioFile = await toFile(req.file.buffer, req.file.originalname || "audio.m4a", {
        type: req.file.mimetype || "audio/m4a",
      });

      const transcription = await llm.client.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: "id", // Indonesian
      });

      res.json({ text: transcription.text });
    } catch (err) {
      req.log.error({ err }, "Whisper transcription error");
      res.status(500).json({ error: "Gagal mentranskrip audio. Coba lagi." });
    }
  },
);

export default router;
