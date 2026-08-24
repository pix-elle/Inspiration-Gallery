"use client";

import { TransitionLink } from "@/components/atoms/TransitionLink";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavLinkProps = {
  href: string;
  label: string;
  icon?: ReactNode;
};

export function NavLink({ href, label, icon }: NavLinkProps) {
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
      className={`flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors ${
        isActive
          ? "bg-foreground/10 font-medium"
          : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
      }`}
    >
      {icon && <span className="h-4 w-4 shrink-0">{icon}</span>}
      {label}
    </TransitionLink>
  );
}
