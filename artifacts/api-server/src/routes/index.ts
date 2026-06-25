import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import skkRouter from "./skk";
import usersRouter from "./users";
import videosRouter from "./videos";
import dialogGustaftaRouter from "./dialog-gustafta";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(skkRouter);
router.use(usersRouter);
router.use(videosRouter);
router.use(dialogGustaftaRouter);

export default router;
