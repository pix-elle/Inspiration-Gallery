"use client";

import { OPEN_SUBSCRIBE_EVENT } from "./SubscribeButton";
import { ENVELOPE } from "./icons/social";

// Le même événement que le bouton déplié : SubscribeModal l'écoute déjà, donc
// la version repliée n'a aucune logique à elle. Ce qu'elle perd, c'est le
// titre et le texte d'accroche — c'est un arbitrage de conversion, pas
// seulement d'affichage, et c'est pourquoi la barre reste dépliée par défaut
// au-dessus de 1280px.
export function RailSubscribeButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_SUBSCRIBE_EVENT))}
      aria-label={label}
      data-tip={label}
      className="rail-tip flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-80"
    >
      <span className="h-4 w-4">{ENVELOPE}</span>
    </button>
  );
}
