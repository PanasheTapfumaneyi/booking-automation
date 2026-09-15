/**
 * Storefront editor data contracts (client-safe, type-only server imports).
 */
import type {
  GalleryRow,
  ReviewRow,
  StorefrontRow,
  TeamRow,
} from "@/lib/server/storefront";

export type { GalleryRow, ReviewRow, StorefrontRow, TeamRow };

export interface EditorBusiness {
  id: string;
  name: string;
  slug: string | null;
  isActive: boolean;
  logoUrl: string | null;
  coverUrl: string | null;
  tagline: string | null;
  description: string | null;
  hasHours: boolean;
  category: string | null;
  themePrimary: string;
  themeAccent: string;
}

export interface EditorInitial {
  business: EditorBusiness;
  storefront: StorefrontRow | null;
  gallery: GalleryRow[];
  team: TeamRow[];
  reviews: ReviewRow[];
}

/** Completeness-relevant facts sections report back after saving. */
export interface ProgressFacts {
  logoUrl?: string | null;
  coverUrl?: string | null;
  headline?: string | null;
  galleryCount?: number;
  visibleTeamCount?: number;
  socialCount?: number;
}
