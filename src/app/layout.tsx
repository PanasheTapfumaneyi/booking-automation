import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: {
    default: "Kivo — Simple digital booking for businesses",
    template: "%s — Kivo",
  },
  description:
    "Kivo gives your customers a simple way to book online while giving you one place to manage your availability, services and reservations.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: "website",
    siteName: "Kivo",
    title: "Kivo",
    description:
      "Simple digital booking for businesses — appointment, resource, and capacity modes.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Kivo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kivo",
    description:
      "Simple digital booking for businesses — appointment, resource, and capacity modes.",
    images: ["/og.png"],
  },
  themeColor: "#14161a",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {children}
      </body>
    </html>
  );
}
