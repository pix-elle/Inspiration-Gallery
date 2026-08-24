"use client";

import { useMemo, useState } from "react";
import { Check, ImageOff, Search } from "lucide-react";
import type { Item } from "@/lib/types";

// La table compte plusieurs centaines d'entrées : on n'en peint jamais plus
// que ça d'un coup, et la recherche sert à atteindre le reste. Cinq cents
// vignettes dans un panneau replié coûteraient plus cher que le pop-up.
const VISIBLE = 48;

const thumb = (item: Item) =>
  item.poster_url ?? (item.image_base ? `${item.image_base}/400.webp` : null);

type Props = {
  items: Item[];
  /** "" = automatique : la vidéo la plus récente. */
  value: string;
  onChange: (itemId: string) => void;
  disabled?: boolean;
};

export function MediaPicker({ items, value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Un item sans média encodé n'a rien à montrer ; le statut, lui, n'entre
  // pas en compte — une image téléversée exprès et laissée hors ligne est un
  // choix légitime pour le pop-up.
  const usable = useMemo(
    () => items.filter((i) => i.video_url || i.image_base),
    [items]
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return usable;
    return usable.filter((i) => (i.title ?? "").toLowerCase().includes(q));
  }, [usable, query]);

  const current = usable.find((i) => i.id === value) ?? null;
  const shown = matches.slice(0, VISIBLE);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-foreground/60">Visuel du pop-up</span>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        aria-expanded={open}
        className="flex items-center gap-3 rounded-md border border-foreground/15 p-2 text-left hover:border-foreground/40 disabled:opacity-50"
      >
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded"
          style={{ backgroundColor: current?.dominant_color ?? "transparent" }}
        >
          {current && thumb(current) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb(current)!} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <ImageOff className="h-4 w-4 text-foreground/30" aria-hidden />
          )}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm">
            {current ? current.title || "Sans titre" : "Automatique"}
          </span>
          <span className="text-xs text-foreground/50">
            {current
              ? current.video_url ? "Vidéo" : "Image"
              : "La vidéo la plus récente de la galerie"}
          </span>
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-2 rounded-md border border-foreground/15 p-2">
          <div className="flex items-center gap-2 rounded bg-foreground/5 px-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-foreground/40" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher par titre…"
              className="w-full bg-transparent py-1.5 text-sm outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => { onChange(""); setOpen(false); }}
            className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-foreground/5 ${
              value === "" ? "font-medium" : "text-foreground/70"
            }`}
          >
            {value === "" && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
            Automatique — la vidéo la plus récente
          </button>

          <div className="grid max-h-64 grid-cols-4 gap-1.5 overflow-y-auto sm:grid-cols-6">
            {shown.map((item) => {
              const src = thumb(item);
              const active = item.id === value;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.title || "Sans titre"}
                  onClick={() => { onChange(item.id); setOpen(false); }}
                  className={`relative aspect-square overflow-hidden rounded ring-offset-2 ring-offset-background ${
                    active ? "ring-2 ring-foreground" : "hover:opacity-80"
                  }`}
                  style={{ backgroundColor: item.dominant_color ?? "#1a1a1a" }}
                >
                  {src && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                  )}
                  {active && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Check className="h-4 w-4 text-white" aria-hidden />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="px-1 text-xs text-foreground/40">
            {matches.length > VISIBLE
              ? `${VISIBLE} des ${matches.length} résultats — affinez la recherche.`
              : `${matches.length} élément${matches.length > 1 ? "s" : ""}`}
          </p>
        </div>
      )}
    </div>
  );
}
