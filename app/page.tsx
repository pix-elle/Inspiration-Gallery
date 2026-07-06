import { Skeleton } from "@/components/atoms/Skeleton";

// Placeholder tile heights until the real gallery (Phase 4) — varied so the
// masonry feel is visible from day one.
const PLACEHOLDER_HEIGHTS = [
  260, 340, 220, 400, 300, 240, 360, 280, 320, 200, 380, 260,
];

export default function HomePage() {
  return (
    <div className="columns-2 gap-4 sm:columns-3 xl:columns-4">
      {PLACEHOLDER_HEIGHTS.map((height, i) => (
        <div key={i} className="mb-4 break-inside-avoid" style={{ height }}>
          <Skeleton className="h-full w-full" />
        </div>
      ))}
    </div>
  );
}
