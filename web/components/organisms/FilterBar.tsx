"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, X } from "lucide-react";
import { ICONS } from "@/components/atoms/icons/nav";
import { useReportFilterPending } from "@/components/organisms/FilterTransition";
import type { FilterOptions, GalleryFilters } from "@/lib/types";

// Sits above the grid rather than in the sidebar. A filter acts on the grid,
// so putting it there makes the link obvious; on the left it would read as
// navigation. It also survives below 768px, where the sidebar is hidden and
// where people sort the most.
//
// Everything lives in the URL: a narrowed view is shareable, the back button
// works, and the filtering happens in SQL rather than over the twelve items
// that happen to be loaded.

const PROJECT_LABELS: Record<string, string> = {
  popup: "Pop-up",
  store: "Boutique",
};
const TYPE_LABELS: Record<string, string> = {
  all: "Tout",
  image: "Images",
  video: "Vidéos",
};
// The same drawings the sidebar used for these two tabs, so moving them into
// the filter bar doesn't make them look like something new.
const TYPE_ICONS: Record<string, keyof typeof ICONS> = {
  all: "discover",
  image: "images",
  video: "videos",
};
// Vidéos en tête parce que c'est là qu'on atterrit ; l'ordre du `group by`
// qui alimente les compteurs, lui, n'est pas garanti.
const TYPE_ORDER = ["video", "image"] as const;
// Le paramètre d'URL est en français, le champ du filtre en anglais : la
// correspondance sert à peindre la pilule avant que le serveur ait répondu.
// `type` n'y figure pas : ses onglets passent par selectType, pas par apply.
const FIELD: Record<string, keyof GalleryFilters> = {
  projet: "projectType",
  marque: "brand",
  lieu: "city",
};

type Props = { options: FilterOptions; active: GalleryFilters };

export function FilterBar({ options, active }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const reportPending = useReportFilterPending();

  // L'état pressé des pilules venait uniquement des props serveur : le clic
  // restait mort pendant tout l'aller-retour RSC. useOptimistic peint la
  // nouvelle sélection dans la frame du clic, et React la rend à la valeur du
  // serveur dès que la transition se termine — y compris si elle échoue.
  const [shown, applyOptimistic] = useOptimistic(
    active,
    (current: GalleryFilters, patch: Partial<GalleryFilters>) => ({
      ...current,
      ...patch,
    })
  );

  // La grille est un sous-arbre frère rendu par le serveur ; c'est le contexte
  // qui lui porte l'information « une navigation est en vol ».
  useEffect(() => {
    reportPending(isPending);
  }, [isPending, reportPending]);

  // Toggling: clicking the active value clears it, which is what a pill that
  // looks pressed should do.
  // toggle: une pilule pressée qu'on reclique se relâche. Les onglets de type
  // font exception — c'est un segmented control, il y a toujours exactement
  // une valeur active.
  const hrefFor = useCallback(
    (key: string, value: string | null, toggle = true) => {
      const next = new URLSearchParams(params.toString());
      if (!value || (toggle && next.get(key) === value)) next.delete(key);
      else next.set(key, value);
      const query = next.toString();
      return query ? `/?${query}` : "/";
    },
    [params]
  );

  function selectType(value: string) {
    const href = hrefFor("type", value, false);
    startTransition(() => {
      applyOptimistic({
        type: value === "all" ? null : (value as "image" | "video"),
      });
      router.push(href, { scroll: false });
    });
  }

  function apply(key: string, value: string | null) {
    const cleared = !value || params.get(key) === value;
    const href = hrefFor(key, value);
    startTransition(() => {
      applyOptimistic({
        [FIELD[key]]: cleared ? null : value,
      } as Partial<GalleryFilters>);
      router.push(href, { scroll: false });
    });
  }

  // L'onglet de type n'est pas un filtre qu'on retire : « Tout effacer » ne
  // doit pas basculer sur un autre média que celui qu'on est en train de
  // regarder. Il ne lève que marque, lieu et type de projet.
  function clearAll() {
    const next = new URLSearchParams();
    const type = params.get("type");
    if (type) next.set("type", type);
    const query = next.toString();
    startTransition(() => {
      applyOptimistic({ projectType: null, brand: null, city: null });
      router.push(query ? `/?${query}` : "/", { scroll: false });
    });
  }

  // Précharger au survol : le temps qu'il faut pour amener le curseur sur une
  // pilule suffit souvent à couvrir la requête, et le clic devient instantané.
  const prefetch = useCallback(
    (key: string, value: string | null, toggle = true) =>
      router.prefetch(hrefFor(key, value, toggle)),
    [router, hrefFor]
  );

  // Le type est exclu : un segmented control est toujours sur une valeur, le
  // compter rendrait « Tout effacer » visible en permanence.
  const activeCount = [shown.projectType, shown.brand, shown.city].filter(
    Boolean
  ).length;

  const totalCount = options.types.reduce((sum, t) => sum + t.count, 0);
  const typeTabs = [
    { value: "all", count: totalCount },
    ...TYPE_ORDER.flatMap((value) => {
      const found = options.types.find((t) => t.value === value);
      return found ? [{ value: value as string, count: found.count }] : [];
    }),
  ];
  // null côté filtres — « tout » — est l'onglet Tout côté barre.
  const activeType = shown.type ?? "all";

  const brandName =
    options.brands.find((b) => b.slug === shown.brand)?.name ?? null;

  return (
    <div className="sticky top-0 z-20 -mx-4 mb-4 bg-background/85 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
      {/* Horizontal scroll rather than wrapping: on a phone the bar stays one
          line high instead of eating a third of the screen. */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {typeTabs.map(({ value, count }) => (
          <Pill
            key={value}
            active={activeType === value}
            onClick={() => selectType(value)}
            onPrefetch={() => prefetch("type", value, false)}
          >
            <span className="mr-1.5 h-4 w-4 shrink-0" aria-hidden>
              {ICONS[TYPE_ICONS[value]]}
            </span>
            {TYPE_LABELS[value]}
            <Count n={count} />
          </Pill>
        ))}

        {options.projectTypes.length > 0 && <Separator />}

        {options.projectTypes.map(({ value, count }) => (
          <Pill
            key={value}
            active={shown.projectType === value}
            onClick={() => apply("projet", value)}
            onPrefetch={() => prefetch("projet", value)}
          >
            {PROJECT_LABELS[value]}
            <Count n={count} />
          </Pill>
        ))}

        {(options.brands.length > 0 || options.cities.length > 0) && (
          <Separator />
        )}

        {/* Brands and cities are dropdowns, not pills: there are thirty of the
            first and they would make an unreadable second row. */}
        {options.brands.length > 0 && (
          <Dropdown
            label="Marque"
            selected={brandName}
            searchable
            items={options.brands.map((b) => ({
              value: b.slug,
              label: b.name,
              count: b.count,
            }))}
            activeValue={shown.brand ?? null}
            onSelect={(v) => apply("marque", v)}
            onPrefetch={(v) => prefetch("marque", v)}
          />
        )}

        {options.cities.length > 0 && (
          <Dropdown
            label="Lieu"
            selected={shown.city ?? null}
            items={options.cities.map((c) => ({
              value: c.city,
              label: c.city,
              count: c.count,
            }))}
            activeValue={shown.city ?? null}
            onSelect={(v) => apply("lieu", v)}
            onPrefetch={(v) => prefetch("lieu", v)}
          />
        )}

        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="ml-1 flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm text-foreground/60 transition-colors hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Tout effacer
          </button>
        )}
      </div>
    </div>
  );
}

