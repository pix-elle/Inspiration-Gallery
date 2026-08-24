"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { Settings } from "@/lib/settings";
import type { Item } from "@/lib/types";
import { MediaPicker } from "./MediaPicker";

// Grouped the way someone thinks about the site, not the way the keys are
// stored: everything about the pop-up together, everything about the sidebar
// together. `long` gets a textarea because a one-line input hides half a
// paragraph and invites truncated copy.
const FIELDS: {
  group: string;
  items: { key: keyof Settings; label: string; hint?: string; long?: boolean }[];
}[] = [
  {
    group: "Pop-up newsletter",
    items: [
      {
        key: "newsletterPopupTitle",
        label: "Titre du pop-up",
        long: true,
      },
      {
        key: "newsletterPopupSuccess",
        label: "Message après inscription",
        long: true,
      },
      {
        key: "newsletterPopupDelaySeconds",
        label: "Délai avant affichage (secondes)",
        hint: "Le pop-up n'apparaît qu'une fois par visiteur.",
      },
    ],
  },
  {
    group: "Bloc newsletter de la barre latérale",
    items: [
      { key: "sidebarNewsletterTitle", label: "Titre" },
      { key: "sidebarNewsletterText", label: "Texte", long: true },
      { key: "subscribeButtonLabel", label: "Bouton (barre latérale)" },
      {
        key: "subscribeButtonLabelShort",
        label: "Bouton (mobile et pop-up)",
        hint: "Version courte, l'espace y est compté.",
      },
    ],
  },
  {
    group: "Référencement",
    items: [
      {
        key: "siteDescription",
        label: "Description du site",
        hint: "Affichée par Google et lors des partages sur les réseaux.",
        long: true,
      },
    ],
  },
];

export function SettingsForm({
  initial,
  items,
}: {
  initial: Settings;
  items: Item[];
}) {
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const popupOn = values.newsletterPopupEnabled === "true";

  async function save(next: Settings) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        throw new Error((await res.json()).error ?? "Enregistrement refusé");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  // Même raison que l'interrupteur : on clique une vignette, elle doit tenir.
  function pickMedia(itemId: string) {
    const next = { ...values, newsletterMediaItemId: itemId };
    setValues(next);
    save(next);
  }

  // The toggle saves itself: a switch that needs a second click on "save"
  // reads as broken.
  function togglePopup() {
    const next = {
      ...values,
      newsletterPopupEnabled: popupOn ? "false" : "true",
    };
    setValues(next);
    save(next);
  }

  return (
    <section className="flex flex-col gap-5 rounded-lg border border-foreground/15 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Textes du site</h2>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs text-foreground/60">
            <Check className="h-3.5 w-3.5" aria-hidden />
            Enregistré
          </span>
        )}
      </div>

      <div className="flex items-start justify-between gap-4 rounded-md bg-foreground/5 p-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Pop-up newsletter</span>
          <span className="text-xs text-foreground/60">
            {popupOn
              ? "Le pop-up s'ouvre automatiquement pour les nouveaux visiteurs."
              : "Désactivé. Le bouton « s'abonner » continue de fonctionner."}
          </span>
        </div>
        <button
          type="button"
          onClick={togglePopup}
          disabled={saving}
          role="switch"
          aria-checked={popupOn}
          aria-label="Activer le pop-up newsletter"
          className={`flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors disabled:opacity-50 ${
            popupOn ? "bg-foreground" : "bg-foreground/20"
          }`}
        >
          <span
            className={`h-4 w-4 rounded-full bg-background shadow-sm transition-transform ${
              popupOn ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <MediaPicker
        items={items}
        value={values.newsletterMediaItemId}
        onChange={pickMedia}
        disabled={saving}
      />

      {FIELDS.map((section) => (
        <div key={section.group} className="flex flex-col gap-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-foreground/40">
            {section.group}
          </h3>
          {section.items.map(({ key, label, hint, long }) => (
            <label key={key} className="flex flex-col gap-1 text-xs text-foreground/60">
              {label}
              {long ? (
                <textarea
                  rows={2}
                  value={values[key]}
                  onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                  className="resize-y rounded-md border border-foreground/15 bg-transparent px-2 py-1.5 text-sm text-foreground outline-none focus-visible:border-foreground/40"
                />
              ) : (
                <input
                  value={values[key]}
                  onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                  className="rounded-md border border-foreground/15 bg-transparent px-2 py-1.5 text-sm text-foreground outline-none focus-visible:border-foreground/40"
                />
              )}
              {hint && <span className="text-foreground/40">{hint}</span>}
            </label>
          ))}
        </div>
      ))}

      {error && (
        <p className="rounded-md border border-foreground/15 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => save(values)}
        disabled={saving}
        className="self-start rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {saving ? "Enregistrement…" : "Enregistrer les textes"}
      </button>
    </section>
  );
}
