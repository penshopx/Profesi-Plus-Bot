/**
 * Marketplace AsyncStorage cache helpers.
 *
 * Extracted from the marketplace screen so cold-start loading, toggle
 * persistence, and sign-out clearing can be unit-tested without rendering
 * the full screen.
 *
 * Convention: the watched / PKB-logged caches are keyed per user id so two
 * accounts sharing a device never read each other's watch history. On
 * sign-out, call `clearUserMarketplaceCaches(userId)` (profile screen does
 * this) so a subsequent user on the same device starts clean even if key
 * scoping ever changes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MarketplaceCatalogCourse } from './api';

// ─── Offline catalog cache (shared, not user-scoped) ──────────────────────────

export const CATALOG_CACHE_KEY = 'GUSTAFTA_MARKETPLACE_CATALOG_CACHE';

/** Parse a stored JSON value into a string array; any other shape → []. */
function parseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')
      ? (parsed as string[])
      : [];
  } catch {
    return [];
  }
}

export async function loadCachedCatalog(): Promise<MarketplaceCatalogCourse[]> {
  try {
    const raw = await AsyncStorage.getItem(CATALOG_CACHE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    // A malformed (non-array) value must degrade to an empty cache, never
    // reach .map() in the screen and crash.
    return Array.isArray(parsed) ? (parsed as MarketplaceCatalogCourse[]) : [];
  } catch {
    return [];
  }
}

export async function saveCatalogCache(data: MarketplaceCatalogCourse[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(data));
  } catch {}
}

/**
 * Prune watched/PKB-logged IDs against a freshly fetched catalog. Any defined
 * successful catalog response — including an empty array (all courses
 * removed) — is authoritative; `undefined` (no fetch yet / offline) leaves the
 * list untouched. Returns the same array reference when nothing was pruned so
 * callers can cheaply detect "no change".
 */
export function reconcileIdsWithCatalog(
  ids: string[],
  catalog: { id: string }[] | undefined,
): string[] {
  if (!catalog) return ids;
  const live = new Set(catalog.map((c) => c.id));
  const kept = ids.filter((id) => live.has(id));
  return kept.length === ids.length ? ids : kept;
}

// ─── Watched-courses cache (user-scoped) ──────────────────────────────────────

export function watchedCacheKey(userId: string): string {
  return `GUSTAFTA_MARKETPLACE_WATCHED_CACHE_${userId}`;
}

export async function loadCachedWatched(userId: string): Promise<string[]> {
  try {
    return parseStringArray(await AsyncStorage.getItem(watchedCacheKey(userId)));
  } catch {
    return [];
  }
}

export async function saveWatchedCache(userId: string, ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(watchedCacheKey(userId), JSON.stringify(ids));
  } catch {}
}

// ─── "Dicatat PKB" cache (user-scoped) ────────────────────────────────────────

export function pkbLoggedCacheKey(userId: string): string {
  return `GUSTAFTA_MARKETPLACE_PKB_LOGGED_CACHE_${userId}`;
}

export async function loadCachedPkbLogged(userId: string): Promise<string[]> {
  try {
    return parseStringArray(await AsyncStorage.getItem(pkbLoggedCacheKey(userId)));
  } catch {
    return [];
  }
}

export async function savePkbLoggedCache(userId: string, ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(pkbLoggedCacheKey(userId), JSON.stringify(ids));
  } catch {}
}

// ─── Sign-out cleanup ─────────────────────────────────────────────────────────

// Monotonic counter bumped on every sign-out. In-flight work (e.g. a watch
// toggle whose HTTP request settles after sign-out) captures the epoch when
// it starts and must NOT persist anything if the epoch has advanced since —
// otherwise it would silently recreate the cache that sign-out just cleared.
let signOutEpoch = 0;

/** Current sign-out epoch. Capture before async work; compare before persisting. */
export function currentSignOutEpoch(): number {
  return signOutEpoch;
}

/**
 * Remove all user-scoped marketplace caches for `userId`. Called on sign-out
 * so watch history never leaks to the next account on a shared device.
 * The shared catalog cache is intentionally kept — it contains no user data.
 * Also advances the sign-out epoch so in-flight writes are fenced off.
 */
export async function clearUserMarketplaceCaches(userId: string): Promise<void> {
  signOutEpoch += 1;
  try {
    await AsyncStorage.multiRemove([watchedCacheKey(userId), pkbLoggedCacheKey(userId)]);
  } catch {}
}
