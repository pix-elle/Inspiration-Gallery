import { Logo } from "@/components/atoms/Logo";
import { SubscribeButton } from "@/components/atoms/SubscribeButton";
import { SidebarNav } from "@/components/molecules/SidebarNav";
import { ThemeToggle } from "@/components/atoms/ThemeToggle";
import { SidebarToggle } from "@/components/atoms/SidebarToggle";
import { RailSubscribeButton } from "@/components/atoms/RailSubscribeButton";
import { SOCIAL_ICONS, SOCIAL_LABELS, ENVELOPE } from "@/components/atoms/icons/social";
import { siteConfig } from "@/site.config";
import { EditableText } from "@/components/organisms/EditMode";
import type { Settings } from "@/lib/settings";

const SOCIALS = ["instagram", "linkedin", "twitter"] as const;

// Deux variantes rendues côté serveur, le CSS choisit laquelle s'affiche.
// Le serveur ne peut pas connaître l'état de la barre, et un rendu conditionnel
// en JavaScript ferait sauter la grille entière après l'hydratation.
export function Sidebar({ settings }: { settings: Settings }) {
  const socials = SOCIALS.filter((key) => siteConfig.socials[key]);

  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-[var(--sidebar-w)] flex-col gap-6 border-r border-foreground/10 p-4 pb-8 md:flex">
      <div className="sidebar-full flex flex-col gap-6">
        <Logo />
        <SidebarNav />
      </div>

      <div className="sidebar-mini flex-col items-center gap-4">
        <Logo mark />
        <SidebarNav mini />
      </div>

      <div className="mt-auto flex flex-col gap-5">
        {/* Déplié : le bloc de conversion complet, titre, texte et bouton. */}
        <div className="sidebar-full flex flex-col gap-5">
          <div className="flex flex-col gap-1 px-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <span className="h-4 w-4 shrink-0">{ENVELOPE}</span>
              <EditableText
                settingKey="sidebarNewsletterTitle"
                value={settings.sidebarNewsletterTitle}
              />
            </h2>
            <p className="text-xs leading-relaxed text-foreground/60">
              <EditableText
                settingKey="sidebarNewsletterText"
                value={settings.sidebarNewsletterText}
                multiline
                className="text-xs leading-relaxed"
              />
            </p>
          </div>
          <SubscribeButton
            label={settings.subscribeButtonLabel}
            className="w-full px-3 py-2"
          />
          <hr className="border-foreground/10" />
        </div>

        {/* Replié : une enveloppe qui ouvre le même modal, via le même
            événement — aucune logique dupliquée. */}
        <div className="sidebar-mini flex-col items-center gap-3">
          <RailSubscribeButton label={settings.subscribeButtonLabelShort} />
          <hr className="w-6 border-foreground/10" />
        </div>

        <div className="sidebar-full flex flex-row items-center gap-4 px-2">
          {socials.map((key) => (
            <a
              key={key}
              href={siteConfig.socials[key]!}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={SOCIAL_LABELS[key]}
              className="text-foreground/60 transition-colors hover:text-foreground"
            >
              {/* La taille vit sur un bloc, pas sur le <a> : une ancre est
                  inline, et h-4 w-4 n'y produirait rien. */}
              <span className="block h-4 w-4">{SOCIAL_ICONS[key]}</span>
            </a>
          ))}
        </div>

        <div className="sidebar-mini flex-col items-center gap-3">
          {socials.map((key) => (
            <a
              key={key}
              href={siteConfig.socials[key]!}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={SOCIAL_LABELS[key]}
              data-tip={SOCIAL_LABELS[key]}
              className="rail-tip flex h-8 w-8 items-center justify-center rounded-md text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              <span className="h-4 w-4">{SOCIAL_ICONS[key]}</span>
            </a>
          ))}
        </div>

        <hr className="sidebar-full border-foreground/10" />

        <div className="flex items-center justify-between gap-2 px-2 sidebar-full">
          <ThemeToggle />
          <SidebarToggle />
        </div>

        {/* Sépare les icônes de contenu — enveloppe, réseaux — des commandes
            de l'interface. Même trait court que celui posé sous l'enveloppe,
            pour que le rail garde un seul rythme. */}
        <div className="sidebar-mini flex-col items-center gap-3">
          <hr className="w-6 border-foreground/10" />
          <ThemeToggle />
          <SidebarToggle />
        </div>
      </div>
    </aside>
  );
}
