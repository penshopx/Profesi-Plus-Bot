/**
 * Spinner-flash regression tests for the Marketplace list state.
 *
 * Guards the fix for "returning to the tab with cached data flashes a
 * loading spinner": the spinner may only appear on a true first load.
 */
import { getMarketplaceListState } from '../lib/marketplaceLoadingState';

const base = {
  cacheLoaded: true,
  catalogCount: 0,
  catalogLoading: false,
  watchedLoading: false,
  catalogError: false,
};

describe('getMarketplaceListState', () => {
  it('shows the list during a background catalog refetch with data on screen', () => {
    expect(
      getMarketplaceListState({ ...base, catalogCount: 5, catalogLoading: true }),
    ).toBe('list');
  });

  it('shows the list while watched-status is still loading with catalog data present', () => {
    expect(
      getMarketplaceListState({ ...base, catalogCount: 5, watchedLoading: true }),
    ).toBe('list');
  });

  it('never shows a spinner during the AsyncStorage cache-read window (remount with persisted cache)', () => {
    // rawCatalog is momentarily empty while the disk cache is read
    expect(
      getMarketplaceListState({
        ...base,
        cacheLoaded: false,
        catalogLoading: true,
        watchedLoading: true,
      }),
    ).toBe('awaiting-cache');
  });

  it('shows the spinner on a true first load (empty cache, initial fetch in flight)', () => {
    expect(getMarketplaceListState({ ...base, catalogLoading: true })).toBe('loading');
    expect(getMarketplaceListState({ ...base, watchedLoading: true })).toBe('loading');
  });

  it('shows the error state only when the fetch failed and no cache exists', () => {
    expect(getMarketplaceListState({ ...base, catalogError: true })).toBe('error');
  });

  it('falls back to the cached list instead of the error state when cache exists', () => {
    expect(
      getMarketplaceListState({ ...base, catalogCount: 3, catalogError: true }),
    ).toBe('list');
  });

  it('shows the (empty) list when everything settled with zero courses', () => {
    expect(getMarketplaceListState(base)).toBe('list');
  });
});
