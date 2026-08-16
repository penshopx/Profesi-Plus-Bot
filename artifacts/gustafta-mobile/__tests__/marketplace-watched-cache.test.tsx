/**
 * Integration tests for the marketplace screen's offline caches (Task #180)
 *
 * Renders the REAL MarketplaceScreen with mocked native modules and a mocked
 * @/lib/api boundary to prove:
 *  1. Mount-time load effect: cached catalog + cached watched ids render on
 *     cold start BEFORE any network query resolves.
 *  2. Toggling watch while online persists the new id list to AsyncStorage.
 *  3. A different user id on the same device never sees the previous user's
 *     cached watched state.
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Native / environment mocks ────────────────────────────────────────────────

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let mockUserId: string | null = 'user_A';
jest.mock('@clerk/expo', () => ({
  useAuth: () => ({ userId: mockUserId }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useFocusEffect: () => {},
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('@/hooks/useNetworkState', () => ({
  useNetworkState: () => ({ isOnline: true, isChecking: false }),
}));

jest.mock('@/hooks/useColors', () => ({
  useColors: () => new Proxy({}, { get: () => '#000000' }),
}));

jest.mock('@/components/OfflineBanner', () => ({
  OfflineBanner: () => null,
}));

// ── API boundary mock ─────────────────────────────────────────────────────────

jest.mock('@/lib/api', () => ({
  getMarketplaceCatalog: jest.fn(),
  getWatchedCourses: jest.fn(),
  markCourseWatched: jest.fn(),
  unmarkCourseWatched: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getMarketplaceCatalog,
  getWatchedCourses,
  markCourseWatched,
} from '@/lib/api';
import {
  saveCatalogCache,
  saveWatchedCache,
  loadCachedWatched,
  clearUserMarketplaceCaches,
} from '@/lib/marketplaceCache';
import MarketplaceScreen from '@/app/(home)/(tabs)/marketplace';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COURSE = {
  id: 'course-1',
  title: 'K3 Konstruksi Dasar',
  provider: 'BNSP Academy',
  providerLogo: '🏗️',
  thumbnail: 'from-blue-500 to-cyan-500',
  type: 'video',
  price: 'gratis',
  priceIdr: null,
  priceOriginalIdr: null,
  rating: 4.7,
  ratingCount: 120,
  durationMinutes: 90,
  videoCount: 12,
  quizCount: 2,
  hasCertificate: true,
  jabker: ['ahli_k3_konstruksi'],
  skkTags: [],
  description: 'Dasar-dasar K3.',
  highlights: ['Materi lengkap'],
  curriculum: [],
  url: 'https://example.com/k3',
  isBestSeller: false,
  isNew: false,
  isFeatured: false,
  sortOrder: 1,
  reviews: { aiReviews: [], askomReviews: [] },
} as any;

const neverResolves = () => new Promise<never>(() => {});

// ── Harness ───────────────────────────────────────────────────────────────────

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

async function mountScreen(
  sharedClient?: QueryClient,
): Promise<{ root: ReactTestRenderer; client: QueryClient; teardown: () => Promise<void> }> {
  const client = sharedClient ?? makeClient();
  let root!: ReactTestRenderer;
  await act(async () => {
    root = create(
      <QueryClientProvider client={client}>
        <MarketplaceScreen />
      </QueryClientProvider>,
    );
    // Let the mount-time AsyncStorage load effect settle.
    await new Promise<void>((r) => setTimeout(r, 50));
  });
  return {
    root,
    client,
    teardown: async () => {
      if (!sharedClient) client.clear();
      await act(async () => { root.unmount(); });
    },
  };
}

/** Let React Query's async fetch/effect chain settle. */
async function settle(ms = 200) {
  await act(async () => {
    await new Promise<void>((r) => setTimeout(r, ms));
  });
}

function rendered(root: ReactTestRenderer): string {
  return JSON.stringify(root.toJSON());
}

