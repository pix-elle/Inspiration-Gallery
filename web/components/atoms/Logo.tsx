import Link from "next/link";
import { siteConfig } from "@/site.config";

export function Logo() {
  const { logoImage, logoIsWordmark, name } = siteConfig;
  // Un wordmark porte déjà le nom du site : on l'affiche seul, à sa
  // largeur naturelle, et on masque le libellé qui ferait doublon.
  const wordmark = Boolean(logoImage) && logoIsWordmark;

  return (
    <Link href="/" className="flex items-center gap-2 px-2 py-1">
      {logoImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoImage}
          alt={wordmark ? name : ""}
          className={
            wordmark
              ? "h-7 w-auto max-w-full object-contain object-left"
              : "h-7 w-7 rounded-md object-contain"
          }
        />
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background text-sm font-bold">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      {!wordmark && (
        <span className="text-sm font-semibold tracking-tight">{name}</span>
      )}
    </Link>
  );
}
