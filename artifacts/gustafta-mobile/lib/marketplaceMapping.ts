/**
 * Pure mapping from the marketplace catalog API shape to the mobile Course
 * model. Kept free of React Native imports so it can be unit-tested in a
 * plain node environment.
 */

import type {
  MarketplaceCatalogCourse,
  MarketplaceAiReview,
  MarketplaceAskomReview,
  MarketplaceSkkTag,
} from './api';

export type ContentType = 'video' | 'webinar' | 'diklatkerja' | 'modul';
export type PriceType = 'gratis' | 'berbayar';

export interface Course {
  id: string;
  title: string;
  provider: string;
  providerLogo: string;
  gradientStart: string;
  gradientEnd: string;
  type: ContentType;
  price: PriceType;
  priceIdr?: number;
  rating: number;
  ratingCount: number;
  durationMinutes: number;
  videoCount: number;
  hasCertificate: boolean;
  jabker: string[];
  skkTags: MarketplaceSkkTag[];
  description: string;
  highlights: string[];
  url: string;
  isBestSeller?: boolean;
  isNew?: boolean;
  isFeatured?: boolean;
  aiReviews: MarketplaceAiReview[];
  askomReview: MarketplaceAskomReview | null;
  curriculum: { type: string; title: string; duration: string }[];
}

// API stores thumbnail as a Tailwind CSS class; map to solid hex for the accent strip.
const THUMBNAIL_TO_HEX: Record<string, [string, string]> = {
  'from-orange-500 to-red-500':    ['#F97316', '#EF4444'],
  'from-blue-500 to-cyan-500':     ['#3B82F6', '#06B6D4'],
  'from-emerald-500 to-teal-500':  ['#10B981', '#14B8A6'],
  'from-violet-500 to-purple-500': ['#8B5CF6', '#A855F7'],
  'from-rose-500 to-pink-500':     ['#F43F5E', '#EC4899'],
  'from-amber-500 to-orange-500':  ['#F59E0B', '#F97316'],
  'from-red-500 to-orange-600':    ['#EF4444', '#EA580C'],
  'from-cyan-500 to-sky-500':      ['#06B6D4', '#0EA5E9'],
  'from-indigo-500 to-blue-600':   ['#6366F1', '#2563EB'],
};

export function mapApiCourse(c: MarketplaceCatalogCourse): Course {
  const [gradientStart, gradientEnd] = THUMBNAIL_TO_HEX[c.thumbnail] ?? ['#6366F1', '#2563EB'];
  return {
    id:              c.id,
    title:           c.title,
    provider:        c.provider,
    providerLogo:    c.providerLogo,
    gradientStart,
    gradientEnd,
    type:            c.type as ContentType,
    price:           c.price as PriceType,
    priceIdr:        c.priceIdr ?? undefined,
    rating:          c.rating,
    ratingCount:     c.ratingCount,
    durationMinutes: c.durationMinutes,
    videoCount:      c.videoCount,
    hasCertificate:  c.hasCertificate,
    jabker:          c.jabker,
    skkTags:         c.skkTags,
    description:     c.description,
    highlights:      c.highlights,
    url:             c.url,
    isBestSeller:    c.isBestSeller,
    isNew:           c.isNew,
    isFeatured:      c.isFeatured,
    // Older cached catalogs may not carry `reviews`; degrade to empty.
    // Server returns askomReviews as an array but enforces one per course.
    aiReviews:       c.reviews?.aiReviews ?? [],
    askomReview:     c.reviews?.askomReviews?.[0] ?? null,
    // Older cached catalogs may not carry `curriculum`; degrade to empty.
    curriculum:      c.curriculum ?? [],
  };
}
