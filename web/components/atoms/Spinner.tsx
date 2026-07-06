export function Spinner() {
  return (
    <div
      className="h-5 w-5 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground/70"
      role="status"
      aria-label="Loading"
    />
  );
}
