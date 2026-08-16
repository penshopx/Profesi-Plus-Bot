/**
 * Pure decision logic for what the Marketplace list area should render.
 *
 * Extracted from app/(home)/(tabs)/marketplace.tsx so the spinner-flash
 * behaviour can be unit-tested without React Native.
 *
 * States:
 * - "awaiting-cache": the AsyncStorage catalog cache hasn't been read yet and
 *   nothing is on screen. Render a neutral blank — NOT a spinner — because on
 *   a remount with a persisted cache this window lasts milliseconds and a
 *   spinner here is exactly the flash we want to avoid.
 * - "loading": true first load — cache read finished, it was empty, and the
 *   catalog (or watched-status) request is still in flight.
 * - "error": the catalog fetch failed and there is no cached data to fall
 *   back to.
 * - "list": we have data (live or cached); background re-fetches
 *   (stale-while-revalidate on tab focus) never leave this state.
 */
export type MarketplaceListState = 'awaiting-cache' | 'loading' | 'error' | 'list';

export function getMarketplaceListState(args: {
  /** AsyncStorage catalog cache has been read (regardless of contents). */
  cacheLoaded: boolean;
  /** Number of courses available to render (live ?? cached). */
  catalogCount: number;
  /** Catalog query is doing its initial fetch (no query-cache data yet). */
  catalogLoading: boolean;
  /** Watched-status query is doing its initial fetch. */
  watchedLoading: boolean;
  /** Catalog query is in an error state. */
  catalogError: boolean;
}): MarketplaceListState {
  const { cacheLoaded, catalogCount, catalogLoading, watchedLoading, catalogError } = args;

  // Anything to show? Always show it — background refetches don't interrupt.
  if (catalogCount > 0) return 'list';

  // Disk cache not read yet: neutral blank, never a spinner or empty-state.
  if (!cacheLoaded) return 'awaiting-cache';

  if (catalogLoading || watchedLoading) return 'loading';
  if (catalogError) return 'error';
  return 'list';
}
