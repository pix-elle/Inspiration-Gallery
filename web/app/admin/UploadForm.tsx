"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import type { Brand } from "@/lib/types";

// Sends the file straight to Cloudflare with a presigned URL, then creates the
// row. XHR rather than fetch for one reason: it reports upload progress, and
// fetch still cannot. On a 40 MB clip over a hotel wifi, a bar that moves is
// the difference between waiting and thinking it crashed.
function putWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Cloudflare a refusé l'envoi (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Connexion interrompue pendant l'envoi"));
    xhr.send(file);
  });
}

type Props = { brands: Brand[]; onDone: () => void };

export function UploadForm({ brands, onDone }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [projectType, setProjectType] = useState("");
  const [brandId, setBrandId] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = progress !== null;

  function reset() {
    setFile(null);
    setTitle("");
    setProjectType("");
    setBrandId("");
    setNewBrand("");
    setProgress(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setProgress(0);

    try {
      const ask = await fetch("/api/admin/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, size: file.size }),
      });
      const presigned = await ask.json();
      if (!ask.ok) throw new Error(presigned.error ?? "Envoi refusé");

      await putWithProgress(presigned.url, file, setProgress);

      const create = await fetch("/api/admin/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: presigned.key,
          title,
          projectType,
          // An existing brand wins over the free-text field, so a typo in the
          // second doesn't create a near-duplicate of the first.
          brandId: brandId || undefined,
          brandName: brandId ? undefined : newBrand,
        }),
      });
      const created = await create.json();
      if (!create.ok) throw new Error(created.error ?? "Création refusée");

      reset();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setProgress(null);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-lg border border-foreground/15 p-4"
    >
      <h2 className="text-sm font-semibold">Ajouter une vidéo ou une image</h2>

      <input
        ref={fileInput}
        type="file"
        required
        accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        disabled={busy}
        className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-foreground/10 file:px-3 file:py-1.5 file:text-sm"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-foreground/60">
          Titre
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
            placeholder="Vitrine de Noël"
            className="rounded-md border border-foreground/15 bg-transparent px-2 py-1.5 text-sm text-foreground outline-none focus-visible:border-foreground/40"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-foreground/60">
          Type de projet
          <select
            value={projectType}
            onChange={(e) => setProjectType(e.target.value)}
            disabled={busy}
            className="rounded-md border border-foreground/15 bg-transparent px-2 py-1.5 text-sm text-foreground outline-none focus-visible:border-foreground/40"
          >
            <option value="">—</option>
            <option value="popup">Pop-up</option>
            <option value="store">Magasin</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-foreground/60">
          Marque
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            disabled={busy}
            className="rounded-md border border-foreground/15 bg-transparent px-2 py-1.5 text-sm text-foreground outline-none focus-visible:border-foreground/40"
          >
            <option value="">Nouvelle marque…</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!brandId && (
        <input
          value={newBrand}
          onChange={(e) => setNewBrand(e.target.value)}
          disabled={busy}
          placeholder="Nom de la nouvelle marque"
          className="rounded-md border border-foreground/15 bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:border-foreground/40"
        />
      )}

      {error && (
        <p className="rounded-md border border-foreground/15 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {busy ? (
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full bg-foreground transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-foreground/60">
            {progress === 100 ? "Finalisation…" : `${progress} %`}
          </span>
        </div>
      ) : (
        <button
          type="submit"
          disabled={!file}
          className="flex items-center justify-center gap-2 self-start rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          <Upload className="h-4 w-4" aria-hidden />
          Envoyer
        </button>
      )}
    </form>
  );
}
