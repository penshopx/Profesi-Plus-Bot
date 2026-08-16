/**
 * mapApiCourse review mapping — verifies the catalog API's `reviews` shape
 * (aiReviews array + askomReviews array) is carried into the Course model
 * used by CourseDetailModal. Guards against the singular/plural contract
 * mismatch that previously left the ASKOM section permanently hidden.
 */

import { mapApiCourse } from '../lib/marketplaceMapping';
import type { MarketplaceCatalogCourse } from '../lib/api';

function baseCourse(overrides: Partial<MarketplaceCatalogCourse> = {}): MarketplaceCatalogCourse {
  return {
    id: 'c1',
    title: 'Kursus K3',
    provider: 'Provider',
    providerLogo: '🏗️',
    thumbnail: 'from-blue-500 to-cyan-500',
    type: 'video',
    price: 'gratis',
    priceIdr: null,
    priceOriginalIdr: null,
    rating: 4.5,
    ratingCount: 10,
    durationMinutes: 90,
    videoCount: 5,
    quizCount: 0,
    hasCertificate: true,
    jabker: ['ahli_k3_konstruksi'],
    skkTags: [],
    description: 'desc',
    highlights: [],
    curriculum: [],
    url: 'https://example.com',
    isBestSeller: false,
    isNew: false,
    isFeatured: false,
    sortOrder: 1,
    reviews: { aiReviews: [], askomReviews: [] },
    ...overrides,
  };
}

const askomReview = {
  reviewerName: 'Ir. Budi',
  credential: 'Ahli Utama K3',
  credentialNumber: '123',
  institution: 'ASKOM Jakarta',
  rating: 5,
  recommendation: 'Sangat direkomendasikan',
  comment: 'Materi lengkap.',
  relevanceScore: 95,
  strengths: ['Studi kasus nyata'],
  reviewedAt: '2026-08-01T00:00:00Z',
};

const aiReview = {
  platform: 'Gustafta AI',
  platformIcon: '🤖',
  rating: 4.6,
  comment: 'Relevan dengan SKK.',
  relevanceScore: 88,
  reviewedAt: '2026-08-01T00:00:00Z',
};

describe('mapApiCourse review mapping', () => {
  it('maps an ASKOM review from the askomReviews array to a non-null askomReview', () => {
    const mapped = mapApiCourse(
      baseCourse({ reviews: { aiReviews: [aiReview], askomReviews: [askomReview] } }),
    );
    expect(mapped.askomReview).not.toBeNull();
    expect(mapped.askomReview?.reviewerName).toBe('Ir. Budi');
    expect(mapped.askomReview?.strengths).toEqual(['Studi kasus nyata']);
    expect(mapped.aiReviews).toHaveLength(1);
    expect(mapped.aiReviews[0].platform).toBe('Gustafta AI');
  });

  it('degrades to empty reviews when the course has none', () => {
    const mapped = mapApiCourse(baseCourse());
    expect(mapped.askomReview).toBeNull();
    expect(mapped.aiReviews).toEqual([]);
  });

  it('tolerates cached catalogs written before reviews existed', () => {
    const legacy = baseCourse();
    delete (legacy as Partial<MarketplaceCatalogCourse>).reviews;
    const mapped = mapApiCourse(legacy);
    expect(mapped.askomReview).toBeNull();
    expect(mapped.aiReviews).toEqual([]);
  });
});
