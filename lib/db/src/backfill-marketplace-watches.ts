/**
 * Backfill script: mark marketplace courses as "watched" for existing PKB
 * activities that already have a marketplace_id.
 *
 * The auto-watch logic only runs on new POST/PATCH requests, so activities
 * created before that feature landed never populated the watch tables and
 * the "Sudah Ditonton" badge would not appear until the user re-saved.
 *
 * Idempotent — both inserts use onConflictDoNothing against the unique
 * (user_id, course_id) indexes, so it is safe to run repeatedly.
 *
 * Run: cd lib/db && npx tsx src/backfill-marketplace-watches.ts
 */

import { db } from "./index";
import {
  pkbActivities,
  marketplaceWatches,
  marketplaceWatched,
  marketplaceCourses,
} from "./schema";
import { isNotNull, inArray } from "drizzle-orm";

async function backfill() {
  // 1. All activities linked to a marketplace course.
  const linked = await db
    .select({
      userId: pkbActivities.userId,
      marketplaceId: pkbActivities.marketplaceId,
    })
    .from(pkbActivities)
    .where(isNotNull(pkbActivities.marketplaceId));

  // Deduplicate (user, course) pairs — a user may log several activities
  // against the same course.
  const pairs = new Map<string, { userId: number; courseId: string }>();
  for (const row of linked) {
    if (!row.marketplaceId) continue;
    pairs.set(`${row.userId}:${row.marketplaceId}`, {
      userId: row.userId,
      courseId: row.marketplaceId,
    });
  }

  if (pairs.size === 0) {
    console.log("Backfill marketplace watches: nothing to do.");
    return;
  }

  // 2. Resolve title/provider/jabker/skkTags from the catalog where possible.
  const courseIds = [...new Set([...pairs.values()].map((p) => p.courseId))];
  const catalog = await db
    .select({
      id: marketplaceCourses.id,
      title: marketplaceCourses.title,
      provider: marketplaceCourses.provider,
      jabker: marketplaceCourses.jabker,
      skkTags: marketplaceCourses.skkTags,
    })
    .from(marketplaceCourses)
    .where(inArray(marketplaceCourses.id, courseIds));
  const byId = new Map(catalog.map((c) => [c.id, c]));

  let watchesInserted = 0;
  let watchedInserted = 0;

  for (const { userId, courseId } of pairs.values()) {
    const course = byId.get(courseId);
    const title = course?.title ?? courseId;
    const provider = course?.provider ?? "";
    const skkTagsList = Array.isArray(course?.skkTags)
      ? (course!.skkTags as { code?: string }[])
          .map((t) => t?.code)
          .filter((c): c is string => typeof c === "string" && c.length > 0)
      : [];

    // marketplaceWatches — richer table used for AI context.
    const w1 = await db
      .insert(marketplaceWatches)
      .values({
        userId,
        courseId,
        courseTitle: title || null,
        courseProvider: provider || null,
        jabkerList: course?.jabker ?? [],
        skkTagsList,
      })
      .onConflictDoNothing()
      .returning({ id: marketplaceWatches.id });
    watchesInserted += w1.length;

    // marketplaceWatched — badge table read by GET /marketplace/watched.
    const w2 = await db
      .insert(marketplaceWatched)
      .values({ userId, courseId, courseTitle: title, provider })
      .onConflictDoNothing()
      .returning({ id: marketplaceWatched.id });
    watchedInserted += w2.length;
  }

  console.log(
    `Backfill marketplace watches: ${pairs.size} (user, course) pairs processed — ` +
      `${watchesInserted} new marketplace_watches rows, ${watchedInserted} new marketplace_watched rows.`,
  );
}

backfill()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill marketplace watches failed:", err);
    process.exit(1);
  });
