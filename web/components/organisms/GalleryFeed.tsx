import { Gallery } from "@/components/organisms/Gallery";
import { FilterBar } from "@/components/organisms/FilterBar";
import { getFilterOptions, getItems } from "@/lib/queries";
import type { GalleryFilters } from "@/lib/types";

type GalleryFeedProps = {
  filters?: GalleryFilters;
  /** The /images and /videos routes pin one media type and hide its pills. */
  showFilters?: boolean;
};

// Server component shared by /, /images, /videos and /tag/[tag].
// Fetches the first page already narrowed down; Gallery paginates with the
// same filters, so scrolling never widens what was asked for.
export async function GalleryFeed({
  filters = {},
  showFilters = true,
}: GalleryFeedProps) {
  const [{ items, nextCursor }, options] = await Promise.all([
    getItems({ limit: 12, ...filters }),
    showFilters ? getFilterOptions() : Promise.resolve(null),
  ]);

  return (
    <>
      {options && <FilterBar options={options} active={filters} />}

      {items.length === 0 ? (
        <p className="py-16 text-center text-sm text-foreground/60">
          Aucun résultat pour ces filtres.
        </p>
      ) : (
        <Gallery
          initialItems={items}
          initialCursor={nextCursor}
          filters={filters}
        />
      )}
    </>
  );
}
