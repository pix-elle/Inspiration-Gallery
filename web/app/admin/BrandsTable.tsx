"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, Merge, Search, Trash2 } from "lucide-react";
import { slugify } from "@/lib/slug";
import type { BrandWithCount } from "@/lib/queries";

type Props = { initialBrands: BrandWithCount[]; onChanged: () => void };

export function BrandsTable({ initialBrands, onChanged }: Props) {
  const [brands, setBrands] = useState(initialBrands);
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Un renommage qui bute sur une marque existante ouvre une proposition de
  // fusion plutôt qu'une erreur : c'est très exactement le moment où l'on
  // veut fusionner.
  const [conflict, setConflict] = useState<
    { from: BrandWithCount; into: { id: string; name: string }; name: string } | null
  >(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, query]);

  const apply = useCallback(
    (next: BrandWithCount[]) => {
      setBrands(next);
      setDrafts({});
      // La galerie publique et les listes de la table des médias affichent
      // ces libellés : elles doivent repartir de la nouvelle vérité.
      onChanged();
    },
    [onChanged]
  );

  async function rename(brand: BrandWithCount, name: string) {
    if (!name.trim() || name.trim() === brand.name) return;
    setBusy(brand.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/brands", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: brand.id, name }),
      });
      const data = await res.json();
      if (res.status === 409 && data.conflict) {
        setConflict({ from: brand, into: data.conflict, name });
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Renommage refusé");
      apply(data.brands);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function merge(fromId: string, intoId: string) {
    setBusy(fromId);
    setError(null);
    try {
      const res = await fetch("/api/admin/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "merge", from: fromId, into: intoId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fusion refusée");
      apply(data.brands);
      setConflict(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/brands?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Suppression refusée");
      apply(data.brands);
      setConfirmDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Marques</h2>
        <div className="flex items-center gap-2 rounded-md border border-foreground/15 px-2 focus-within:border-foreground/40">
          <Search className="h-3.5 w-3.5 shrink-0 text-foreground/40" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une marque…"
            aria-label="Rechercher une marque"
            className="bg-transparent py-1.5 text-sm outline-none"
          />
        </div>
      </div>

      <p className="text-sm text-foreground/60">
        {brands.length} marque{brands.length > 1 ? "s" : ""} — le nom
        s&apos;enregistre en quittant le champ.
      </p>

      {error && (
        <p className="rounded-md border border-foreground/15 px-3 py-2 text-sm">{error}</p>
      )}

      {conflict && (
        <div className="flex flex-col gap-2 rounded-lg border border-foreground/30 p-3">
          <p className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              « {conflict.into.name} » porte déjà ce nom. Fusionner déplacerait les{" "}
              <span className="font-medium tabular-nums">{conflict.from.items}</span> élément
              {conflict.from.items > 1 ? "s" : ""} de « {conflict.from.name} » vers elle, puis
              supprimerait « {conflict.from.name} ».
            </span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => merge(conflict.from.id, conflict.into.id)}
              disabled={busy !== null}
              className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-40"
            >
              <Merge className="h-3.5 w-3.5" aria-hidden />
              Fusionner
            </button>
            <button
              type="button"
              onClick={() => setConflict(null)}
              className="rounded-md px-3 py-1.5 text-sm text-foreground/60 hover:text-foreground"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left">
          <thead>
            <tr className="text-xs text-foreground/50">
              <th className="pb-2 font-medium">Nom</th>
              <th className="pb-2 font-medium">Identifiant d&apos;URL</th>
              <th className="w-20 pb-2 font-medium">Éléments</th>
              <th className="w-16 pb-2" />
            </tr>
          </thead>
          <tbody>
            {shown.map((brand) => {
              const draft = drafts[brand.id] ?? brand.name;
              const nextSlug = slugify(draft);
              // On n'avertit que quand le slug change réellement : une
              // correction de casse le laisse identique, et un avertissement
              // permanent ne serait plus lu.
              const slugChanges = nextSlug !== brand.slug && draft.trim() !== "";
              return (
                <tr key={brand.id} className="border-t border-foreground/10 align-middle">
                  <td className="py-2 pr-3">
                    <input
                      value={draft}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [brand.id]: e.target.value }))
                      }
                      onBlur={() => rename(brand, draft)}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      disabled={busy === brand.id}
                      className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm outline-none hover:border-foreground/15 focus-visible:border-foreground/40"
                    />
                  </td>

                  <td className="py-2 pr-3 text-sm text-foreground/50">
                    <span className="font-mono text-xs">{nextSlug || "—"}</span>
                    {slugChanges && (
                      <span className="flex items-center gap-1 pt-0.5 text-xs text-foreground/60">
                        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                        Les liens en ?marque={brand.slug} cesseront de fonctionner
                      </span>
                    )}
                  </td>

                  <td className="py-2 pr-3 text-sm tabular-nums text-foreground/60">
                    {brand.items}
                  </td>

                  <td className="py-2 text-right">
                    {confirmDelete === brand.id ? (
                      <span className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => remove(brand.id)}
                          disabled={busy === brand.id}
                          className="rounded bg-foreground px-2 py-1 text-xs font-medium text-background disabled:opacity-40"
                        >
                          Supprimer
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(null)}
                          className="rounded px-2 py-1 text-xs text-foreground/60 hover:text-foreground"
                        >
                          Annuler
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        title={
                          brand.items > 0
                            ? `Supprimer — ses ${brand.items} éléments resteront, sans marque`
                            : "Supprimer"
                        }
                        onClick={() => setConfirmDelete(brand.id)}
                        disabled={busy === brand.id}
                        className="rounded p-1.5 text-foreground/60 hover:bg-foreground/5 hover:text-foreground disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {shown.length === 0 && (
        <p className="py-8 text-center text-sm text-foreground/60">
          {brands.length === 0
            ? "Aucune marque — elles se créent en assignant un nom depuis l'onglet Médias."
            : "Aucune marque ne correspond à cette recherche."}
        </p>
      )}
    </div>
  );
}
