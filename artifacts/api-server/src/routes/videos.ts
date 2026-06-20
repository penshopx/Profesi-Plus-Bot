import { Router } from "express";
import { db, videos, users } from "@workspace/db";
import { eq, and, ilike, or } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

router.get("/videos", async (req, res) => {
  const { jabker, skk, q } = req.query as Record<string, string>;

  let query = db
    .select({
      id: videos.id,
      title: videos.title,
      url: videos.url,
      platform: videos.platform,
      jabker: videos.jabker,
      skkUnitCode: videos.skkUnitCode,
      skkUnitName: videos.skkUnitName,
      description: videos.description,
      tags: videos.tags,
      createdAt: videos.createdAt,
      uploader: {
        id: users.id,
        name: users.name,
        role: users.role,
      },
    })
    .from(videos)
    .leftJoin(users, eq(videos.uploadedBy, users.id));

  const conditions = [];
  if (jabker) conditions.push(ilike(videos.jabker, `%${jabker}%`));
  if (skk) conditions.push(
    or(
      ilike(videos.skkUnitCode, `%${skk}%`),
      ilike(videos.skkUnitName, `%${skk}%`)
    )
  );
  if (q) conditions.push(
    or(
      ilike(videos.title, `%${q}%`),
      ilike(videos.description, `%${q}%`),
      ilike(videos.tags, `%${q}%`)
    )
  );

  const results = conditions.length > 0
    ? await query.where(and(...conditions)).orderBy(videos.createdAt)
    : await query.orderBy(videos.createdAt);

  res.json(results);
});

router.get("/videos/:id", async (req, res) => {
  const id = Number(req.params.id);
  const result = await db
    .select({
      id: videos.id,
      title: videos.title,
      url: videos.url,
      platform: videos.platform,
      jabker: videos.jabker,
      skkUnitCode: videos.skkUnitCode,
      skkUnitName: videos.skkUnitName,
      description: videos.description,
      tags: videos.tags,
      createdAt: videos.createdAt,
      uploader: {
        id: users.id,
        name: users.name,
        role: users.role,
      },
    })
    .from(videos)
    .leftJoin(users, eq(videos.uploadedBy, users.id))
    .where(eq(videos.id, id))
    .limit(1);

  if (!result[0]) {
    res.status(404).json({ error: "Video not found" });
    return;
  }
  res.json(result[0]);
});

const CAN_UPLOAD = ["instruktur", "lembaga_diklat", "admin"];

router.post("/videos", requireAuth, requireRole(...CAN_UPLOAD), async (req, res) => {
  const { title, url, platform, jabker, skkUnitCode, skkUnitName, description, tags } = req.body as {
    title: string;
    url: string;
    platform?: string;
    jabker?: string;
    skkUnitCode?: string;
    skkUnitName?: string;
    description?: string;
    tags?: string;
  };

  if (!title || !url) {
    res.status(400).json({ error: "title and url are required" });
    return;
  }

  const [video] = await db.insert(videos).values({
    uploadedBy: req.dbUser!.id,
    title,
    url,
    platform: platform ?? detectPlatform(url),
    jabker: jabker ?? null,
    skkUnitCode: skkUnitCode ?? null,
    skkUnitName: skkUnitName ?? null,
    description: description ?? null,
    tags: tags ?? null,
  }).returning();

  res.status(201).json(video);
});

router.delete("/videos/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const video = await db.select().from(videos).where(eq(videos.id, id)).limit(1);

  if (!video[0]) {
    res.status(404).json({ error: "Video not found" });
    return;
  }

  const isOwner = video[0].uploadedBy === req.dbUser!.id;
  const isAdmin = req.dbUser!.role === "admin";

  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(videos).where(eq(videos.id, id));
  res.json({ success: true });
});

function detectPlatform(url: string): string {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("vimeo.com")) return "vimeo";
  if (url.includes("zoom.us")) return "zoom";
  return "other";
}

export default router;
