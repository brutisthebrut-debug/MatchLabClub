import { Router, type IRouter } from "express";
import healthRouter from "./health";
import auditsRouter from "./audits";
import profilesRouter from "./profiles";
import messagesRouter from "./messages";
import insightsRouter from "./insights";
import waitlistRouter from "./waitlist";
import leadsRouter from "./leads";
import purchaseInterestRouter from "./purchaseInterest";
import founderRouter from "./founder";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(auditsRouter);
router.use(profilesRouter);
router.use(messagesRouter);
router.use(insightsRouter);
router.use(waitlistRouter);
router.use(leadsRouter);
router.use(purchaseInterestRouter);
router.use(founderRouter);
router.use(aiRouter);

export default router;
