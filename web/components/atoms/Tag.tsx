import Link from "next/link";

export function Tag({ label }: { label: string }) {
  return (
    <Link
      href={`/tag/${encodeURIComponent(label)}`}
      className="rounded-full bg-foreground/10 px-2.5 py-0.5 text-xs text-foreground/70 transition-colors hover:bg-foreground/20 hover:text-foreground"
    >
      {label}
    </Link>
  );
}
