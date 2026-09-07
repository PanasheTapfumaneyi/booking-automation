import type { Metadata } from "next";
import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Log in — Kivo",
  description: "Log in to manage your business on Kivo.",
};

export default function LoginPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Suspense>
          <LoginForm mode="login" />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
