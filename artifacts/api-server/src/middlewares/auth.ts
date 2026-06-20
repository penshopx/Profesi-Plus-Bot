import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { db, users } from "@workspace/db";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      dbUser?: typeof users.$inferSelect;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const dbUser = await jitProvisionUser(auth.userId, req);
  req.dbUser = dbUser;
  next();
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const auth = getAuth(req);
  if (auth?.userId) {
    const dbUser = await jitProvisionUser(auth.userId, req);
    req.dbUser = dbUser;
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.dbUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.dbUser.role)) {
      res.status(403).json({ error: "Forbidden: insufficient role" });
      return;
    }
    next();
  };
}

async function jitProvisionUser(clerkId: string, req: Request) {
  const existing = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (existing.length > 0) return existing[0];

  const auth = getAuth(req);
  const name = (auth as any)?.sessionClaims?.name ?? "";
  const email = (auth as any)?.sessionClaims?.email ?? "";

  const [created] = await db.insert(users).values({
    clerkId,
    role: "user",
    name: String(name),
    email: String(email),
  }).returning();
  return created;
}
