"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// La barre de filtres et la grille sont deux sous-arbres frères, et la grille
// est rendue sur le serveur : elle ne peut pas lire le `isPending` du
// useTransition qui vit dans FilterBar. Ce contexte ne fait passer que le seul
// bit qui les relie — « une navigation de filtre est en vol ». La grille reste
// un `children` déjà rendu par le serveur : seul le voile qui l'enveloppe se
// re-rend quand ce bit change.

const PendingContext = createContext(false);
const ReportContext = createContext<(pending: boolean) => void>(() => {});

export function FilterTransition({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState(false);
  return (
    <ReportContext.Provider value={setPending}>
      <PendingContext.Provider value={pending}>
        {children}
      </PendingContext.Provider>
    </ReportContext.Provider>
  );
}

/** Appelé par FilterBar pour publier son `isPending` vers la grille. */
export function useReportFilterPending() {
  return useContext(ReportContext);
}

type FilteredGridProps = {
  /** Change à chaque jeu de filtres : rejoue l'animation d'entrée. */
  token: string;
  children: ReactNode;
};

export function FilteredGrid({ token, children }: FilteredGridProps) {
  const pending = useContext(PendingContext);

  // Motif React d'ajustement d'état sur changement de prop : on compare au
  // rendu précédent plutôt que de consulter une ref, qu'il est interdit de
  // lire pendant le rendu. Le premier rendu vient du serveur — il est déjà à
  // sa place et ne doit pas s'animer, sinon l'accueil démarre à opacité zéro.
  const [seen, setSeen] = useState(token);
  const [animate, setAnimate] = useState(false);
  if (token !== seen) {
    setSeen(token);
    setAnimate(true);
  }

  // Le seuil des 120 ms est passé au CSS (transition-delay) : il n'y a plus
  // d'état ni de minuterie à tenir, donc plus de setState dans un effet.
  return (
    <div
      className="filter-veil"
      data-pending={pending || undefined}
      aria-busy={pending || undefined}
    >
      {/* La clé remonte le sous-arbre à chaque changement de filtre, ce qui
          redéclenche l'animation CSS : sans elle, le nouveau jeu de résultats
          se substituerait à l'ancien sans transition. */}
      <div key={token} className={animate ? "filter-enter" : undefined}>
        {children}
      </div>
    </div>
  );
}
