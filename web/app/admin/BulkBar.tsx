"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, Loader2, RotateCw, Trash2, X } from "lucide-react";
import type { Brand, Item } from "@/lib/types";

type Props = {
  selected: Item[];
  brands: Brand[];
  onClear: () => void;
  onDone: () => void;
};

type Result = { done: string[]; skipped: { id: string; reason: string }[] };

// Ne s'affiche qu'avec une sélection : au repos la table reste nue.
export function BulkBar({ selected, brands, onClear, onDone }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [brandDraft, setBrandDraft] = useState("");
  const [report, setReport] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (selected.length === 0) return null;

  const ids = selected.map((i) => i.id);
  const failedCount = selected.filter((i) => i.status === "failed").length;

  async function run(label: string, body: Record<string, unknown>) {
    setBusy(label);
    setReport(null);
    try {
      // Le menu envoie __none__ pour « retirer la marque » : brandId vide est
      // déjà la valeur de l'option d'invite, il fallait les distinguer.
      const payload =
        body.brandId === "__none__" ? { ...body, brandId: null } : body;
      const res = await fetch("/api/admin/items/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Échec (${res.status})`);

      // Un lot réussit rarement en entier, et un rouge générique ferait
      // croire que rien n'est passé. On annonce donc les deux nombres, et
      // le motif d'exclusion quand il y en a un.
      const { done, skipped } = data as Result;
      const reasons = [...new Set(skipped.map((s) => s.reason))].join(", ");
      setReport(
        skipped.length === 0
          ? `${done.length} élément${done.length > 1 ? "s" : ""} modifié${done.length > 1 ? "s" : ""}.`
          : `${done.length} traité${done.length > 1 ? "s" : ""}, ${skipped.length} ignoré${skipped.length > 1 ? "s" : ""} — ${reasons}.`
      );
      onDone();
      if (skipped.length === 0) onClear();
    } catch (err) {
      setReport(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
      setConfirmingDelete(false);
    }
  }

  const disabled = busy !== null;
  const chip =
    "flex items-center gap-1.5 rounded-md border border-foreground/15 px-2.5 py-1.5 text-sm hover:border-foreground/40 disabled:opacity-40";

  return (
    <div className="sticky bottom-4 z-20 mx-auto w-fit max-w-full">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-foreground/15 bg-background/95 p-2 shadow-xl backdrop-blur">
        <span className="px-1.5 text-sm font-medium tabular-nums">
          {selected.length} sélectionné{selected.length > 1 ? "s" : ""}
        </span>

        <span className="h-5 w-px bg-foreground/15" aria-hidden />

        <select
          defaultValue=""
          disabled={disabled}
          onChange={(e) => e.target.value && run("brand", { action: "update", brandId: e.target.value })}
          className="rounded-md border border-foreground/15 bg-transparent px-2 py-1.5 text-sm outline-none"
        >
          <option value="">Marque existante…</option>
          <option value="__none__">— Aucune marque —</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        {/* Champ libre à côté du menu : le serveur passe par findOrCreateBrand,
            qui réutilise la marque dont le slug correspond déjà. Retaper
            « Nespresso » sur des items mal rangés les recolle donc à la marque
            existante au lieu d'en créer une deuxième. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const name = brandDraft.trim();
            if (!name) return;
            run("brandName", { action: "update", brandName: name });
            setBrandDraft("");
          }}
          className="flex items-center gap-1 rounded-md border border-foreground/15 px-2 focus-within:border-foreground/40"
        >
          <input
            value={brandDraft}
            onChange={(e) => setBrandDraft(e.target.value)}
            disabled={disabled}
            placeholder="ou saisir une marque…"
            aria-label="Saisir une marque pour la sélection"
            className="w-40 bg-transparent py-1.5 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={disabled || !brandDraft.trim()}
            aria-label="Appliquer la marque saisie"
            className="rounded p-1 text-foreground/60 hover:text-foreground disabled:opacity-30"
          >
            <Check className="h-4 w-4" aria-hidden />
          </button>
        </form>

        <select
          defaultValue=""
          disabled={disabled}
          onChange={(e) => e.target.value && run("type", { action: "update", projectType: e.target.value })}
          className="rounded-md border border-foreground/15 bg-transparent px-2 py-1.5 text-sm outline-none"
        >
          <option value="">Type…</option>
          <option value="popup">Pop-up</option>
          <option value="store">Magasin</option>
        </select>

        <button type="button" disabled={disabled} className={chip}
          onClick={() => run("publish", { action: "update", status: "published" })}>
          <Eye className="h-4 w-4" aria-hidden /> Publier
        </button>

        <button type="button" disabled={disabled} className={chip}
          onClick={() => run("hide", { action: "update", status: "unpublished" })}>
          <EyeOff className="h-4 w-4" aria-hidden /> Masquer
        </button>

        {failedCount > 0 && (
          <button type="button" disabled={disabled} className={chip}
            onClick={() => run("retry", { action: "retry" })}>
            <RotateCw className="h-4 w-4" aria-hidden /> Relancer ({failedCount})
          </button>
        )}

        {/* La suppression détruit aussi les fichiers sur R2. À l'unité un
            double-clic suffit ; sur une sélection il faut voir le nombre. */}
        {confirmingDelete ? (
          <span className="flex items-center gap-1.5 rounded-md bg-foreground/5 px-2 py-1">
            <span className="text-sm">
              Supprimer {selected.length} élément{selected.length > 1 ? "s" : ""} et leurs fichiers, définitivement ?
            </span>
            <button type="button" disabled={disabled}
              onClick={() => run("delete", { action: "delete" })}
              className="rounded bg-foreground px-2 py-1 text-xs font-medium text-background disabled:opacity-40">
              Supprimer
            </button>
            <button type="button" onClick={() => setConfirmingDelete(false)}
              className="rounded px-2 py-1 text-xs text-foreground/60 hover:text-foreground">
              Annuler
            </button>
          </span>
        ) : (
          <button type="button" disabled={disabled} className={chip}
            onClick={() => setConfirmingDelete(true)}>
            <Trash2 className="h-4 w-4" aria-hidden /> Supprimer
          </button>
        )}

        {busy && <Loader2 className="h-4 w-4 animate-spin text-foreground/60" aria-hidden />}

        <button type="button" onClick={onClear} title="Vider la sélection"
          className="ml-auto rounded p-1.5 text-foreground/60 hover:bg-foreground/5 hover:text-foreground">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {report && (
        <p className="mt-2 rounded-lg border border-foreground/15 bg-background/95 px-3 py-2 text-sm text-foreground/70 shadow">
          {report}
        </p>
      )}
    </div>
  );
}
