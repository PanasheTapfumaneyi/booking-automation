import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AdminShell from "@/components/admin/AdminShell";
import { requirePlatformAdmin } from "@/lib/server/auth";
import { redirect } from "next/navigation";

/**
 * Shared admin layout — wraps all /admin/* pages with the standard Navbar,
 * Footer, and AdminShell (sidebar nav). Enforces platform-admin auth for
 * every admin route at the layout level so individual pages don't need to
 * re-check.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  try {
    await requirePlatformAdmin();
  } catch {
    // Not authenticated or not a platform admin — redirect to login.
    // The individual pages also call requirePlatformAdmin for defense-in-depth,
    // but the layout stops the render tree early for all admin routes.
    redirect("/login?next=/admin");
  }

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <AdminShell>{children}</AdminShell>
      </main>
      <Footer />
    </>
  );
}
