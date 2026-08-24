"use client";

import { Search, X } from "lucide-react";
import type { Brand, Item } from "@/lib/types";

export type Filters = {
  /** "" = tous */
  status: "" | Item["status"];
  /** Champ manquant — c'est le filtre qui sert à finir un import. */
  missing: "" | "brand" | "projectType";
  brand: string;
  query: string;
};

export const EMPTY_FILTERS: Filters = {
  status: "",
  missing: "",
  brand: "",
  query: "",
};

export function isFiltering(f: Filters): boolean {
  return f.status !== "" || f.missing !== "" || f.brand !== "" || f.query.trim() !== "";
}

export function applyFilters(items: Item[], f: Filters): Item[] {
  const q = f.query.trim().toLowerCase();
  return items.filter((item) => {
    if (f.status && item.status !== f.status) return false;
    if (f.missing === "brand" && item.brand_id) return false;
    if (f.missing === "projectType" && item.project_type) return false;
    if (f.brand && item.brand_id !== f.brand) return false;
    if (q && !(item.title ?? "").toLowerCase().includes(q)) return false;
    return true;
  });
}

const select =
  "rounded-md border border-foreground/15 bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:border-foreground/40";

type Props = {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
  brands: Brand[];
  shown: number;
  total: number;
};

export function AdminFilters({ filters, onChange, onReset, brands, shown, total }: Props) {
  const active = isFiltering(filters);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex min-w-48 flex-1 items-center gap-2 rounded-md border border-foreground/15 px-2 focus-within:border-foreground/40">
        <Search className="h-3.5 w-3.5 shrink-0 text-foreground/40" aria-hidden />
        <input
          value={filters.query}
          onChange={(e) => onChange({ query: e.target.value })}
          placeholder="Rechercher un titre…"
          aria-label="Rechercher un titre"
          className="w-full bg-transparent py-1.5 text-sm outline-none"
        />
      </div>

      <select
        value={filters.status}
        onChange={(e) => onChange({ status: e.target.value as Filters["status"] })}
        aria-label="Filtrer par statut"
        className={select}
      >
        <option value="">Tous les statuts</option>
        <option value="published">En ligne</option>
        <option value="unpublished">Masqué</option>
        <option value="processing">Encodage en cours</option>
        <option value="failed">Échec</option>
      </select>

      {/* Le filtre qui sert réellement après un import de dossier : il isole
          ce qu'il reste à compléter, et le lot fait le reste. */}
      <select
        value={filters.missing}
        onChange={(e) => onChange({ missing: e.target.value as Filters["missing"] })}
        aria-label="Filtrer les champs manquants"
        className={select}
      >
        <option value="">Complets ou non</option>
        <option value="brand">Sans marque</option>
        <option value="projectType">Sans type de projet</option>
      </select>

      {brands.length > 0 && (
        <select
          value={filters.brand}
          onChange={(e) => onChange({ brand: e.target.value })}
          aria-label="Filtrer par marque"
          className={select}
        >
          <option value="">Toutes les marques</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      )}

      {active && (
        <>
          <span className="text-sm tabular-nums text-foreground/60">
            {shown} sur {total}
          </span>
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-foreground/60 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Réinitialiser
          </button>
        </>
      )}
    </div>
  );
}
