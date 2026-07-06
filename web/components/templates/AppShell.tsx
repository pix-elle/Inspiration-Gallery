import type { ReactNode } from "react";
import { Logo } from "@/components/atoms/Logo";
import { Sidebar } from "@/components/organisms/Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      {/* Desktop: fixed left sidebar */}
      <Sidebar />
      {/* Mobile: slim top bar instead of the sidebar */}
      <header className="sticky top-0 z-10 flex items-center border-b border-foreground/10 bg-background/80 p-3 backdrop-blur md:hidden">
        <Logo />
      </header>
      <main className="p-4 md:ml-56 md:p-6">{children}</main>
    </div>
  );
}
