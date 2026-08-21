import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { siteConfig } from "@/site.config";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  openGraph: {
    siteName: siteConfig.name,
    type: "website",
  },
};

// Runs before the first paint, so a dark-mode visitor never sees a white
// flash. It has to be inline and synchronous — a React effect runs after the
// browser has already painted. Kept deliberately tiny, and wrapped in
// try/catch because localStorage throws outright in some privacy modes.
const applyStoredTheme = `try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

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
        <script dangerouslySetInnerHTML={{ __html: applyStoredTheme }} />
      </head>
      {/* Deliberately bare: each route group brings its own chrome. The
          public gallery gets the sidebar via app/(site)/layout.tsx; /admin
          and /login are standalone screens. */}
      <body className="min-h-full">{children}</body>
    </html>
  );
}
