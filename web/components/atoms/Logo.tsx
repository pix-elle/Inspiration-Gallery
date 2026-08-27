import { TransitionLink } from "@/components/atoms/TransitionLink";
import { siteConfig } from "@/site.config";

// `mark` : le sigle seul, pour le rail replié. Les deux variantes sont
// toujours rendues côté sidebar et c'est le CSS qui choisit — le serveur ne
// peut pas savoir dans quel état la barre se trouvera.
export function Logo({ mark = false }: { mark?: boolean } = {}) {
  const { logoImage: fullLogo, logoMarkImage, logoIsWordmark: fullIsWordmark, name } = siteConfig;
  const logoImage = mark ? (logoMarkImage ?? fullLogo) : fullLogo;
  // Un sigle ne porte jamais le nom : il ne remplace donc pas le libellé.
  const logoIsWordmark = mark ? false : fullIsWordmark;
  // Un wordmark porte déjà le nom du site : on l'affiche seul, à sa
  // largeur naturelle, et on masque le libellé qui ferait doublon.
  const wordmark = Boolean(logoImage) && logoIsWordmark;

  return (
    <TransitionLink
      href="/"
      aria-label={name}
      className={mark ? "flex items-center justify-center py-1" : "flex items-center gap-2 px-2 py-1"}
    >
      {logoImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoImage}
          alt={wordmark ? name : ""}
          className={
            wordmark
              ? "h-7 w-auto max-w-full object-contain object-left"
              : mark
                ? "h-8 w-auto object-contain"
                : "h-7 w-7 rounded-md object-contain"
          }
        />
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background text-sm font-bold">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      {!wordmark && !mark && (
        <span className="text-sm font-semibold tracking-tight">{name}</span>
      )}
    </TransitionLink>
  );
}
