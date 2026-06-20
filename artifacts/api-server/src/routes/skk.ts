import { Router, type IRouter } from "express";
import { SKK_DATA, findJabkerGroup } from "../lib/skk-data";

const router: IRouter = Router();

router.get("/skk", (_req, res): void => {
  res.json(SKK_DATA.map(({ id, name, jenjang, units }) => ({ id, name, jenjang, unitCount: units.length })));
});

router.get("/skk/units", (req, res): void => {
  const jabker = typeof req.query.jabker === "string" ? req.query.jabker : "";
  if (!jabker) {
    res.status(400).json({ error: "jabker query param required" });
    return;
  }
  const group = findJabkerGroup(jabker);
  if (!group) {
    res.json({ jabker, units: [] });
    return;
  }
  res.json({ jabker: group.name, jenjang: group.jenjang, units: group.units });
});

export default router;
