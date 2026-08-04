import { Router, type IRouter } from "express";
import { COMMERCIAL_PLANS } from "../lib/commercialPlans";

const router: IRouter = Router();

router.get("/plans", (_req, res): void => {
  res.json({ plans: COMMERCIAL_PLANS });
});

export default router;
