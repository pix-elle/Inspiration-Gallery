import { Logo } from "@/components/atoms/Logo";
import { SubscribeButton } from "@/components/atoms/SubscribeButton";
import { SidebarNav } from "@/components/molecules/SidebarNav";
import { ThemeToggle } from "@/components/atoms/ThemeToggle";
import { siteConfig } from "@/site.config";

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-56 flex-col gap-6 border-r border-foreground/10 p-4 pb-8 md:flex">
      <Logo />
      <SidebarNav />
      <div className="mt-auto flex flex-col gap-5">
        <div className="flex flex-col gap-1 px-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-4 w-4 shrink-0"
            >
              <rect x="1.75" y="3.25" width="12.5" height="9.5" rx="1.5" />
              <path d="m2.5 4.5 5.5 4.25L13.5 4.5" />
            </svg>
            La newsletter
          </h2>
          <p className="text-xs leading-relaxed text-foreground/60">
            L&apos;inspiration vidéo SaaS qui performe, chaque semaine
            directement dans votre inbox.
          </p>
        </div>
        <SubscribeButton
          label="Recevoir la newsletter"
          className="w-full px-3 py-2"
        />
        <hr className="border-foreground/10" />
        <div className="flex items-center gap-4 px-2">
          {siteConfig.socials.instagram && (
            <a
              href={siteConfig.socials.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="text-foreground/60 transition-colors hover:text-foreground"
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-4 w-4"
              >
                <rect x="1.75" y="1.75" width="12.5" height="12.5" rx="3.5" />
                <circle cx="8" cy="8" r="2.9" />
                <circle cx="11.7" cy="4.3" r="0.4" fill="currentColor" stroke="none" />
              </svg>
            </a>
          )}
          {siteConfig.socials.twitter && (
            <a
              href={siteConfig.socials.twitter}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X (Twitter)"
              className="text-foreground/60 transition-colors hover:text-foreground"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
              </svg>
            </a>
          )}
        </div>
        <div className="flex items-center px-2">
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
