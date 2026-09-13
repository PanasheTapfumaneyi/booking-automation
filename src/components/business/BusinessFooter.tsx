export default function BusinessFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-6 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; {new Date().getFullYear()} Kivo. All rights reserved.</p>
        <p>Simple digital booking for businesses.</p>
      </div>
    </footer>
  );
}
