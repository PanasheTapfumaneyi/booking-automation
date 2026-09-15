import type { Metadata } from "next";
import Link from "next/link";

interface ResultPageProps {
  searchParams: Promise<{ status?: string; reason?: string; business?: string }>;
}

export const metadata: Metadata = {
  title: "Google Calendar connection",
  description: "Google Calendar connection result.",
};

export default async function CalendarResultPage({ searchParams }: ResultPageProps) {
  const params = await searchParams;
  const success = params.status === "success";
  const reason = params.reason ?? "unknown";

  const messages: Record<string, string> = {
    denied: "You closed the Google permission screen without connecting.",
    "invalid-state": "This connection link is invalid or has expired. Please start over.",
    "exchange-failed": "Google could not complete the connection. Please try again.",
    "business-not-found": "The business being connected could not be found.",
    "not-allowed": "This business isn't enabled for Google Calendar self-service yet.",
    config: "Google Calendar isn't configured correctly yet. Please contact the business.",
    "missing-business": "No business was specified in the connection link.",
  };
  const message = messages[reason] ?? "Something went wrong. Please try again.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 p-8 text-center shadow-sm">
        <div className="text-5xl">{success ? "✅" : "⚠️"}</div>
        <h1 className="mt-4 text-xl font-semibold text-neutral-900">
          {success ? "Google Calendar connected" : "Connection unsuccessful"}
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          {success
            ? "Your business calendar is now connected. New bookings will appear on the business calendar automatically, and manual calendar events will block the booking times they overlap."
            : message}
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-neutral-900 px-6 py-2 text-sm font-medium text-white"
        >
          Back to booking
        </Link>
      </div>
    </main>
  );
}