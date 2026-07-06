"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavLinkProps = {
  href: string;
  label: string;
  icon?: ReactNode;
};

export function NavLink({ href, label, icon }: NavLinkProps) {
  const pathname = usePathname();
  // Query-string links (e.g. /?type=video) are placeholders for now — never
  // marked active so they don't clash with "/".
  const isActive = !href.includes("?") && pathname === href;

  return (
    <Link
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
    </Link>
  );
}
