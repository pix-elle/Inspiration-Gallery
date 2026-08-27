"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

const KEY = "sidebar";

// Aucun état React : l'attribut sur <html> est déjà posé avant le premier
// rendu par le script inline du layout, et c'est le CSS qui en tire la
// largeur. Un état ici rendrait le mauvais pictogramme au premier paint,
// exactement comme le sélecteur de thème l'évite.
export function SidebarToggle() {
  function toggle() {
    const next =
      document.documentElement.dataset.sidebar === "mini" ? "full" : "mini";
    document.documentElement.dataset.sidebar = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Le choix s'applique à cette page, il ne sera juste pas retenu.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Replier ou déplier la barre latérale"
      className="rail-tip flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40"
      data-tip="Déplier"
    >
      {/* Les deux pictogrammes sont rendus, le CSS montre celui qui convient —
          même raison que pour la largeur. */}
      <PanelLeftClose className="sidebar-full h-4 w-4" aria-hidden />
      <PanelLeftOpen className="sidebar-mini h-4 w-4" aria-hidden />
    </button>
  );
}
