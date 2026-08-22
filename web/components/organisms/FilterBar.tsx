"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, X } from "lucide-react";
import { ICONS } from "@/components/atoms/icons/nav";
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
  image: "Images",
  video: "Vidéos",
};
// The same drawings the sidebar used for these two tabs, so moving them into
// the filter bar doesn't make them look like something new.
const TYPE_ICONS: Record<string, keyof typeof ICONS> = {
  image: "images",
  video: "videos",
};

type Props = { options: FilterOptions; active: GalleryFilters };

export function FilterBar({ options, active }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  // Toggling: clicking the active value clears it, which is what a pill that
  // looks pressed should do.
  function apply(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (!value || next.get(key) === value) next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    router.push(query ? `/?${query}` : "/", { scroll: false });
  }

  function clearAll() {
    router.push("/", { scroll: false });
  }

  const activeCount = [
    active.type,
    active.projectType,
    active.brand,
    active.city,
  ].filter(Boolean).length;

  const brandName =
    options.brands.find((b) => b.slug === active.brand)?.name ?? null;

  return (
    <div className="sticky top-0 z-20 -mx-4 mb-4 bg-background/85 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
      {/* Horizontal scroll rather than wrapping: on a phone the bar stays one
          line high instead of eating a third of the screen. */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {options.types.map(({ value, count }) => (
          <Pill
            key={value}
            active={active.type === value}
            onClick={() => apply("type", value)}
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
            active={active.projectType === value}
            onClick={() => apply("projet", value)}
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
            activeValue={active.brand ?? null}
            onSelect={(v) => apply("marque", v)}
          />
        )}

        {options.cities.length > 0 && (
          <Dropdown
            label="Lieu"
            selected={active.city ?? null}
            items={options.cities.map((c) => ({
              value: c.city,
              label: c.city,
              count: c.count,
            }))}
            activeValue={active.city ?? null}
            onSelect={(v) => apply("lieu", v)}
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
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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
  searchable = false,
}: {
  label: string;
  selected: string | null;
  items: DropdownItem[];
  activeValue: string | null;
  onSelect: (value: string) => void;
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
