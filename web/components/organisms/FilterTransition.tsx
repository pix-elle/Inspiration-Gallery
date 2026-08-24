"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

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
  const [dimmed, setDimmed] = useState(false);
  // Le premier rendu est celui du serveur : il arrive déjà à sa place et ne
  // doit pas s'animer, sinon la page d'accueil démarre à opacité zéro.
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
  }, []);

  // Le voile n'apparaît qu'au-delà de ~120 ms. En dessous, la réponse est déjà
  // là et un fondu qui s'allume puis s'éteint aussitôt se lit comme un
  // clignotement — plus gênant que le remplacement qu'il devait couvrir.
  useEffect(() => {
    if (!pending) {
      setDimmed(false);
      return;
    }
    const timer = setTimeout(() => setDimmed(true), 120);
    return () => clearTimeout(timer);
  }, [pending]);

  return (
    <div
      className="filter-veil"
      data-pending={dimmed || undefined}
      aria-busy={pending || undefined}
    >
      {/* La clé remonte le sous-arbre à chaque changement de filtre, ce qui
          redéclenche l'animation CSS : sans elle, le nouveau jeu de résultats
          se substituerait à l'ancien sans transition. */}
      <div key={token} className={mounted.current ? "filter-enter" : undefined}>
        {children}
      </div>
    </div>
  );
}
