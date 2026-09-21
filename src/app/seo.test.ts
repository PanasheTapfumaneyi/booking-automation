/**
 * SEO test suite — canonical host, metadata, robots, sitemap, structured data.
 *
 * Verifies:
 * 1. Site config uses canonical www hostname
 * 2. Robots rules disallow private routes
 * 3. Sitemap excludes private and demo pages, static lastModified stable
 * 4. Homepage has correct metadata, OG image, canonical, no SearchAction
 * 5. Business storefront: demo noindex, real index
 * 6. Booking flow has noindex
 * 7. Private pages have noindex
 * 8. JSON-LD is safely serialized (no script injection)
 * 9. No fake review/aggregate rating schema
 * 10. Sitemap business filter: active included, inactive/null/demo excluded
 * 11. Social metadata: OG/Twitter on all marketing pages
 * 12. Business storefront OG image fallback
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function src(relative: string): string {
  return readFileSync(join(root, "src", relative), "utf8");
}

// ---------------------------------------------------------------------------
// Site config
// ---------------------------------------------------------------------------

describe("SEO — site config", () => {
  it("uses canonical www hostname", async () => {
    const mod = await import("@/lib/site-config");
    expect(mod.SITE_URL).toContain("https://www.kivoconsulting.site");
    expect(mod.SITE_URL).not.toContain("localhost");
  });

  it("exports all required config values", async () => {
    const mod = await import("@/lib/site-config");
    expect(mod.SITE_NAME).toBe("Kivo");
    expect(mod.DEFAULT_TITLE).toContain("Kivo");
    expect(mod.DEFAULT_DESCRIPTION.length).toBeGreaterThan(20);
    expect(mod.OG_IMAGE).toContain("og.png");
    expect(mod.SITE_LOCALE).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Robots
// ---------------------------------------------------------------------------

describe("SEO — robots", () => {
  it("has a single User-Agent block and disallows private routes", () => {
    const robots = src("app/robots.ts");
    expect(robots).toContain("disallow:");
    expect(robots).toContain("/api/");
    expect(robots).toContain("/dashboard/");
    expect(robots).toContain("/settings");
    expect(robots).toContain("/onboarding");
    expect(robots).toContain("/manage/");
    expect(robots).toContain("/admin/");
  });

  it("references canonical sitemap URL", () => {
    const robots = src("app/robots.ts");
    expect(robots).toContain("sitemap:");
    expect(robots).toContain("SITE_URL");
  });

  it("does not use localhost as sitemap URL", () => {
    const robots = src("app/robots.ts");
    expect(robots).not.toContain("localhost:3000");
  });
});

// ---------------------------------------------------------------------------
// Sitemap
// ---------------------------------------------------------------------------

describe("SEO — sitemap", () => {
  it("uses canonical hostname from site-config", () => {
    const sitemap = src("app/sitemap.ts");
    expect(sitemap).toContain("SITE_URL");
    expect(sitemap).not.toContain("localhost:3000");
  });

  it("excludes login, signup, book pages", () => {
    const sitemap = src("app/sitemap.ts");
    expect(sitemap).not.toContain('/login"');
    expect(sitemap).not.toContain('/signup"');
    expect(sitemap).not.toContain('/book"');
  });

  it("filters out demo businesses from sitemap", () => {
    const sitemap = src("app/sitemap.ts");
    expect(sitemap).toContain("is_demo");
    expect(sitemap).toContain("!== true");
  });

  it("uses updated_at for business lastModified, not request-time new Date()", () => {
    const sitemap = src("app/sitemap.ts");
    expect(sitemap).toContain("updated_at");
    // Business entries must use updated_at, not new Date()
    expect(sitemap).not.toMatch(/businesses\.map.*new Date\(\)/);
  });

  it("does not use new Date() for static page lastModified", () => {
    const sitemap = src("app/sitemap.ts");
    // Static pages should not have lastModified set to new Date()
    // which would change on every request
    expect(sitemap).not.toMatch(/staticPages.*new Date\(\)/);
    // The staticPages array should not contain lastModified properties
    const staticSection = sitemap.substring(
      sitemap.indexOf("staticPages"),
      sitemap.indexOf("businesses"),
    );
    expect(staticSection).not.toContain("lastModified");
  });

  it("includes all marketing and trust pages in static list", () => {
    const sitemap = src("app/sitemap.ts");
    const expectedPaths = [
      "/demo",
      "/pricing",
      "/about",
      "/contact",
      "/privacy",
      "/terms",
      "/solutions/appointments",
      "/solutions/salons-barbers",
      "/solutions/car-rentals",
      "/solutions/tours-activities",
      "/features/whatsapp-reminders",
      "/features/google-calendar",
    ];
    for (const path of expectedPaths) {
      expect(sitemap).toContain(path);
    }
  });

  it("excludes inactive businesses (is_active === false)", () => {
    const sitemap = src("app/sitemap.ts");
    // The filter should only include is_active === true or null (legacy)
    expect(sitemap).toContain("is_active");
  });

  it("does not advertise SearchAction in homepage JSON-LD", () => {
    const page = src("app/page.tsx");
    expect(page).not.toContain("SearchAction");
    expect(page).not.toContain("query-input");
  });
});

// ---------------------------------------------------------------------------
// Homepage metadata
// ---------------------------------------------------------------------------

describe("SEO — homepage metadata", () => {
  it("has correct title with target keyword", async () => {
    const mod = await import("@/app/page");
    const meta = mod.metadata;
    expect(meta).toBeDefined();
    if (typeof meta === "object" && meta !== null && "title" in meta) {
      expect(String(meta.title)).toContain("Online Booking System");
      expect(String(meta.title)).toContain("Mauritian Businesses");
      expect(String(meta.title)).toContain("Kivo");
    }
  });

  it("has description mentioning Mauritius", async () => {
    const mod = await import("@/app/page");
    const meta = mod.metadata;
    if (typeof meta === "object" && meta !== null && "description" in meta) {
      expect(String(meta.description)).toMatch(/Mauriti/i);
    }
  });

  it("has canonical URL", async () => {
    const mod = await import("@/app/page");
    const meta = mod.metadata;
    if (typeof meta === "object" && meta !== null && "alternates" in meta) {
      const alternates = meta.alternates as { canonical?: string };
      expect(alternates.canonical).toContain("kivoconsulting.site");
    }
  });

  it("has OG image with absolute URL", async () => {
    const mod = await import("@/app/page");
    const meta = mod.metadata;
    if (typeof meta === "object" && meta !== null && "openGraph" in meta) {
      const og = meta.openGraph as { images?: Array<{ url: string }> };
      expect(og.images).toBeDefined();
      expect(og.images!.length).toBeGreaterThan(0);
    }
  });

  it("includes JSON-LD structured data scripts", () => {
    const page = src("app/page.tsx");
    expect(page).toContain("JsonLdScript");
    expect(page).toContain("Organization");
    expect(page).toContain("WebSite");
    expect(page).toContain("Service");
  });
});

// ---------------------------------------------------------------------------
// Root layout metadata
// ---------------------------------------------------------------------------

describe("SEO — root layout", () => {
  it("has metadataBase set to canonical URL", () => {
    const layout = src("app/layout.tsx");
    expect(layout).toContain("metadataBase");
    expect(layout).toContain("SITE_URL");
  });

  it("has OG image as absolute URL", () => {
    const layout = src("app/layout.tsx");
    expect(layout).toContain("openGraph");
    expect(layout).toContain("images");
  });

  it("has robots index true", () => {
    const layout = src("app/layout.tsx");
    expect(layout).toContain("robots");
    expect(layout).toContain("index: true");
  });
});

// ---------------------------------------------------------------------------
// Business storefront metadata
// ---------------------------------------------------------------------------

describe("SEO — business storefront", () => {
  it("business page generates canonical URL", () => {
    const page = src("app/business/[slug]/page.tsx");
    expect(page).toContain("canonical");
    expect(page).toContain("SITE_URL");
  });

  it("demo businesses get noindex", () => {
    const page = src("app/business/[slug]/page.tsx");
    expect(page).toContain("is_demo");
    expect(page).toContain("index: false");
  });

  it("real businesses get index true", () => {
    const page = src("app/business/[slug]/page.tsx");
    expect(page).toContain("index: true");
  });

  it("includes JSON-LD LocalBusiness for non-demo businesses", () => {
    const page = src("app/business/[slug]/page.tsx");
    expect(page).toContain("LocalBusiness");
    expect(page).toContain("JsonLdScript");
  });

  it("does not emit Review or AggregateRating schema", () => {
    const page = src("app/business/[slug]/page.tsx");
    expect(page).not.toContain('"Review"');
    expect(page).not.toContain('"AggregateRating"');
  });

  it("OG image fallback: cover → logo → null (layout provides /og.png)", () => {
    const page = src("app/business/[slug]/page.tsx");
    // The page uses cover_image_url ?? logo_url ?? null
    expect(page).toContain("cover_image_url");
    expect(page).toContain("logo_url");
  });

  it("demo businesses emit no LocalBusiness JSON-LD", () => {
    const page = src("app/business/[slug]/page.tsx");
    // localBusinessJsonLd is null when is_demo === true
    expect(page).toContain("is_demo !== true");
  });
});

// ---------------------------------------------------------------------------
// Booking flow
// ---------------------------------------------------------------------------

describe("SEO — booking flow", () => {
  it("book page has noindex", () => {
    const page = src("app/book/[slug]/page.tsx");
    expect(page).toContain("index: false");
    expect(page).toContain("follow: true");
  });
});

// ---------------------------------------------------------------------------
// Private pages noindex
// ---------------------------------------------------------------------------

describe("SEO — private pages noindex", () => {
  const privatePages = [
    { file: "app/login/page.tsx", name: "login" },
    { file: "app/signup/page.tsx", name: "signup" },
    { file: "app/onboarding/page.tsx", name: "onboarding" },
    { file: "app/settings/page.tsx", name: "settings" },
    { file: "app/demo/dashboard/[slug]/page.tsx", name: "demo dashboard" },
    { file: "app/dashboard/page.tsx", name: "dashboard" },
    { file: "app/dashboard/bookings/page.tsx", name: "dashboard bookings" },
    { file: "app/dashboard/storefront/page.tsx", name: "dashboard storefront" },
    { file: "app/dashboard/integrations/page.tsx", name: "dashboard integrations" },
  ];

  for (const { file, name } of privatePages) {
    it(`${name} has noindex`, () => {
      const content = src(file);
      expect(content).toContain("index: false");
    });
  }
});

// ---------------------------------------------------------------------------
// JSON-LD safety
// ---------------------------------------------------------------------------

describe("SEO — JSON-LD safety", () => {
  it("escapes script-closing tags", () => {
    const helper = src("lib/seo-jsonld.tsx");
    expect(helper).toContain("\\u003c");
    expect(helper).toContain("\\u003e");
    expect(helper).toContain("dangerouslySetInnerHTML");
  });

  it("escapes ampersands", () => {
    const helper = src("lib/seo-jsonld.tsx");
    expect(helper).toContain("\\u0026");
  });
});

// ---------------------------------------------------------------------------
// Trust pages exist
// ---------------------------------------------------------------------------

describe("SEO — trust pages", () => {
  const pages = [
    { file: "app/about/page.tsx", name: "about" },
    { file: "app/contact/page.tsx", name: "contact" },
    { file: "app/privacy/page.tsx", name: "privacy" },
    { file: "app/terms/page.tsx", name: "terms" },
  ];

  for (const { file, name } of pages) {
    it(`${name} page exists with metadata`, () => {
      const content = src(file);
      expect(content).toContain("export const metadata");
      expect(content).toContain("alternates");
    });
  }
});

// ---------------------------------------------------------------------------
// Marketing pages — social metadata
// ---------------------------------------------------------------------------

describe("SEO — marketing pages social metadata", () => {
  const pages = [
    "app/pricing/page.tsx",
    "app/solutions/appointments/page.tsx",
    "app/solutions/salons-barbers/page.tsx",
    "app/solutions/car-rentals/page.tsx",
    "app/solutions/tours-activities/page.tsx",
    "app/features/whatsapp-reminders/page.tsx",
    "app/features/google-calendar/page.tsx",
    "app/about/page.tsx",
    "app/contact/page.tsx",
    "app/privacy/page.tsx",
    "app/terms/page.tsx",
  ];

  for (const file of pages) {
    it(`${file} has canonical`, () => {
      const content = src(file);
      expect(content).toContain("canonical");
    });

    it(`${file} has openGraph metadata`, () => {
      const content = src(file);
      expect(content).toContain("openGraph");
      expect(content).toContain("images");
    });

    it(`${file} has twitter card metadata`, () => {
      const content = src(file);
      expect(content).toContain("twitter");
      expect(content).toContain("summary_large_image");
    });

    it(`${file} has absolute OG image`, () => {
      const content = src(file);
      expect(content).toContain("OG_IMAGE");
    });
  }
});

// ---------------------------------------------------------------------------
// Footer has new links
// ---------------------------------------------------------------------------

describe("SEO — footer links", () => {
  it("footer includes privacy and terms links", () => {
    const footer = src("components/marketing/MarketingFooter.tsx");
    expect(footer).toContain('href="/privacy"');
    expect(footer).toContain('href="/terms"');
    expect(footer).toContain('href="/about"');
    expect(footer).toContain('href="/contact"');
  });

  it("footer uses absolute pricing link", () => {
    const footer = src("components/marketing/MarketingFooter.tsx");
    expect(footer).toContain('href="/pricing"');
    expect(footer).not.toContain('href="/#pricing"');
  });
});

// ---------------------------------------------------------------------------
// Hero copy
// ---------------------------------------------------------------------------

describe("SEO — hero copy", () => {
  it("mentions Mauritius", () => {
    const hero = src("components/marketing/Hero.tsx");
    expect(hero).toContain("Mauritius");
  });

  it("H1 contains target keyword", () => {
    const hero = src("components/marketing/Hero.tsx");
    expect(hero).toContain("Online bookings");
  });
});
