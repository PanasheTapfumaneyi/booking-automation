/**
 * Appointment storefront render tests (server-side markup, no browser).
 *
 * Proves the fallback contract: a minimally configured business gets a
 * complete intentional page with no empty sections, and populated data
 * renders each section exactly once.
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AppointmentStorefront, {
  type AppointmentStorefrontData,
} from "./AppointmentStorefront";

function business(overrides: Record<string, unknown> = {}) {
  return {
    id: "biz-w",
    name: "Watpo Hair Studio",
    phone: "+230 5700 0000",
    email: null,
    timezone: "Indian/Mauritius",
    booking_mode: "appointment",
    calendar_id: null,
    slug: "watpo-hair-studio",
    is_demo: false,
    is_active: true,
    availability: null,
    tagline: null,
    description: null,
    cover_image_url: null,
    logo_url: null,
    theme_config: null,
    category: "barber",
    address: null,
    latitude: null,
    longitude: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  } as AppointmentStorefrontData["business"];
}

function services() {
  return [
    {
      id: "svc-1",
      name: "Haircut",
      description: "Classic cut and finish",
      duration_minutes: 30,
      price: 300,
      image_url: null,
      active: true,
    },
  ];
}

function data(overrides: Partial<AppointmentStorefrontData> = {}): AppointmentStorefrontData {
  return {
    business: business(),
    services: services(),
    hours: null,
    accent: "#15547D",
    bookHref: "/book/watpo-hair-studio",
    preview: false,
    demoReviews: [],
    bundle: { storefront: null, gallery: [], team: [], reviews: [] },
    ...overrides,
  };
}

function html(input: AppointmentStorefrontData): string {
  return renderToStaticMarkup(AppointmentStorefront({ data: input }));
}

describe("minimal business (name + services only)", () => {
  it("renders identity, services, booking actions, and footer", () => {
    const page = html(data());
    expect(page).toContain("Watpo Hair Studio");
    expect(page).toContain("Services");
    expect(page).toContain("Haircut");
    expect(page).toContain("Rs 300");
    expect(page).toContain("Book appointment");
    expect(page).toContain("Bookings powered by");
  });

  it("hides every optional section without placeholders", () => {
    const page = html(data());
    expect(page).not.toContain('id="gallery"');
    expect(page).not.toContain("Meet the team");
    expect(page).not.toContain('id="reviews"');
    expect(page).not.toContain('id="about"');
    expect(page).not.toContain('id="hours"');
    expect(page).not.toContain("Visit us");
    expect(page).not.toContain("Follow ");
    expect(page).not.toContain("null");
    expect(page).not.toContain("undefined");
  });

  it("renders a service thumbnail only when image_url is set", () => {
    const plain = html(data());
    expect(plain).not.toContain('src="https://example.com/cut.jpg"');
    const withImage = html(
      data({
        services: [
          {
            id: "svc-1",
            name: "Haircut",
            description: "Classic cut and finish",
            duration_minutes: 30,
            price: 300,
            image_url: "https://example.com/cut.jpg",
            active: true,
          },
        ],
      }),
    );
    expect(withImage).toContain('src="https://example.com/cut.jpg"');
  });

  it("uses a typography-led hero without imagery", () => {
    const page = html(data());
    // No hero <img> for the business itself (no cover, no logo).
    expect(page).not.toMatch(/<img[^>]*storefront photo/);
  });

  it("links each service into booking with the service preselected", () => {
    const page = html(data());
    expect(page).toContain("/book/watpo-hair-studio?service=svc-1");
  });
});

describe("populated business", () => {
  function populated(): AppointmentStorefrontData {
    return data({
      business: business({
        tagline: "Sharp looks, honest prices.",
        description: "A neighbourhood barbershop.",
        cover_image_url: "https://example.com/cover.jpg",
        logo_url: "https://example.com/logo.png",
        address: "Royal Road, Flic-en-Flac",
        availability: { mon: { open: "09:00", close: "18:00" } },
      }),
      hours: { mon: { open: "09:00", close: "18:00" } } as never,
      bundle: {
        storefront: {
          business_id: "biz-w",
          template: "appointment_modern",
          headline: "Look sharp.",
          subheadline: "Walk out confident.",
          hero_image_url: "https://example.com/hero.jpg",
          show_gallery: true,
          show_team: true,
          show_reviews: true,
          show_about: true,
          show_hours: true,
          show_location: true,
          show_social: true,
          social_links: { instagram: "https://instagram.com/watpo" },
          amenities: ["Wi-Fi"],
          section_order: null,
          created_at: "",
          updated_at: "",
        },
        gallery: [
          {
            id: "g-1",
            business_id: "biz-w",
            image_url: "https://example.com/g1.jpg",
            caption: "Fade",
            alt_text: null,
            sort_order: 0,
            is_featured: true,
            created_at: "",
          },
        ],
        team: [
          {
            id: "t-1",
            business_id: "biz-w",
            member_user_id: null,
            name: "Watpo",
            role: "Owner · Barber",
            bio: "Cutting since 2010.",
            photo_url: null,
            visible: true,
            bookable: false,
            sort_order: 0,
            created_at: "",
          },
        ],
        reviews: [
          {
            id: "r-1",
            business_id: "biz-w",
            source: "google",
            external_id: "g-1",
            reviewer_name: "Priya",
            rating: 5,
            body: "Best fade in town.",
            review_date: "2026-08-01",
            visible: true,
            created_at: "",
          },
        ],
      },
    });
  }

  it("renders every populated section once", () => {
    const page = html(populated());
    expect(page).toContain("Look sharp.");
    expect(page).toContain("Gallery");
    expect(page).toContain("Meet the team");
    expect(page).toContain("Watpo");
    expect(page).toContain("Best fade in town.");
    expect(page).toContain("About Watpo Hair Studio");
    expect(page).toContain("Opening hours");
    expect(page).toContain("Visit us");
    expect(page).toContain("Royal Road, Flic-en-Flac");
    expect(page).toContain("instagram.com/watpo");
    expect(page).toContain("Wi-Fi");
    expect(page).toContain("Barbershop");
  });

  it("aggregate rating reflects legitimate rows", () => {
    const page = html(populated());
    expect(page).toContain("5.0");
  });

  it("visibility flags hide populated sections", () => {
    const input = populated();
    if (input.bundle.storefront) {
      input.bundle.storefront.show_gallery = false;
      input.bundle.storefront.show_team = false;
    }
    const page = html(input);
    expect(page).not.toContain('id="gallery"');
    expect(page).not.toContain("Meet the team");
    // Untouched sections still render.
    expect(page).toContain('id="reviews"');
  });

  it("never exposes the reserved bookable flag", () => {
    const page = html(populated());
    expect(page).not.toContain("Book with");
    expect(page).not.toMatch(/bookable/i);
  });
});

describe("preview mode", () => {
  it("shows the owner preview notice", () => {
    const page = html(data({ preview: true }));
    expect(page).toContain("Preview — this page isn");
  });
});
