import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <p className="text-sm text-foreground/60">
        This page doesn&apos;t exist — maybe it was removed.
      </p>
      <Link
        href="/"
        className="text-sm underline hover:text-foreground text-foreground/70"
      >
        Back to the gallery
      </Link>
    </div>
  );
}
