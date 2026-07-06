import { Skeleton } from "@/components/atoms/Skeleton";
import { getItems } from "@/lib/queries";

// Content only changes when new items are ingested — near-static, edge-cached.
export const revalidate = 300;

// Filler heights so the masonry feel is visible while the catalog is small.
const PLACEHOLDER_HEIGHTS = [260, 340, 220, 400, 300, 240, 360, 280, 320];

export default async function HomePage() {
  const { items } = await getItems({ limit: 30 });

  return (
    <div className="columns-2 gap-4 sm:columns-3 xl:columns-4">
      {/* Real items from the database — placeholder rendering until Phase 4 tiles */}
      {items.map((item) => (
        <div
          key={item.id}
          className="mb-4 flex break-inside-avoid items-end rounded-lg p-3"
          style={{
            aspectRatio: item.width / item.height,
            backgroundColor: item.dominant_color ?? "#222",
          }}
        >
          <span className="text-sm font-medium text-white/90">
            {item.title}
          </span>
        </div>
      ))}
      {/* Skeleton filler while the catalog is small */}
      {PLACEHOLDER_HEIGHTS.map((height, i) => (
        <div key={i} className="mb-4 break-inside-avoid" style={{ height }}>
          <Skeleton className="h-full w-full" />
        </div>
      ))}
    </div>
  );
}
