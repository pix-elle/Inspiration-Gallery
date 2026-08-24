"use client";

import { useRouter } from "next/navigation";
import { BrandsTable } from "./BrandsTable";
import type { BrandWithCount } from "@/lib/queries";

// Renommer ou fusionner change des libellés que l'onglet Médias affiche dans
// ses menus et son filtre. router.refresh() relit les composants serveur de
// /admin sans remonter la page : les deux onglets restent montés, donc la
// sélection en lot et les champs de textes en cours survivent.
export function BrandsPanel({ initialBrands }: { initialBrands: BrandWithCount[] }) {
  const router = useRouter();
  return <BrandsTable initialBrands={initialBrands} onChanged={() => router.refresh()} />;
}
