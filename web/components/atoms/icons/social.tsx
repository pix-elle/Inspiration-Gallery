import type { ReactNode } from "react";

// Sortis de Sidebar.tsx, où ils occupaient soixante lignes au milieu de la
// mise en page. Le rail replié les réutilise tels quels, et une page « à
// propos » ou un pied de page pourront en faire autant.
export const SOCIAL_ICONS: Record<"instagram" | "linkedin" | "twitter", ReactNode> = {
  instagram: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1.75" y="1.75" width="12.5" height="12.5" rx="3.5" />
      <circle cx="8" cy="8" r="2.9" />
      <circle cx="11.7" cy="4.3" r="0.4" fill="currentColor" stroke="none" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M13.6 0H2.4A2.4 2.4 0 0 0 0 2.4v11.2A2.4 2.4 0 0 0 2.4 16h11.2a2.4 2.4 0 0 0 2.4-2.4V2.4A2.4 2.4 0 0 0 13.6 0ZM5 13.4H2.9V6.2H5v7.2Zm-1-8.2a1.2 1.2 0 1 1 0-2.5 1.2 1.2 0 0 1 0 2.5Zm9.1 8.2H11V9.6c0-.9-.3-1.5-1.1-1.5-.6 0-1 .4-1.1 .8-.1.2-.1.4-.1.6v3.9H6.6V6.2h2.1v1a2.1 2.1 0 0 1 1.9-1c1.4 0 2.5.9 2.5 2.9v4.3Z" />
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  ),
};

export const SOCIAL_LABELS: Record<keyof typeof SOCIAL_ICONS, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  twitter: "X (Twitter)",
};

export const ENVELOPE = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1.75" y="3.25" width="12.5" height="9.5" rx="1.5" />
    <path d="m2.5 4.5 5.5 4.25L13.5 4.5" />
  </svg>
);
