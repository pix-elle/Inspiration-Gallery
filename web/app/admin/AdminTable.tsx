"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UploadForm } from "./UploadForm";
import { ItemRow } from "./ItemRow";
import { BulkBar } from "./BulkBar";
import {
  AdminFilters,
  EMPTY_FILTERS,
  applyFilters,
  isFiltering,
  type Filters,
} from "./AdminFilters";
import type { Brand, Item } from "@/lib/types";

type Props = { initialItems: Item[]; initialBrands: Brand[] };

export function AdminTable({ initialItems, initialBrands }: Props) {
  const [items, setItems] = useState(initialItems);
  const [brands, setBrands] = useState(initialBrands);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  // Ancre du shift-clic : l'index de la dernière case cliquée seule.
  const anchor = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const [i, b] = await Promise.all([
      fetch("/api/admin/items").then((r) => r.json()),
      fetch("/api/admin/brands").then((r) => r.json()),
    ]);
    setItems(i.items);
    setBrands(b.brands);
    // Un lot supprimé laisserait sinon des identifiants fantômes dans la
    // sélection, et la barre compterait des éléments qui n'existent plus.
    const alive = new Set<string>(i.items.map((it: Item) => it.id));
    setSelectedIds((prev) => new Set([...prev].filter((id) => alive.has(id))));
  }, []);

  // Encoding happens on a GitHub runner, so nothing pushes the result back
  // here. Polling, but only while something is actually encoding: an idle
  // table makes no requests at all.
  const encoding = items.some((i) => i.status === "processing");
  useEffect(() => {
    if (!encoding) return;
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [encoding, refresh]);

  const online = items.filter((i) => i.status === "published").length;

  // Source de vérité unique : la table, « tout cocher » et la barre de lot
  // lisent tous `filtered`. C'est ce qui garantit qu'on n'agit jamais sur une
  // ligne qu'on ne voit pas — et ce qui permettra de brancher une pagination
  // sans revoir la sélection.
  const filtered = useMemo(() => applyFilters(items, filters), [items, filters]);

  const selected = useMemo(
    () => filtered.filter((i) => selectedIds.has(i.id)),
    [filtered, selectedIds]
  );

  // Changer un filtre vide la sélection. Garder des lignes cochées qui
  // sortent du champ visible rendrait possible une suppression en lot sur des
  // éléments qu'on ne voit plus — l'erreur qu'on ne rattrape pas.
  const changeFilters = useCallback((patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setSelectedIds(new Set());
    anchor.current = null;
  }, []);

  // Le shift-clic étend depuis l'ancre jusqu'à la ligne cliquée, dans le sens
  // de l'action en cours : on coche toute la plage, ou on la décoche.
  const select = useCallback(
    (index: number, shiftKey: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        const id = filtered[index].id;
        const adding = !prev.has(id);
        if (shiftKey && anchor.current !== null) {
          // La plage suit l'ordre affiché, pas l'ordre source : sous filtre,
          // « de celle-ci à celle-là » ne peut vouloir dire que ce qu'on voit.
          const [from, to] = [anchor.current, index].sort((a, b) => a - b);
          for (let i = from; i <= to; i++) {
            if (adding) next.add(filtered[i].id);
            else next.delete(filtered[i].id);
          }
        } else if (adding) {
          next.add(id);
        } else {
          next.delete(id);
        }
        return next;
      });
      anchor.current = index;
    },
    [filtered]
  );

  // Bornée aux lignes affichées : le jour où la table sera filtrée ou
  // paginée, « tout cocher » ne doit jamais atteindre l'invisible.
  const allSelected = filtered.length > 0 && selected.length === filtered.length;
  const toggleAll = () => {
    anchor.current = null;
    setSelectedIds(allSelected ? new Set() : new Set(filtered.map((i) => i.id)));
  };

  return (
    <div className="flex flex-col gap-6">
      <UploadForm brands={brands} onDone={refresh} />

      <div className="flex flex-col gap-2">
        <AdminFilters
          filters={filters}
          onChange={changeFilters}
          onReset={() => changeFilters(EMPTY_FILTERS)}
          brands={brands}
          shown={filtered.length}
          total={items.length}
        />

        <p className="text-sm text-foreground/60">
          {items.length} élément{items.length > 1 ? "s" : ""} — {online} en ligne
          {encoding && " · encodage en cours…"}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left">
            <thead>
              <tr className="text-xs text-foreground/50">
                <th className="w-8 pb-2 font-medium">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      // Le troisième état — sélection partielle — n'existe
                      // qu'en JS, aucun attribut HTML ne le porte.
                      if (el) {
                        el.indeterminate =
                          selected.length > 0 && !allSelected;
                      }
                    }}
                    onChange={toggleAll}
                    aria-label="Tout sélectionner"
                    className="h-4 w-4 cursor-pointer accent-current"
                  />
                </th>
                <th className="w-14 pb-2 font-medium" />
                <th className="pb-2 font-medium">Titre</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Marque</th>
                <th className="pb-2 font-medium">Statut</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, index) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  brands={brands}
                  onChanged={refresh}
                  selected={selectedIds.has(item.id)}
                  onSelect={(shiftKey) => select(index, shiftKey)}
                />
              ))}
            </tbody>
          </table>
        </div>

        <BulkBar
          selected={selected}
          brands={brands}
          onClear={() => setSelectedIds(new Set())}
          onDone={refresh}
        />

        {items.length === 0 && (
          <p className="py-8 text-center text-sm text-foreground/60">
            Rien pour l&apos;instant. Envoie un premier fichier ci-dessus.
          </p>
        )}

        {items.length > 0 && filtered.length === 0 && isFiltering(filters) && (
          <p className="py-8 text-center text-sm text-foreground/60">
            Aucun élément ne correspond à ces filtres.
          </p>
        )}
      </div>
    </div>
  );
}
