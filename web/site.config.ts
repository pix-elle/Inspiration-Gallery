// ============================================================
//  CONFIGURATION DU SITE — c'est le seul fichier à modifier !
// ============================================================
//
//  Comment ça marche :
//  - Change un texte entre guillemets, sauvegarde, et le site
//    se met à jour tout seul au prochain déploiement.
//  - Ne supprime pas les virgules ni les guillemets.
//
//  Pour changer le logo :
//  1. Dépose ton fichier .svg dans le dossier  web/public/
//     (par exemple  web/public/logo.svg)
//  2. Remplace  logoImage: null  par  logoImage: "/logo.svg"
//  3. Si le nom du site est déjà écrit DANS le logo, mets
//     logoIsWordmark: true  (sinon il s'afficherait en double)
//  4. Pour revenir à la lettre initiale, remets  logoImage: null
//
//  Pour les icônes des onglets, choisis parmi :
//  "discover" | "images" | "videos" | "saved" | "about"
// ============================================================

export const siteConfig = {
  // Nom du site — affiché dans le logo et l'onglet du navigateur
  name: "Nexus Studio",

  // Image du logo (fichier dans web/public/), ou null pour
  // afficher la première lettre du nom dans un carré
  logoImage: "/logo.svg" as string | null,

  // Le logo contient-il déjà le nom du site écrit dedans ?
  //  true  → on affiche le logo seul, en large (c'est le cas de
  //          logo.svg : le mot « Nexus Studio » est dessiné dedans)
  //  false → petit carré + le nom écrit à côté
  logoIsWordmark: true,

  // Description du site (Google, partages sur les réseaux…)
  description: "A curated gallery of design inspiration — images and videos.",

  // Réseaux sociaux (liens en bas de la sidebar).
  // Remplace par tes vrais comptes. Pour masquer une icône,
  // remplace son lien par null (ex.  instagram: null).
  socials: {
    instagram: "https://www.instagram.com/motioon.collective" as string | null,
    twitter: "https://x.com/motioon.collective" as string | null,
  },

  // Les onglets du menu, dans l'ordre d'affichage.
  // - label : le texte affiché (modifiable librement)
  // - href  : la page vers laquelle l'onglet pointe (ne pas changer)
  // - icon  : le nom de l'icône (voir la liste plus haut)
  // Pour masquer un onglet : ajoute // au début de sa ligne.
  // Pour le réafficher : enlève le //.
  nav: [
    { href: "/", label: "Découvrir", icon: "discover" },
    // { href: "/images", label: "Images", icon: "images" },
    // { href: "/videos", label: "Vidéos", icon: "videos" },
    // { href: "/saved", label: "Enregistrés", icon: "saved" },
    // { href: "/about", label: "À propos", icon: "about" },
  ],
} as const;

export type NavIconName = "discover" | "images" | "videos" | "saved" | "about";
