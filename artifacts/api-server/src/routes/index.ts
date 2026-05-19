import { Router, type IRouter } from "express";
import healthRouter from "./health";
import auditsRouter from "./audits";
import profilesRouter from "./profiles";
import messagesRouter from "./messages";
import insightsRouter from "./insights";
import waitlistRouter from "./waitlist";

const router: IRouter = Router();

router.use(healthRouter);
router.use(auditsRouter);
router.use(profilesRouter);
router.use(messagesRouter);
router.use(insightsRouter);
router.use(waitlistRouter);

export default router;
