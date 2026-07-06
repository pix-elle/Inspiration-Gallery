import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 px-2 py-1">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background text-sm font-bold">
        I
      </span>
      <span className="text-sm font-semibold tracking-tight">Inspiration</span>
    </Link>
  );
}
