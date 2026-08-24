"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Loader2, Upload, UploadCloud, X } from "lucide-react";
import {
  ACCEPT_ATTRIBUTE,
  megabytes,
  rejectionReason,
} from "@/lib/media-limits";
import type { Brand } from "@/lib/types";

// Deux à trois envois de front. Vingt fichiers de 40 Mo lancés ensemble
// saturent le lien montant et font ramper chaque barre : à l'arrivée c'est
// plus lent, et surtout illisible.
const CONCURRENCY = 3;

// XHR et non fetch, pour une seule raison : il rapporte la progression, ce que
// fetch ne sait toujours pas faire. Sur un clip de 40 Mo en wifi d'hôtel, une
// barre qui bouge est la différence entre attendre et croire que ça a planté.
function putWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
  register: (xhr: XMLHttpRequest) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    register(xhr);
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
    xhr.onabort = () => reject(new Error("Envoi annulé"));
    xhr.send(file);
  });
}

type State = "pending" | "uploading" | "creating" | "done" | "error";
type Staged = {
  key: string;
  file: File;
  preview: string | null;
  state: State;
  progress: number;
  error?: string;
};
type Rejected = { name: string; reason: string };

// Pure : sert à la fois à calculer l'état initial (fichiers lâchés sur
// l'onglet) et à absorber les ajouts suivants. Les clés initiales sont
// préfixées "i" et les suivantes "f", donc elles ne peuvent pas se croiser
// sans avoir à faire vivre un compteur pendant le rendu.
function sort(files: File[], prefix: string) {
  const ok: Staged[] = [];
  const ko: Rejected[] = [];
  files.forEach((file, index) => {
    const reason = rejectionReason(file);
    if (reason) {
      ko.push({ name: file.name, reason });
      return;
    }
    ok.push({
      key: `${prefix}${index}`,
      file,
      // Aperçu seulement pour les images : décoder une vidéo pour une
      // vignette coûterait plus que ça ne rapporte ici. Le HEIC est exclu,
      // aucun navigateur ne le peint.
      preview:
        file.type.startsWith("image/") && !file.type.includes("hei")
          ? URL.createObjectURL(file)
          : null,
      state: "pending",
      progress: 0,
    });
  });
  return { ok, ko };
}

type Props = {
  brands: Brand[];
  initialFiles?: File[] | null;
  onClose: () => void;
  onDone: () => void;
};

