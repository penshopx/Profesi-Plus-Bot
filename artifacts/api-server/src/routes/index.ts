import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import skkRouter from "./skk";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(skkRouter);

export default router;
