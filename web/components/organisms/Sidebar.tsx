import { Logo } from "@/components/atoms/Logo";
import { SidebarNav } from "@/components/molecules/SidebarNav";

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-56 flex-col gap-6 border-r border-foreground/10 p-4 md:flex">
      <Logo />
      <SidebarNav />
      <p className="mt-auto px-2 text-xs text-foreground/60">
        Curated design inspiration
      </p>
    </aside>
  );
}