/** Find the CourseCard "Tandai Ditonton"/"Ditonton" toggle and press it. */
async function pressWatchToggle(root: ReactTestRenderer, label: string) {
  const textNode = root.root
    .findAll((n) => (n.type as unknown as string) === 'Text')
    .find((n) => {
      const c = n.props.children;
      return c === label || (Array.isArray(c) && c.join('') === label);
    });
  if (!textNode) throw new Error(`Toggle label "${label}" not found`);
  // Walk up to the nearest pressable (our RN mock maps onPress → onClick).
  let node: any = textNode.parent;
  while (node && !node.props?.onClick) node = node.parent;
  if (!node) throw new Error('No pressable ancestor for toggle');
  await act(async () => {
    node.props.onClick({ stopPropagation: () => {} });
    await new Promise<void>((r) => setTimeout(r, 200));
  });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockUserId = 'user_A';
});

// ─────────────────────────────────────────────────────────────────────────────

describe('cold start — mount-time cache load before network resolves', () => {
  it('renders the cached catalog and cached watched badge while queries are pending', async () => {
    await saveCatalogCache([COURSE]);
    await saveWatchedCache('user_A', ['course-1']);
    (getMarketplaceCatalog as jest.Mock).mockImplementation(neverResolves);
    (getWatchedCourses as jest.Mock).mockImplementation(neverResolves);

    const { root, teardown } = await mountScreen();
    const json = rendered(root);
    expect(json).toContain('K3 Konstruksi Dasar');      // catalog from disk
    expect(json).toContain('✓ Ditonton');               // watched badge from disk
    expect(json).toContain('1 modul sudah ditonton');   // header count from disk
    await teardown();
  });

  it('shows the course as NOT watched when the watched cache is empty', async () => {
    await saveCatalogCache([COURSE]);
    (getMarketplaceCatalog as jest.Mock).mockImplementation(neverResolves);
    (getWatchedCourses as jest.Mock).mockImplementation(neverResolves);

    const { root, teardown } = await mountScreen();
    const json = rendered(root);
    expect(json).toContain('K3 Konstruksi Dasar');
    expect(json).not.toContain('✓ Ditonton');
    await teardown();
  });
});

