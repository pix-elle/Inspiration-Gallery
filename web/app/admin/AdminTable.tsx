"use client";

import { useCallback, useEffect, useState } from "react";
import { UploadForm } from "./UploadForm";
import { ItemRow } from "./ItemRow";
import type { Brand, Item } from "@/lib/types";

type Props = { initialItems: Item[]; initialBrands: Brand[] };

export function AdminTable({ initialItems, initialBrands }: Props) {
  const [items, setItems] = useState(initialItems);
  const [brands, setBrands] = useState(initialBrands);

  const refresh = useCallback(async () => {
    const [i, b] = await Promise.all([
      fetch("/api/admin/items").then((r) => r.json()),
      fetch("/api/admin/brands").then((r) => r.json()),
    ]);
    setItems(i.items);
    setBrands(b.brands);
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

  return (
    <div className="flex flex-col gap-6">
      <UploadForm brands={brands} onDone={refresh} />

      <div className="flex flex-col gap-2">
        <p className="text-sm text-foreground/60">
          {items.length} élément{items.length > 1 ? "s" : ""} — {online} en ligne
          {encoding && " · encodage en cours…"}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left">
            <thead>
              <tr className="text-xs text-foreground/50">
                <th className="w-14 pb-2 font-medium" />
                <th className="pb-2 font-medium">Titre</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Marque</th>
                <th className="pb-2 font-medium">Statut</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  brands={brands}
                  onChanged={refresh}
                />
              ))}
            </tbody>
          </table>
        </div>

        {items.length === 0 && (
          <p className="py-8 text-center text-sm text-foreground/60">
            Rien pour l&apos;instant. Envoie un premier fichier ci-dessus.
          </p>
        )}
      </div>
    </div>
  );
}
