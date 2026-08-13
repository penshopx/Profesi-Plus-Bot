import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { isEmailConfigured } from "../lib/email.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({
    status: "ok",
    emailConfigured: isEmailConfigured(),
  });
  res.json(data);
});

export default router;
