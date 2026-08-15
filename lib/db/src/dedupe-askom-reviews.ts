/**
 * Rekonsiliasi ASKOM reviews duplikat sebelum unique index
 * `marketplace_askom_reviews_course_uidx` (satu ASKOM review per kursus)
 * diterapkan lewat `drizzle-kit push`.
 *
 * Kebijakan: pertahankan review TERLAMA (id terkecil = endorsement pertama),
 * hapus sisanya. Idempotent — aman dijalankan berulang; no-op bila tidak
 * ada duplikat atau tabel belum ada (fresh deploy sebelum push pertama).
 *
 * Run: cd lib/db && npx tsx src/dedupe-askom-reviews.ts
 */

import { db } from "./index";
import { sql } from "drizzle-orm";

async function main() {
  // Tabel mungkin belum ada pada deploy pertama (script ini berjalan sebelum db push).
  const exists = await db.execute(sql`SELECT to_regclass('public.marketplace_askom_reviews') AS t`);
  if (!(exists.rows[0] as any)?.t) {
    console.log("[dedupe-askom] tabel belum ada — lewati.");
    return;
  }
  const result = await db.execute(sql`
    DELETE FROM marketplace_askom_reviews a
    USING marketplace_askom_reviews b
    WHERE a.course_id = b.course_id AND a.id > b.id
  `);
  console.log(`[dedupe-askom] duplikat dihapus: ${result.rowCount ?? 0}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[dedupe-askom] gagal:", err);
    process.exit(1);
  });