function Separator() {
  return <span className="h-5 w-px shrink-0 bg-foreground/15" aria-hidden />;
}

function Count({ n }: { n: number }) {
  return <span className="ml-1.5 text-xs tabular-nums opacity-50">{n}</span>;
}

function Pill({
  active,
  onClick,
  onPrefetch,
  children,
}: {
  active: boolean;
  onClick: () => void;
  onPrefetch?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
      aria-pressed={active}
      className={`flex shrink-0 items-center whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-foreground/15 text-foreground/70 hover:border-foreground/40 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

type DropdownItem = { value: string; label: string; count: number };

function Dropdown({
  label,
  selected,
  items,
  activeValue,
  onSelect,
  onPrefetch,
  searchable = false,
}: {
  label: string;
  selected: string | null;
  items: DropdownItem[];
  activeValue: string | null;
  onSelect: (value: string) => void;
  onPrefetch?: (value: string) => void;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // The pill row scrolls horizontally on narrow screens, and a scrolling
  // container clips whatever leaves it — which is what hid this menu. So the
  // panel is rendered into <body> and positioned from the trigger's box,
  // where no ancestor can crop it.
  const place = useCallback(() => {
    const r = trigger.current?.getBoundingClientRect();
    if (!r) return;
    const width = 224; // w-56
    setAt({
      top: r.bottom + 6,
      // Kept inside the viewport: near the right edge the menu flips to align
      // on the trigger's right rather than hanging off screen.
      left: Math.min(r.left, window.innerWidth - width - 8),
    });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (trigger.current?.contains(target) || panel.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    // Following the trigger beats freezing the menu in place when the page
    // scrolls under it.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  const shown = query
    ? items.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()))
    : items;

  return (
    <div className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors ${
          selected
            ? "border-foreground bg-foreground text-background"
            : "border-foreground/15 text-foreground/70 hover:border-foreground/40 hover:text-foreground"
        }`}
      >
        {selected ?? label}
        <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
      </button>

      {open &&
        at &&
        createPortal(
          <div
            ref={panel}
            style={{ top: at.top, left: at.left }}
            className="fixed z-[80] max-h-72 w-56 overflow-y-auto rounded-lg border border-foreground/15 bg-background p-1 shadow-xl">
          {searchable && (
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="mb-1 w-full rounded-md bg-foreground/5 px-2 py-1.5 text-sm outline-none"
            />
          )}
          {shown.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                onSelect(item.value);
                setOpen(false);
                setQuery("");
              }}
              // Une entrée à la fois : préparer les trente marques à
              // l'ouverture du menu coûterait trente requêtes pour un clic.
              onMouseEnter={() => onPrefetch?.(item.value)}
              onFocus={() => onPrefetch?.(item.value)}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-foreground/5"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                {activeValue === item.value && (
                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                )}
                <span className="truncate">{item.label}</span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-foreground/40">
                {item.count}
              </span>
            </button>
          ))}
          {shown.length === 0 && (
            <p className="px-2 py-3 text-center text-sm text-foreground/50">
              Aucun résultat
            </p>
          )}
          </div>,
          document.body
        )}
    </div>
  );
}
