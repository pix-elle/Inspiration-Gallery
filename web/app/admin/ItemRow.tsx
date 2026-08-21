"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, RotateCw, Trash2, TriangleAlert } from "lucide-react";
import type { Brand, Item } from "@/lib/types";

const STATUS_LABEL: Record<Item["status"], string> = {
  processing: "Encodage en cours",
  published: "En ligne",
  unpublished: "Masqué",
  failed: "Échec",
};

type Props = { item: Item; brands: Brand[]; onChanged: () => void };

export function ItemRow({ item, brands, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function send(path: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, init);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Échec (${res.status})`);
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const patch = (body: Record<string, unknown>) =>
    send(`/api/admin/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  // Debounced would be nicer, but a blur-triggered save is predictable: the
  // field commits when Alessia leaves it, and never mid-word.
  const saveOnBlur =
    (field: string, current: string | null) =>
    (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = e.target.value;
      if (value === (current ?? "")) return;
      patch({ [field]: value });
    };

  const poster =
    item.poster_url ??
    (item.image_base ? `${item.image_base}/400.webp` : null);

  return (
    <tr className="border-t border-foreground/10 align-middle">
      <td className="py-2 pr-3">
        <div
          className="h-14 w-10 overflow-hidden rounded"
          style={{ backgroundColor: item.dominant_color ?? "#1a1a1a" }}
        >
          {poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          )}
        </div>
      </td>

      <td className="py-2 pr-3">
        <input
          defaultValue={item.title ?? ""}
          onBlur={saveOnBlur("title", item.title)}
          disabled={busy}
          placeholder="Sans titre"
          className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm outline-none hover:border-foreground/15 focus-visible:border-foreground/40"
        />
        {error && (
          <p className="px-1.5 pt-1 text-xs text-foreground/60">{error}</p>
        )}
        {item.status === "failed" && item.error && (
          <p className="flex items-start gap-1 px-1.5 pt-1 text-xs text-foreground/60">
            <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            {item.error}
          </p>
        )}
      </td>

      <td className="py-2 pr-3">
        <select
          defaultValue={item.project_type ?? ""}
          onBlur={saveOnBlur("projectType", item.project_type)}
          onChange={(e) => patch({ projectType: e.target.value })}
          disabled={busy}
          className="rounded border border-transparent bg-transparent px-1.5 py-1 text-sm outline-none hover:border-foreground/15 focus-visible:border-foreground/40"
        >
          <option value="">—</option>
          <option value="popup">Pop-up</option>
          <option value="store">Magasin</option>
        </select>
      </td>

      <td className="py-2 pr-3">
        <select
          defaultValue={item.brand_id ?? ""}
          onChange={(e) => patch({ brandId: e.target.value })}
          disabled={busy}
          className="rounded border border-transparent bg-transparent px-1.5 py-1 text-sm outline-none hover:border-foreground/15 focus-visible:border-foreground/40"
        >
          <option value="">—</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </td>

      <td className="py-2 pr-3 text-sm text-foreground/60">
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          {item.status === "processing" && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          )}
          {STATUS_LABEL[item.status]}
        </span>
      </td>

      <td className="py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          {item.status === "failed" && item.source_key && (
            <button
              type="button"
              title="Relancer l'encodage"
              onClick={() => send(`/api/admin/items/${item.id}/retry`, { method: "POST" })}
              disabled={busy}
              className="rounded p-1.5 text-foreground/60 hover:bg-foreground/5 hover:text-foreground disabled:opacity-40"
            >
              <RotateCw className="h-4 w-4" aria-hidden />
            </button>
          )}

          {(item.status === "published" || item.status === "unpublished") && (
            <button
              type="button"
              title={item.status === "published" ? "Masquer du site" : "Remettre en ligne"}
              onClick={() =>
                patch({
                  status: item.status === "published" ? "unpublished" : "published",
                })
              }
              disabled={busy}
              className="rounded p-1.5 text-foreground/60 hover:bg-foreground/5 hover:text-foreground disabled:opacity-40"
            >
              {item.status === "published" ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
            </button>
          )}

          {/* Two clicks, no browser dialog: confirm() blocks the whole tab and
              reads as a crash on a slow page. */}
          {confirmingDelete ? (
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  send(`/api/admin/items/${item.id}`, { method: "DELETE" })
                }
                disabled={busy}
                className="rounded bg-foreground px-2 py-1 text-xs font-medium text-background disabled:opacity-40"
              >
                Supprimer
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="rounded px-2 py-1 text-xs text-foreground/60 hover:text-foreground"
              >
                Annuler
              </button>
            </span>
          ) : (
            <button
              type="button"
              title="Supprimer définitivement"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
              className="rounded p-1.5 text-foreground/60 hover:bg-foreground/5 hover:text-foreground disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
