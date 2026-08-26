import { Skeleton } from "@/components/atoms/Skeleton";

// Mêmes points de rupture que useColumnCount dans Gallery : 1 colonne sous
// 640px, 3 au-delà. Un squelette qui n'a pas le nombre de colonnes de la
// grille qu'il annonce se trahit au moment de la bascule.
const COLUMNS = [
  ["h-52", "h-72", "h-44", "h-60"],
  ["h-64", "h-48", "h-64", "h-56"],
  ["h-44", "h-80", "h-52", "h-72"],
];

// Les hauteurs sont fixes et volontairement irrégulières. Des tuiles toutes
// identiques ne ressemblent pas à une mosaïque, et l'œil voit le décalage
// quand le vrai contenu arrive.
const PILLS = ["w-24", "w-20", "w-16", "w-24", "w-20"];

export function PageSkeleton() {
  return (
    <div aria-hidden>
      {/* La rangée de filtres d'abord : sans elle la barre surgirait après
          coup et pousserait la grille vers le bas. */}
      <div className="mb-4 flex gap-2 py-3">
        {PILLS.map((w, i) => (
          <Skeleton key={i} className={`h-8 shrink-0 rounded-full ${w}`} />
        ))}
      </div>

      <div className="-mx-2 flex items-start">
        {COLUMNS.map((column, c) => (
          <div
            key={c}
            className={`min-w-0 flex-1 ${c > 0 ? "hidden sm:block" : ""}`}
          >
            {column.map((h, i) => (
              <div key={i} className="px-2 pb-4">
                <Skeleton className={`w-full ${h}`} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
