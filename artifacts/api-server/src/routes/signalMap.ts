import { Router, type IRouter } from "express";
import { computeReadiness } from "./matching";
import { buildSignalMap } from "../lib/signalMap";

const router: IRouter = Router();

// The signed-in user's signal-density map: a lane-by-lane view of how full the
// picture the machine holds of them is. Scoped strictly to the caller and built
// from their own readiness breakdown plus the effective weights, so the overall
// density always equals the readiness score shown everywhere else. It is purely
// a presentation lens over the signal registry: it never feeds the readiness
// score and never returns raw content, only registry metadata and the caller's
// own coverage numbers.
router.get("/me/signal-map", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const readiness = await computeReadiness(req.user.id);
  const map = buildSignalMap(
    readiness.breakdown,
    readiness.weights,
    readiness.score,
  );

  res.json(map);
});

export default router;
