/**
 * Unit tests for lib/marketplaceCache.ts (Task #180)
 *
 * Covers:
 *  1. Cold-start load: loadCachedCatalog / loadCachedWatched return persisted
 *     data written by a previous session (survives app restarts).
 *  2. Corrupt or missing data degrades to an empty array, never throws.
 *  3. User scoping: two users on the same device never read each other's
 *     watched cache.
 *  4. Sign-out convention: clearUserMarketplaceCaches removes ONLY the
 *     signing-out user's watched + PKB-logged caches; the shared catalog
 *     cache and other users' caches survive.
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CATALOG_CACHE_KEY,
  loadCachedCatalog,
  saveCatalogCache,
  watchedCacheKey,
  loadCachedWatched,
  saveWatchedCache,
  pkbLoggedCacheKey,
  loadCachedPkbLogged,
  savePkbLoggedCache,
  clearUserMarketplaceCaches,
} from '@/lib/marketplaceCache';
import type { MarketplaceCatalogCourse } from '@/lib/api';

const COURSE = { id: 'course-1', title: 'K3 Dasar' } as MarketplaceCatalogCourse;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('catalog cache — survives restarts', () => {
  it('loadCachedCatalog returns what saveCatalogCache persisted (cold start)', async () => {
    await saveCatalogCache([COURSE]);
    // Simulate a fresh cold start: nothing in memory, read from disk only.
    const loaded = await loadCachedCatalog();
    expect(loaded).toEqual([COURSE]);
  });

  it('returns [] when nothing was ever cached', async () => {
    expect(await loadCachedCatalog()).toEqual([]);
  });

  it('returns [] (not a crash) when the stored JSON is corrupt', async () => {
    await AsyncStorage.setItem(CATALOG_CACHE_KEY, '{not json!');
    expect(await loadCachedCatalog()).toEqual([]);
  });

  it('returns [] when the stored value is valid JSON but not an array', async () => {
    await AsyncStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ courses: [COURSE] }));
    expect(await loadCachedCatalog()).toEqual([]);
  });

  it('returns [] when AsyncStorage.getItem itself rejects', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('disk io'));
    expect(await loadCachedCatalog()).toEqual([]);
  });
});

describe('watched cache — survives restarts, scoped per user', () => {
  it('loadCachedWatched returns what saveWatchedCache persisted for that user', async () => {
    await saveWatchedCache('user_A', ['course-1', 'course-2']);
    expect(await loadCachedWatched('user_A')).toEqual(['course-1', 'course-2']);
  });

  it('a different user on the same device sees an empty watched cache', async () => {
    await saveWatchedCache('user_A', ['course-1']);
    expect(await loadCachedWatched('user_B')).toEqual([]);
  });

  it('uses a distinct storage key per user id', () => {
    expect(watchedCacheKey('user_A')).not.toEqual(watchedCacheKey('user_B'));
    expect(pkbLoggedCacheKey('user_A')).not.toEqual(pkbLoggedCacheKey('user_B'));
  });

  it('returns [] on corrupt watched JSON', async () => {
    await AsyncStorage.setItem(watchedCacheKey('user_A'), 'oops');
    expect(await loadCachedWatched('user_A')).toEqual([]);
  });

  it('returns [] when the watched value is valid JSON but wrong-shaped', async () => {
    await AsyncStorage.setItem(watchedCacheKey('user_A'), JSON.stringify({ ids: ['course-1'] }));
    expect(await loadCachedWatched('user_A')).toEqual([]);
    await AsyncStorage.setItem(watchedCacheKey('user_A'), JSON.stringify([1, 2, 3]));
    expect(await loadCachedWatched('user_A')).toEqual([]);
    await AsyncStorage.setItem(pkbLoggedCacheKey('user_A'), JSON.stringify('course-1'));
    expect(await loadCachedPkbLogged('user_A')).toEqual([]);
  });

  it('pkb-logged cache round-trips per user too', async () => {
    await savePkbLoggedCache('user_A', ['course-9']);
    expect(await loadCachedPkbLogged('user_A')).toEqual(['course-9']);
    expect(await loadCachedPkbLogged('user_B')).toEqual([]);
  });
});

describe('sign-out clearing — clearUserMarketplaceCaches', () => {
  it('removes the watched and pkb-logged caches for the signing-out user', async () => {
    await saveWatchedCache('user_A', ['course-1']);
    await savePkbLoggedCache('user_A', ['course-2']);

    await clearUserMarketplaceCaches('user_A');

    expect(await loadCachedWatched('user_A')).toEqual([]);
    expect(await loadCachedPkbLogged('user_A')).toEqual([]);
  });

  it('leaves other users’ caches and the shared catalog cache intact', async () => {
    await saveCatalogCache([COURSE]);
    await saveWatchedCache('user_A', ['course-1']);
    await saveWatchedCache('user_B', ['course-7']);

    await clearUserMarketplaceCaches('user_A');

    expect(await loadCachedWatched('user_B')).toEqual(['course-7']);
    expect(await loadCachedCatalog()).toEqual([COURSE]);
  });

  it('advances the sign-out epoch so in-flight work can detect the sign-out', async () => {
    const { currentSignOutEpoch } = require('@/lib/marketplaceCache');
    const before = currentSignOutEpoch();
    await clearUserMarketplaceCaches('user_A');
    expect(currentSignOutEpoch()).toBe(before + 1);
  });

  it('never throws even if AsyncStorage.multiRemove fails', async () => {
    (AsyncStorage.multiRemove as jest.Mock).mockRejectedValueOnce(new Error('disk io'));
    await expect(clearUserMarketplaceCaches('user_A')).resolves.toBeUndefined();
  });
});
