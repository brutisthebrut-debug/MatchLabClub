import { Router, type IRouter } from "express";
import { GetEngineMetaResponse } from "@workspace/api-zod";
import { ENGINE_VERSION } from "../lib/aiEngine";

const router: IRouter = Router();

router.get("/meta/engine", (_req, res) => {
  const data = GetEngineMetaResponse.parse({ engineVersion: ENGINE_VERSION });
  res.json(data);
});

export default router;
