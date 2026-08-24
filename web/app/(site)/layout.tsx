import type { ReactNode } from "react";
import { AppShell } from "@/components/templates/AppShell";
import {
  NavigationTransition,
  PageFrame,
} from "@/components/organisms/NavigationTransition";

// The gallery chrome — sidebar, newsletter, subscribe modal — belongs to the
// public site only. Keeping it in the root layout put it around /admin and
// /login too, which is how Alessia ended up with a newsletter block next to
// her upload form.
export default function SiteLayout({ children }: { children: ReactNode }) {
  // Le provider enveloppe le shell entier : la sidebar en fait partie, et ses
  // liens doivent atteindre le contexte. PageFrame, lui, n'enveloppe que la
  // page — le cadre reste à l'écran pendant que le squelette occupe le centre.
  return (
    <NavigationTransition>
      <AppShell>
        <PageFrame>{children}</PageFrame>
      </AppShell>
    </NavigationTransition>
  );
}
