"use client";

/**
 * Thin client for the Phase 2 storefront APIs. Throws Error with the
 * server's user-facing message; callers render it. Never touches
 * service-role material — all auth lives server-side.
 */

async function requestJson(
  url: string,
  method: string,
  body?: unknown,
): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as {
    error?: { userMessage?: string };
  } & Record<string, unknown> | null;
  if (!response.ok) {
    throw new Error(data?.error?.userMessage ?? "Something went wrong. Please try again.");
  }
  return (data ?? {}) as Record<string, unknown>;
}

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Please choose a JPG, PNG, or WebP image.";
  }
  if (file.size <= 0) return "That file looks empty — please choose another image.";
  if (file.size > MAX_IMAGE_BYTES) {
    return "Images must be 5 MB or smaller. Please choose a smaller image.";
  }
  return null;
}

export interface UploadedMedia {
  url: string;
  path: string;
}

export const storefrontApi = {
  patchStorefront(businessId: string, body: Record<string, unknown>) {
    return requestJson(`/api/businesses/${businessId}/storefront`, "PATCH", body);
  },
  addGalleryImage(businessId: string, body: Record<string, unknown>) {
    return requestJson(`/api/businesses/${businessId}/storefront/gallery`, "POST", body);
  },
  patchGalleryImage(businessId: string, imageId: string, body: Record<string, unknown>) {
    return requestJson(
      `/api/businesses/${businessId}/storefront/gallery/${imageId}`,
      "PATCH",
      body,
    );
  },
  deleteGalleryImage(businessId: string, imageId: string) {
    return requestJson(
      `/api/businesses/${businessId}/storefront/gallery/${imageId}`,
      "DELETE",
    );
  },
  addTeamMember(businessId: string, body: Record<string, unknown>) {
    return requestJson(`/api/businesses/${businessId}/storefront/team`, "POST", body);
  },
  patchTeamMember(businessId: string, memberId: string, body: Record<string, unknown>) {
    return requestJson(
      `/api/businesses/${businessId}/storefront/team/${memberId}`,
      "PATCH",
      body,
    );
  },
  deleteTeamMember(businessId: string, memberId: string) {
    return requestJson(
      `/api/businesses/${businessId}/storefront/team/${memberId}`,
      "DELETE",
    );
  },
  async uploadMedia(
    businessId: string,
    kind: "logo" | "cover" | "gallery" | "team" | "service",
    file: File,
  ): Promise<UploadedMedia> {
    const form = new FormData();
    form.set("kind", kind);
    form.set("file", file);
    const response = await fetch(`/api/businesses/${businessId}/storefront/media`, {
      method: "POST",
      body: form,
    });
    const data = (await response.json().catch(() => null)) as {
      error?: { userMessage?: string };
      url?: string;
      path?: string;
    } | null;
    if (!response.ok || !data?.url || !data?.path) {
      throw new Error(data?.error?.userMessage ?? "Something went wrong. Please try again.");
    }
    return { url: data.url, path: data.path };
  },
  deleteMedia(businessId: string, path: string) {
    return requestJson(`/api/businesses/${businessId}/storefront/media`, "DELETE", { path });
  },
  /** Delete by public URL — the server derives and verifies the path. */
  deleteMediaUrl(businessId: string, url: string) {
    return requestJson(`/api/businesses/${businessId}/storefront/media`, "DELETE", { url });
  },
};
