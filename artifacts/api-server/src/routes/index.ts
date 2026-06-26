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

export default router;