export function UploadModal({ brands, initialFiles, onClose, onDone }: Props) {
  // Les fichiers lâchés sur l'onglet sont déjà là au premier rendu : les
  // pousser depuis un effet ferait un rendu vide puis un second, et c'est
  // exactement ce que react-hooks/set-state-in-effect interdit.
  const initial = useState(() => sort(initialFiles ?? [], "i"))[0];
  const [staged, setStaged] = useState<Staged[]>(initial.ok);
  const [rejected, setRejected] = useState<Rejected[]>(initial.ko);
  const [projectType, setProjectType] = useState("");
  const [brandId, setBrandId] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  // dragleave se déclenche aussi en passant sur un enfant. Sans ce compteur
  // d'entrées, la zone clignote dès qu'on survole la liste des fichiers.
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const inFlight = useRef(new Set<XMLHttpRequest>());

  const add = useCallback((files: File[]) => {
    const { ok, ko } = sort(files, `f${seq.current++}-`);
    setStaged((prev) => [...prev, ...ok]);
    setRejected((prev) => [...prev, ...ko]);
    setFinished(false);
  }, []);

  useEffect(() => {
    return () => {
      for (const s of staged) if (s.preview) URL.revokeObjectURL(s.preview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fermer pendant un envoi annule les XHR en vol : la touche Échap, le clic
  // extérieur et la fermeture d'onglet sont donc tous bloqués tant que ça
  // tourne.
  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !running) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [running, onClose]);

  const patch = (key: string, next: Partial<Staged>) =>
    setStaged((prev) => prev.map((s) => (s.key === key ? { ...s, ...next } : s)));

  async function uploadOne(item: Staged) {
    patch(item.key, { state: "uploading", progress: 0, error: undefined });

    const ask = await fetch("/api/admin/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: item.file.type, size: item.file.size }),
    });
    const presigned = await ask.json();
    if (!ask.ok) throw new Error(presigned.error ?? "Envoi refusé");

    await putWithProgress(
      presigned.url,
      item.file,
      (p) => patch(item.key, { progress: p }),
      (xhr) => inFlight.current.add(xhr)
    );

    patch(item.key, { state: "creating" });
    const create = await fetch("/api/admin/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: presigned.key,
        // Pas de titre : en demander un par fichier sur un lot de vingt n'a
        // pas de sens, et la table les édite en ligne juste après.
        projectType,
        brandId: brandId || undefined,
        brandName: brandId ? undefined : newBrand,
      }),
    });
    const created = await create.json();
    if (!create.ok) throw new Error(created.error ?? "Création refusée");

    patch(item.key, { state: "done", progress: 100 });
  }

  async function run() {
    const queue = staged.filter((s) => s.state === "pending" || s.state === "error");
    if (queue.length === 0) return;
    setRunning(true);
    setFinished(false);

    // Un échec marque sa ligne et laisse la file continuer : un fichier en
    // erreur ne doit pas emporter les dix-neuf autres.
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        try {
          await uploadOne(item);
        } catch (err) {
          patch(item.key, {
            state: "error",
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    });

    await Promise.all(workers);
    inFlight.current.clear();
    setRunning(false);
    setFinished(true);
    onDone();
  }

  const done = staged.filter((s) => s.state === "done").length;
  const failed = staged.filter((s) => s.state === "error").length;
  const waiting = staged.filter((s) => s.state === "pending" || s.state === "error").length;

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (!running) add([...e.dataTransfer.files]);
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={running ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Ajouter des médias"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-[min(94vw,640px)] flex-col gap-4 overflow-y-auto rounded-2xl border border-foreground/15 bg-background p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold">Ajouter des médias</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={running}
            aria-label="Fermer"
            className="rounded p-1.5 text-foreground/60 hover:bg-foreground/5 hover:text-foreground disabled:opacity-30"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div
          onDragEnter={(e) => {
            e.preventDefault();
            dragDepth.current += 1;
            setDragging(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => {
            dragDepth.current -= 1;
            if (dragDepth.current <= 0) setDragging(false);
          }}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
            dragging ? "border-foreground bg-foreground/5" : "border-foreground/20"
          }`}
        >
          <UploadCloud className="h-6 w-6 text-foreground/40" aria-hidden />
          <p className="text-sm">
            Glissez vos fichiers ici, ou{" "}
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={running}
              className="underline underline-offset-4 hover:text-foreground disabled:opacity-40"
            >
              parcourez
            </button>
          </p>
          <p className="text-xs text-foreground/50">
            Vidéos MP4, MOV, WebM · Images JPEG, PNG, WebP, HEIC · {megabytes(500 * 1000 * 1000)} Mo max par fichier
          </p>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ACCEPT_ATTRIBUTE}
            onChange={(e) => {
              add([...(e.target.files ?? [])]);
              e.target.value = "";
            }}
            className="hidden"
          />
        </div>

        {rejected.length > 0 && (
          <div className="flex flex-col gap-1 rounded-lg border border-foreground/15 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden />
              {rejected.length} fichier{rejected.length > 1 ? "s" : ""} écarté{rejected.length > 1 ? "s" : ""}
            </p>
            {rejected.map((r, i) => (
              <p key={i} className="truncate text-xs text-foreground/60">
                {r.name} — {r.reason}
              </p>
            ))}
            <button
              type="button"
              onClick={() => setRejected([])}
              className="self-start pt-1 text-xs text-foreground/50 underline underline-offset-2 hover:text-foreground"
            >
              Masquer
            </button>
          </div>
        )}

        {staged.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {staged.map((s) => (
              <li key={s.key} className="flex items-center gap-3 rounded-lg border border-foreground/10 p-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-foreground/5">
                  {s.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.preview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Upload className="h-4 w-4 text-foreground/30" aria-hidden />
                  )}
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-sm">{s.file.name}</span>
                  {s.state === "uploading" ? (
                    <span className="flex items-center gap-2">
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/10">
                        <span
                          className="block h-full bg-foreground transition-[width] duration-200"
                          style={{ width: `${s.progress}%` }}
                        />
                      </span>
                      <span className="text-xs tabular-nums text-foreground/60">{s.progress} %</span>
                    </span>
                  ) : (
                    <span className="text-xs text-foreground/50">
                      {s.state === "pending" && `${megabytes(s.file.size)} Mo — en attente`}
                      {s.state === "creating" && "Création…"}
                      {s.state === "done" && "Envoyé — encodage lancé"}
                      {s.state === "error" && s.error}
                    </span>
                  )}
                </span>

                {s.state === "done" && <Check className="h-4 w-4 shrink-0 text-foreground/60" aria-hidden />}
                {s.state === "error" && <AlertCircle className="h-4 w-4 shrink-0 text-foreground/60" aria-hidden />}
                {s.state === "creating" && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-foreground/60" aria-hidden />}
                {s.state === "pending" && !running && (
                  <button
                    type="button"
                    onClick={() => setStaged((prev) => prev.filter((x) => x.key !== s.key))}
                    aria-label={`Retirer ${s.file.name}`}
                    className="rounded p-1 text-foreground/40 hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Communes à tout le lot : c'est le même repérage, et demander un
            titre par fichier sur vingt fichiers serait intenable. */}
        {staged.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-foreground/60">
              Type de projet — pour tout le lot
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                disabled={running}
                className="rounded-md border border-foreground/15 bg-transparent px-2 py-1.5 text-sm text-foreground outline-none focus-visible:border-foreground/40"
              >
                <option value="">—</option>
                <option value="popup">Pop-up</option>
                <option value="store">Magasin</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs text-foreground/60">
              Marque — pour tout le lot
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                disabled={running}
                className="rounded-md border border-foreground/15 bg-transparent px-2 py-1.5 text-sm text-foreground outline-none focus-visible:border-foreground/40"
              >
                <option value="">Nouvelle marque…</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>

            {!brandId && (
              <input
                value={newBrand}
                onChange={(e) => setNewBrand(e.target.value)}
                disabled={running}
                placeholder="Nom de la nouvelle marque"
                className="rounded-md border border-foreground/15 bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:border-foreground/40 sm:col-span-2"
              />
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={running || waiting === 0}
            className="flex items-center gap-2 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-40"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="h-4 w-4" aria-hidden />
            )}
            {running
              ? "Envoi en cours…"
              : failed > 0 && done > 0
                ? `Relancer les ${failed} échec${failed > 1 ? "s" : ""}`
                : `Envoyer ${waiting || ""}`.trim()}
          </button>

          {finished && (
            <p className="text-sm text-foreground/70">
              {done} envoyé{done > 1 ? "s" : ""}
              {failed > 0 && `, ${failed} échec${failed > 1 ? "s" : ""}`}
              {failed === 0 && " — l'encodage se poursuit en arrière-plan."}
            </p>
          )}

          {!running && finished && failed === 0 && (
            <button
              type="button"
              onClick={onClose}
              className="ml-auto rounded-md border border-foreground/15 px-3 py-2 text-sm hover:border-foreground/40"
            >
              Fermer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
