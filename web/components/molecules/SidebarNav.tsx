import { NavLink } from "@/components/atoms/NavLink";
import { siteConfig } from "@/site.config";
import { ICONS } from "@/components/atoms/icons/nav";

export function SidebarNav({ mini = false }: { mini?: boolean } = {}) {
  return (
    <nav
      className={mini ? "flex flex-col items-center gap-1" : "flex flex-col gap-0.5"}
    >
      {siteConfig.nav.map((link) => (
        <NavLink
          key={link.href}
          href={link.href}
          label={link.label}
          icon={ICONS[link.icon]}
          mini={mini}
        />
      ))}
    </nav>
  );
}
