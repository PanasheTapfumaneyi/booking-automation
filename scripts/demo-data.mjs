/**
 * Canonical demo business definitions — single source of truth.
 *
 * Both `seed-demo.mjs` and `reset-demo.mjs` import from here to ensure
 * identical demo state after seed or reset operations.
 *
 * Only business-level fields that reset must restore are included.
 * Catalog data (services, resources, sessions) lives in seed-demo.mjs.
 */

export const DEMO_BUSINESSES = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    slug: "fade-area",
    name: "Fade Area",
    phone: "+230 5711 1111",
    email: "demo@fadearea.mu",
    timezone: "Indian/Mauritius",
    booking_mode: "appointment",
    tagline: "Your neighbourhood barbershop — walk-ins welcome, appointments preferred.",
    description: "Fade Area has been keeping Mauritius sharp since 2019. Our barbers specialise in fades, tapers, and classic cuts — all done with attention to detail and a cold drink in hand. Walk in or book ahead, we'll get you sorted.",
    cover_image_url: "https://images.unsplash.com/photo-1675599193884-38c7a5ceecbc?fm=jpg&q=80&w=1600&auto=format&fit=crop",
    logo_url: null,
    theme_config: { primary: "#2D2D2D", accent: "#A67C00", background: "#F5F0E8", surface: "#FEFDFB", foreground: "#1A1A1A", muted: "#8B6E47" },
    address: "Royal Road, Quatre Bornes, Mauritius",
    latitude: -20.2417,
    longitude: 57.4781,
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    slug: "island-surf",
    name: "Island Surf Co.",
    phone: "+230 5722 2222",
    email: "demo@islandsurf.mu",
    timezone: "Indian/Mauritius",
    booking_mode: "resource",
    tagline: "Island life starts here. Boards, bikes, and beach gear by the hour.",
    description: "Whether you're catching your first wave or your fiftieth, Island Surf Co. has the gear and the local knowledge to make it happen. Rent a board, grab a bike, or just swing by for a chat about tomorrow's swell.",
    cover_image_url: "https://images.unsplash.com/photo-1502680390548-bdbac40a9b27?fm=jpg&q=80&w=1600&auto=format&fit=crop",
    logo_url: null,
    theme_config: { primary: "#0E7C6B", accent: "#D4A843", background: "#F0F7F4", surface: "#FEFDFB", foreground: "#0A2520", muted: "#5A8A7A" },
    address: "Belle Mare Beach, Poste de Flacq, Mauritius",
    latitude: -20.1954,
    longitude: 57.8289,
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    slug: "blue-lagoon",
    name: "Blue Lagoon Swim School",
    phone: "+230 5733 3333",
    email: "demo@bluelagoon.mu",
    timezone: "Indian/Mauritius",
    booking_mode: "capacity",
    tagline: "Learn to swim with confidence. Classes for all ages and abilities.",
    description: "Blue Lagoon has been teaching Mauritius to swim since 2020. Small groups, patient instructors, and a pool that feels like home. From toddlers to triathletes, everyone starts somewhere — and this is the place.",
    cover_image_url: "https://images.unsplash.com/photo-1575429198097-0414ec08e8cd?fm=jpg&q=80&w=1600&auto=format&fit=crop",
    logo_url: null,
    theme_config: { primary: "#1565C0", accent: "#00ACC1", background: "#F0F4F8", surface: "#FEFDFB", foreground: "#0D1B2A", muted: "#546E7A" },
    address: "Coastal Road, Grand Baie, Mauritius",
    latitude: -20.0197,
    longitude: 57.5972,
  },
];

/**
 * Build a lookup map from slug → business definition.
 */
export function getDemoBySlug(slug) {
  return DEMO_BUSINESSES.find((b) => b.slug === slug) ?? null;
}

/**
 * Build a lookup map from id → business definition.
 */
export function getDemoById(id) {
  return DEMO_BUSINESSES.find((b) => b.id === id) ?? null;
}
