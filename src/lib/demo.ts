import type { Business, Service } from "@/types/booking";

export const DEMO_BUSINESS: Business = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Fade District",
  tagline: "Professional cuts & grooming",
  description:
    "A relaxed neighbourhood barbershop for modern fades, precision cuts and classic grooming. Walk in as a stranger, leave as a regular.",
  phone: "+230 5700 0000",
  email: "hello@fadedistrict.mu",
  timezone: "Indian/Mauritius",
  address: "Royal Road, Quatre Bornes",
  addressNote: "Above the bakery, next to the bus stop.",
  hours: {
    mondayFriday: "09:00 – 18:00",
    saturday: "09:00 – 16:00",
    sunday: "Closed",
  },
};

export const DEMO_SERVICES: Service[] = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    businessId: DEMO_BUSINESS.id,
    name: "Haircut",
    description: "Precision scissor cut & fade, finished to your style.",
    durationMinutes: 45,
    price: 500,
    active: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    businessId: DEMO_BUSINESS.id,
    name: "Haircut + Beard",
    description: "Cut and beard shaping with hot towel finish.",
    durationMinutes: 60,
    price: 700,
    active: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000103",
    businessId: DEMO_BUSINESS.id,
    name: "Beard Trim",
    description: "Shape, line-up and tidy-up using a straight razor.",
    durationMinutes: 30,
    price: 300,
    active: true,
  },
];

export function formatPrice(price: number): string {
  return `Rs ${price.toLocaleString("en-MU")}`;
}

export function getServiceById(serviceId: string): Service | undefined {
  return DEMO_SERVICES.find((service) => service.id === serviceId);
}