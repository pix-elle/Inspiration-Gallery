"use client";

import { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Images, Type } from "lucide-react";

const TABS = [
  { id: "medias", label: "Médias", icon: Images },
  { id: "textes", label: "Textes", icon: Type },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AdminTabs({ medias, textes }: { medias: ReactNode; textes: ReactNode }) {
  const params = useSearchParams();
  const [active, setActive] = useState<TabId>(
    params.get("onglet") === "textes" ? "textes" : "medias"
  );

  function select(id: TabId) {
    setActive(id);
    // history.replaceState plutôt qu'un router.push : /admin est en
    // force-dynamic, donc une navigation Next relancerait la requête serveur
    // et rechargerait toute la table pour un simple changement d'onglet.
    // replaceState garde l'URL partageable sans rien recharger — et sans
    // empiler une entrée d'historique par clic d'onglet.
    const url = new URL(window.location.href);
    if (id === "medias") url.searchParams.delete("onglet");
    else url.searchParams.set("onglet", id);
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="Sections de l'administration"
        className="flex gap-1 border-b border-foreground/10"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const selected = active === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`onglet-${id}`}
              aria-selected={selected}
              aria-controls={`panneau-${id}`}
              onClick={() => select(id)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors ${
                selected
                  ? "border-foreground font-medium text-foreground"
                  : "border-transparent text-foreground/60 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          );
        })}
      </div>

      {/* Les deux panneaux restent MONTÉS, seulement masqués. SettingsForm
          garde ses champs en état local jusqu'au clic sur « Enregistrer » :
          le démonter effacerait silencieusement une modification en cours.
          Ça préserve aussi la sélection en lot et le sondage d'encodage de la
          table quand on passe d'un onglet à l'autre. */}
      {TABS.map(({ id }) => (
        <div
          key={id}
          role="tabpanel"
          id={`panneau-${id}`}
          aria-labelledby={`onglet-${id}`}
          hidden={active !== id}
          className={active === id ? undefined : "hidden"}
        >
          {id === "medias" ? medias : textes}
        </div>
      ))}
    </div>
  );
}
