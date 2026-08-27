import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { siteConfig } from "@/site.config";
import { getSettings } from "@/lib/settings";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

// The description is editable from /admin, so the metadata is generated per
// request rather than being a static object.
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    // Next fabrique les URL de partage à partir de cette base. Sans elle il
    // retombe sur localhost en développement et sur l'URL .vercel.app en
    // production, ce qui donne des aperçus pointant à côté du site.
    metadataBase: new URL(siteConfig.url),
    title: {
      default: siteConfig.name,
      template: `%s · ${siteConfig.name}`,
    },
    description: settings.siteDescription,
    openGraph: { siteName: siteConfig.name, type: "website" },
  };
}

// Runs before the first paint, so a dark-mode visitor never sees a white
// flash. It has to be inline and synchronous — a React effect runs after the
// browser has already painted. Kept deliberately tiny, and wrapped in
// try/catch because localStorage throws outright in some privacy modes.
const applyStoredTheme = `try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

// Même raison que le thème, et même urgence : la largeur de la barre latérale
// commande la mise en page de toute la grille. Appliquée après l'hydratation,
// la galerie entière sauterait à chaque chargement.
//
// Repliée par défaut, quelle que soit la taille de l'écran : la galerie est ce
// qu'on vient voir, la barre ne doit pas lui prendre 224px avant qu'on ait rien
// demandé. Seul un « full » explicitement mémorisé la déplie.
const applySidebarState = `try{var s=localStorage.getItem("sidebar");document.documentElement.dataset.sidebar=s==="full"?"full":"mini"}catch(e){document.documentElement.dataset.sidebar="mini"}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
      // The script above sets data-theme before React hydrates, so the server
      // HTML and the client tree legitimately differ on this attribute.
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: applyStoredTheme + applySidebarState,
          }}
        />
      </head>
      {/* Deliberately bare: each route group brings its own chrome. The
          public gallery gets the sidebar via app/(site)/layout.tsx; /admin
          and /login are standalone screens. */}
      <body className="min-h-full">{children}</body>
    </html>
  );
}
