import { Gallery } from "@/components/organisms/Gallery";
import { FilterBar } from "@/components/organisms/FilterBar";
import {
  FilteredGrid,
  FilterTransition,
} from "@/components/organisms/FilterTransition";
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

  // The key is what makes a filter click take effect. Gallery keeps its items
  // in state seeded from these props, and a seed is only read on mount:
  // without a new key, the server would send the filtered list and the grid
  // would go on showing the old one until a full reload. React's own answer to
  // "reset state when a prop changes" is a key. FilteredGrid réutilise ce même
  // jeton pour rejouer son animation d'entrée.
  const token = JSON.stringify(filters);

  return (
    // Enveloppe les deux sous-arbres pour que la grille sache quand une
    // navigation de filtre est en vol, et se voile le temps de la réponse.
    <FilterTransition>
      {options && <FilterBar options={options} active={filters} />}

      <FilteredGrid token={token}>
        {items.length === 0 ? (
          <p className="py-16 text-center text-sm text-foreground/60">
            Aucun résultat pour ces filtres.
          </p>
        ) : (
          <Gallery
            key={token}
            initialItems={items}
            initialCursor={nextCursor}
            filters={filters}
          />
        )}
      </FilteredGrid>
    </FilterTransition>
  );
}
