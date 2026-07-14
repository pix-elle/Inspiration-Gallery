import type { ReactNode } from "react";
import { NavLink } from "@/components/atoms/NavLink";
import { siteConfig, type NavIconName } from "@/site.config";

const ICONS: Record<NavIconName, ReactNode> = {
  discover: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6.25" />
      <path d="M10.5 5.5 9 9l-3.5 1.5L7 7l3.5-1.5Z" />
    </svg>
  ),
  images: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2.25" y="2.75" width="11.5" height="10.5" rx="1.5" />
      <circle cx="5.75" cy="6.25" r="1" fill="currentColor" stroke="none" />
      <path d="m2.5 11 3-3 2.5 2.5 2-2 3.5 3.5" />
    </svg>
  ),
  videos: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2.25" y="3.25" width="11.5" height="9.5" rx="1.5" />
      <path d="M6.75 6v4l3.5-2-3.5-2Z" fill="currentColor" stroke="none" />
    </svg>
  ),
  saved: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4.25 2.75h7.5v10.5L8 10.5l-3.75 2.75V2.75Z" />
    </svg>
  ),
  about: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 7.25v3.5" />
      <circle cx="8" cy="5.25" r="0.25" fill="currentColor" />
    </svg>
  ),
};

export function SidebarNav() {
  return (
    <nav className="flex flex-col gap-0.5">
      {siteConfig.nav.map((link) => (
        <NavLink
          key={link.href}
          href={link.href}
          label={link.label}
          icon={ICONS[link.icon]}
        />
      ))}
    </nav>
  );
}
