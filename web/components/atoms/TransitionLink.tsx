"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { useNavigate } from "@/components/organisms/NavigationTransition";

type Props = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

// Un <Link> conservé pour ce qu'il apporte — préchargement au survol et dans
// le viewport, rendu <a> réel donc clic droit et référencement intacts — dont
// on n'intercepte que le clic gauche simple, pour faire passer la navigation
// par le squelette.
export function TransitionLink({ href, onClick, ...rest }: Props) {
  const navigate = useNavigate();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    // Cmd, Ctrl, Shift, Alt ou clic non primaire : le visiteur demande à
    // ouvrir ailleurs. L'intercepter lui volerait son nouvel onglet.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    if (!navigate) return;
    event.preventDefault();
    navigate(href);
  }

  return <Link href={href} onClick={handleClick} {...rest} />;
}
