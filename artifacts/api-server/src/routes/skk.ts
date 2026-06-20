import { Router, type IRouter } from "express";
import { SKK_DATA, findJabkerGroup, getAllJabkerNames, getJabkerByKlasifikasi } from "../lib/skk-data";

const router: IRouter = Router();

router.get("/skk", (_req, res): void => {
  res.json(
    SKK_DATA.map(({ id, name, jenjang, klasifikasi, subklasifikasi, units }) => ({
      id,
      name,
      jenjang,
      klasifikasi,
      subklasifikasi,
      unitCount: units.length,
    }))
  );
});

router.get("/skk/jabkers", (_req, res): void => {
  res.json({ jabkers: getAllJabkerNames() });
});

router.get("/skk/by-klasifikasi", (req, res): void => {
  const klasifikasi = typeof req.query.klasifikasi === "string" ? req.query.klasifikasi : "";
  if (!klasifikasi) {
    res.status(400).json({ error: "klasifikasi query param required" });
    return;
  }
  res.json(getJabkerByKlasifikasi(klasifikasi).map(({ id, name, jenjang, subklasifikasi, units }) => ({
    id, name, jenjang, subklasifikasi, unitCount: units.length,
  })));
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
  res.json({
    jabker: group.name,
    jenjang: group.jenjang,
    klasifikasi: group.klasifikasi,
    subklasifikasi: group.subklasifikasi,
    units: group.units,
  });
});

export default router;
