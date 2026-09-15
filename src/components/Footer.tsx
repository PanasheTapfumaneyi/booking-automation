import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-6 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; {new Date().getFullYear()} Kivo. All rights reserved.</p>
        <p>
          Booking powered by{" "}
          <Link href="/" className="font-medium text-ink hover:underline">
            Kivo
          </Link>
        </p>
      </div>
    </footer>
  );
}
