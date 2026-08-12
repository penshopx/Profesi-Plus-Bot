import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import skkRouter from "./skk";
import usersRouter from "./users";
import videosRouter from "./videos";
import dialogGustaftaRouter from "./dialog-gustafta";
import knowledgeBaseRouter from "./knowledge-base";
import projectBrainRouter from "./project-brain";
import competencyStudioRouter from "./competency-studio";
import personasRouter from "./personas";
import scalevWebhookRouter from "./webhooks/scalev";
import transcribeRouter from "./transcribe";
import profilesRouter from "./profiles";
import quizzesRouter from "./quizzes";
import outlinesRouter from "./outlines";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(skkRouter);
router.use(usersRouter);
router.use(videosRouter);
router.use(dialogGustaftaRouter);
router.use(knowledgeBaseRouter);
router.use(projectBrainRouter);
router.use(competencyStudioRouter);
router.use(personasRouter);
router.use(scalevWebhookRouter);
router.use(transcribeRouter);
router.use(profilesRouter);
router.use(quizzesRouter);
router.use(outlinesRouter);

export default router;