describe('user scoping — sign-out safety on shared devices', () => {
  it('a user switch within the SAME QueryClient never serves the previous user’s watched data', async () => {
    await saveCatalogCache([COURSE]);
    (getMarketplaceCatalog as jest.Mock).mockResolvedValue([COURSE]);
    // User A's session: server says course-1 is watched.
    (getWatchedCourses as jest.Mock).mockResolvedValue({
      watched: [],
      watchedIds: ['course-1'],
      pkbLoggedIds: [],
    });

    const client = makeClient();
    const a = await mountScreen(client);
    await settle();
    expect(rendered(a.root)).toContain('✓ Ditonton');
    await a.teardown();

    // User B signs in on the same device, same app session (same QueryClient),
    // inside the 60s stale window. Their own watched fetch never resolves —
    // nothing may be served from A's in-memory or disk cache.
    mockUserId = 'user_B';
    (getWatchedCourses as jest.Mock).mockImplementation(neverResolves);

    const b = await mountScreen(client);
    await settle();
    expect(rendered(b.root)).not.toContain('✓ Ditonton');
    // And nothing of A's data may be persisted under B's disk key.
    expect(await loadCachedWatched('user_B')).toEqual([]);
    await b.teardown();
    client.clear();
  });

  it('a stale disk read from user A resolving AFTER an in-place switch to user B never renders', async () => {
    await saveCatalogCache([COURSE]);
    (getMarketplaceCatalog as jest.Mock).mockImplementation(neverResolves);
    (getWatchedCourses as jest.Mock).mockImplementation(neverResolves);

    // Defer user A's watched-cache disk read so it resolves only after the
    // identity has already switched to user B.
    const realGetItem = (AsyncStorage.getItem as jest.Mock).getMockImplementation()!;
    let resolveA!: (v: string) => void;
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key.includes('WATCHED_CACHE_user_A')) {
        return new Promise<string>((r) => { resolveA = r; });
      }
      return realGetItem(key);
    });

    const client = makeClient();
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <QueryClientProvider client={client}>
          <MarketplaceScreen />
        </QueryClientProvider>,
      );
      await new Promise<void>((r) => setTimeout(r, 20));
    });

    // In-place user switch (no unmount) while A's disk read is still pending.
    mockUserId = 'user_B';
    await act(async () => {
      root.update(
        <QueryClientProvider client={client}>
          <MarketplaceScreen />
        </QueryClientProvider>,
      );
      await new Promise<void>((r) => setTimeout(r, 20));
    });

    // Now A's stale disk read resolves — it must be discarded.
    await act(async () => {
      resolveA(JSON.stringify(['course-1']));
      await new Promise<void>((r) => setTimeout(r, 100));
    });

    expect(rendered(root)).not.toContain('✓ Ditonton');
    await act(async () => { root.unmount(); });
    client.clear();
    // Restore the standard mock so later tests aren't affected.
    (AsyncStorage.getItem as jest.Mock).mockImplementation(realGetItem);
  });

  it('the FIRST render after an in-place A→B switch is already clean (no pre-effect flash)', async () => {
    await saveCatalogCache([COURSE]);
    await saveWatchedCache('user_A', ['course-1']);
    (getMarketplaceCatalog as jest.Mock).mockImplementation(neverResolves);
    (getWatchedCourses as jest.Mock).mockImplementation(neverResolves);

    const client = makeClient();
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <QueryClientProvider client={client}>
          <MarketplaceScreen />
        </QueryClientProvider>,
      );
      await new Promise<void>((r) => setTimeout(r, 50));
    });
    // User A's history is on screen.
    expect(rendered(root)).toContain('✓ Ditonton');

    // Switch identity in place and inspect the render SYNCHRONOUSLY — before
    // any effect or async cache load has had a chance to run.
    mockUserId = 'user_B';
    act(() => {
      root.update(
        <QueryClientProvider client={client}>
          <MarketplaceScreen />
        </QueryClientProvider>,
      );
    });
    expect(rendered(root)).not.toContain('✓ Ditonton');

    await act(async () => { root.unmount(); });
    client.clear();
  });

  it('a toggle started by user A that settles AFTER a switch to user B never touches B state or B cache', async () => {
    await saveCatalogCache([COURSE]);
    (getMarketplaceCatalog as jest.Mock).mockImplementation(neverResolves);
    (getWatchedCourses as jest.Mock).mockResolvedValue({
      watched: [],
      watchedIds: [],
      pkbLoggedIds: [],
    });
    // Defer the mark request so it resolves only after B is active.
    let resolveMark!: () => void;
    (markCourseWatched as jest.Mock).mockImplementation(
      () => new Promise<void>((r) => { resolveMark = r; }),
    );

    const client = makeClient();
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <QueryClientProvider client={client}>
          <MarketplaceScreen />
        </QueryClientProvider>,
      );
      await new Promise<void>((r) => setTimeout(r, 50));
    });
    await settle();

    // A presses "Tandai Ditonton" — request now hangs in flight.
    const textNode = root.root
      .findAll((n) => (n.type as unknown as string) === 'Text')
      .find((n) => {
        const c = n.props.children;
        return c === 'Tandai Ditonton' || (Array.isArray(c) && c.join('') === 'Tandai Ditonton');
      });
    let node: any = textNode!.parent;
    while (node && !node.props?.onClick) node = node.parent;
    await act(async () => {
      node.props.onClick({ stopPropagation: () => {} });
      await new Promise<void>((r) => setTimeout(r, 20));
    });

    // Identity switches to B while A's request is pending. B's own queries hang.
    mockUserId = 'user_B';
    (getWatchedCourses as jest.Mock).mockImplementation(neverResolves);
    await act(async () => {
      root.update(
        <QueryClientProvider client={client}>
          <MarketplaceScreen />
        </QueryClientProvider>,
      );
      await new Promise<void>((r) => setTimeout(r, 50));
    });

    // A's request finally succeeds.
    await act(async () => {
      resolveMark();
      await new Promise<void>((r) => setTimeout(r, 200));
    });

    // B must see nothing and B's disk cache must stay empty…
    expect(rendered(root)).not.toContain('✓ Ditonton');
    expect(await loadCachedWatched('user_B')).toEqual([]);
    // …while A's disk cache still records the toggle A initiated.
    expect(await loadCachedWatched('user_A')).toEqual(['course-1']);

    await act(async () => { root.unmount(); });
    client.clear();
  });

  it('a toggle in flight when the user SIGNS OUT never recreates the cleared disk cache', async () => {
    await saveCatalogCache([COURSE]);
    (getMarketplaceCatalog as jest.Mock).mockImplementation(neverResolves);
    (getWatchedCourses as jest.Mock).mockResolvedValue({
      watched: [],
      watchedIds: [],
      pkbLoggedIds: [],
    });
    let resolveMark!: () => void;
    (markCourseWatched as jest.Mock).mockImplementation(
      () => new Promise<void>((r) => { resolveMark = r; }),
    );

    const client = makeClient();
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <QueryClientProvider client={client}>
          <MarketplaceScreen />
        </QueryClientProvider>,
      );
      await new Promise<void>((r) => setTimeout(r, 50));
    });
    await settle();

    // User A starts a toggle — HTTP request hangs in flight.
    const textNode = root.root
      .findAll((n) => (n.type as unknown as string) === 'Text')
      .find((n) => {
        const c = n.props.children;
        return c === 'Tandai Ditonton' || (Array.isArray(c) && c.join('') === 'Tandai Ditonton');
      });
    let node: any = textNode!.parent;
    while (node && !node.props?.onClick) node = node.parent;
    await act(async () => {
      node.props.onClick({ stopPropagation: () => {} });
      await new Promise<void>((r) => setTimeout(r, 20));
    });

    // Sign-out happens (profile screen behavior): disk caches cleared, epoch bumped.
    await clearUserMarketplaceCaches('user_A');
    mockUserId = null;
    await act(async () => {
      root.update(
        <QueryClientProvider client={client}>
          <MarketplaceScreen />
        </QueryClientProvider>,
      );
      await new Promise<void>((r) => setTimeout(r, 20));
    });

    // The in-flight request settles AFTER sign-out — it must not persist.
    await act(async () => {
      resolveMark();
      await new Promise<void>((r) => setTimeout(r, 200));
    });

    expect(await loadCachedWatched('user_A')).toEqual([]);
    expect(rendered(root)).not.toContain('✓ Ditonton');

    await act(async () => { root.unmount(); });
    client.clear();
  });

  it('does not fetch or render watched data when no user is signed in', async () => {
    await saveCatalogCache([COURSE]);
    await saveWatchedCache('user_A', ['course-1']);
    mockUserId = null;
    (getMarketplaceCatalog as jest.Mock).mockImplementation(neverResolves);
    (getWatchedCourses as jest.Mock).mockImplementation(neverResolves);

    const { root, teardown } = await mountScreen();
    expect(getWatchedCourses).not.toHaveBeenCalled();
    expect(rendered(root)).not.toContain('✓ Ditonton');
    await teardown();
  });

  it('a different signed-in user never sees the previous user’s cached watched state', async () => {
    await saveCatalogCache([COURSE]);
    await saveWatchedCache('user_A', ['course-1']); // previous user's history
    mockUserId = 'user_B';
    (getMarketplaceCatalog as jest.Mock).mockImplementation(neverResolves);
    (getWatchedCourses as jest.Mock).mockImplementation(neverResolves);

    const { root, teardown } = await mountScreen();
    expect(rendered(root)).not.toContain('✓ Ditonton');
    await teardown();
  });
});

describe('online toggle — persists to AsyncStorage immediately', () => {
  it('marking a course watched writes the id into the user-scoped cache', async () => {
    await saveCatalogCache([COURSE]);
    (getMarketplaceCatalog as jest.Mock).mockResolvedValue([COURSE]);
    // Stateful fake server: the post-toggle refetch (onSettled invalidation)
    // returns the updated list, mirroring the real backend.
    const serverWatched: string[] = [];
    (getWatchedCourses as jest.Mock).mockImplementation(async () => ({
      watched: [],
      watchedIds: [...serverWatched],
      pkbLoggedIds: [],
    }));
    (markCourseWatched as jest.Mock).mockImplementation(async (id: string) => {
      serverWatched.push(id);
    });

    const { root, teardown } = await mountScreen();
    await pressWatchToggle(root, 'Tandai Ditonton');

    expect(markCourseWatched).toHaveBeenCalledWith('course-1', expect.any(Object));
    expect(await loadCachedWatched('user_A')).toContain('course-1');
    await teardown();
  });
});
