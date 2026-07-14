import type { ReactNode } from "react";
import { Logo } from "@/components/atoms/Logo";
import { SubscribeButton } from "@/components/atoms/SubscribeButton";
import { Sidebar } from "@/components/organisms/Sidebar";
import { SubscribeModal } from "@/components/organisms/SubscribeModal";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      {/* Desktop: fixed left sidebar */}
      <Sidebar />
      {/* Mobile: slim top bar instead of the sidebar */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-foreground/10 bg-background/80 p-3 backdrop-blur md:hidden">
        <Logo />
        <SubscribeButton label="S'abonner" className="px-3 py-1.5" />
      </header>
      <main className="p-4 md:ml-56 md:p-6">{children}</main>
      <SubscribeModal />
    </div>
  );
}
