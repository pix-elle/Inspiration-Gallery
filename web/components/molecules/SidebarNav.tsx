import { NavLink } from "@/components/atoms/NavLink";
import { siteConfig } from "@/site.config";
import { ICONS } from "@/components/atoms/icons/nav";

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
