import type { ReactNode } from "react";
import { AppShell } from "@/components/templates/AppShell";

// The gallery chrome — sidebar, newsletter, subscribe modal — belongs to the
// public site only. Keeping it in the root layout put it around /admin and
// /login too, which is how Alessia ended up with a newsletter block next to
// her upload form.
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
