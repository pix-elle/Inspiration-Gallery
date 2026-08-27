"use client";

import { TransitionLink } from "@/components/atoms/TransitionLink";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavLinkProps = {
  href: string;
  label: string;
  icon?: ReactNode;
  /** Rail replié : l'icône seule, le libellé passe en infobulle. */
  mini?: boolean;
};

export function NavLink({ href, label, icon, mini = false }: NavLinkProps) {
  const pathname = usePathname();
  // Opening a tile pushes /item/<id> so the view can be shared, but the
  // lightbox is an overlay on the gallery — the visitor never left it. Without
  // this, the tab underneath goes dark while its own page is still on screen.
  const isActive =
    pathname === href || (href === "/" && pathname.startsWith("/item/"));

  return (
    <TransitionLink
      href={href}
      aria-current={isActive ? "page" : undefined}
      aria-label={mini ? label : undefined}
      data-tip={mini ? label : undefined}
      className={`flex items-center rounded-md transition-colors ${
        mini
          ? "rail-tip h-9 w-9 justify-center"
          : "gap-3 px-2 py-1.5 text-sm"
      } ${
        isActive
          ? "bg-foreground/10 font-medium"
          : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
      }`}
    >
      {icon && <span className="h-4 w-4 shrink-0">{icon}</span>}
      {!mini && label}
    </TransitionLink>
  );
}
