/**
 * ServiceCard tests — image banner + description rendering.
 *
 * The card shows a 16:9 image banner only when the service has an image;
 * otherwise it stays a text-only card (no empty image block).
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ServiceCard from "./ServiceCard";
import type { Service } from "@/types/booking";

function service(overrides: Partial<Service> = {}): Service {
  return {
    id: "svc-1",
    businessId: "biz-1",
    name: "Haircut",
    description: "Precision cut & fade.",
    durationMinutes: 45,
    price: 500,
    active: true,
    imageUrl: null,
    ...overrides,
  };
}

function html(svc: Service): string {
  return renderToStaticMarkup(
    ServiceCard({ service: svc, selected: false, onSelect: () => undefined }),
  );
}

describe("ServiceCard", () => {
  it("renders name, price, description and duration", () => {
    const page = html(service());
    expect(page).toContain("Haircut");
    expect(page).toContain("Rs 500");
    expect(page).toContain("Precision cut &amp; fade.");
    expect(page).toContain("45 min");
  });

  it("renders no image block without an image URL", () => {
    const page = html(service({ imageUrl: null }));
    expect(page).not.toContain("<img");
  });

  it("renders a banner image when imageUrl is set", () => {
    const page = html(service({ imageUrl: "https://example.com/cut.jpg" }));
    expect(page).toContain("<img");
    expect(page).toContain('src="https://example.com/cut.jpg"');
  });

  it("omits the description line when empty", () => {
    const page = html(service({ description: "" }));
    expect(page).not.toContain("Precision cut");
  });
});
