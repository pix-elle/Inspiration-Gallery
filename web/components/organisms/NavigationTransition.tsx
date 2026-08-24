"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { PageSkeleton } from "@/components/molecules/PageSkeleton";

// Durée plancher du squelette au changement de page.
//
// Elle ne s'AJOUTE pas au temps serveur, elle le recouvre : le compte démarre
// au clic, et le squelette disparaît quand les deux conditions sont réunies —
// le serveur a répondu ET le plancher est écoulé. Une page qui met 300 ms
// affiche donc 900 ms de squelette, pas 1200.
export const MIN_SKELETON_MS = 900;

const NavigateContext = createContext<((href: string) => void) | null>(null);
const PendingContext = createContext(false);

export function NavigationTransition({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [holding, setHolding] = useState(false);
  const startedAt = useRef(0);

  const navigate = useCallback(
    (href: string) => {
      startedAt.current = Date.now();
      setHolding(true);
      startTransition(() => router.push(href));
    },
    [router]
  );

  useEffect(() => {
    if (isPending || !holding) return;
    const left = MIN_SKELETON_MS - (Date.now() - startedAt.current);
    if (left <= 0) {
      setHolding(false);
      return;
    }
    const timer = setTimeout(() => setHolding(false), left);
    return () => clearTimeout(timer);
  }, [isPending, holding]);

  return (
    <NavigateContext.Provider value={navigate}>
      <PendingContext.Provider value={holding || isPending}>
        {children}
      </PendingContext.Provider>
    </NavigateContext.Provider>
  );
}

/** null hors du provider — TransitionLink retombe alors sur un lien normal. */
export function useNavigate() {
  return useContext(NavigateContext);
}

// Enveloppe le contenu de page, pas la sidebar : le cadre reste à l'écran
// pendant que seule la zone qui change est remplacée.
export function PageFrame({ children }: { children: ReactNode }) {
  const pending = useContext(PendingContext);
  return pending ? <PageSkeleton /> : <>{children}</>;
}
