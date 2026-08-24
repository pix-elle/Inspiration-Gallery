import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // La home lit searchParams, c'est donc une route dynamique — et par défaut
    // Next ne réutilise jamais le payload dynamique qu'il vient de précharger.
    // Sans cette ligne, le prefetch au survol des pilules travaillerait pour
    // rien. 30 s : assez pour couvrir un aller-retour entre deux filtres, assez
    // court pour qu'un ajout depuis /admin apparaisse presque tout de suite.
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
