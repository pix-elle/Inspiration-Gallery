export function Tag({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-foreground/10 px-2.5 py-0.5 text-xs text-foreground/70">
      {label}
    </span>
  );
}
