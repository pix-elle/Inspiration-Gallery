// Le vocabulaire de classement de la galerie. Deux axes indépendants : le
// format du projet, et le secteur de la marque.
//
// Volontairement SANS "server-only" : les menus du back-office, la barre de
// filtres publique et les routes d'API lisent tous ces mêmes tableaux.
// Avant ce fichier, le couple popup|store était réécrit à onze endroits —
// ajouter une valeur demandait onze modifications, et deux listes qui
// divergent donnent le pire des cas : une valeur proposée à l'écran que le
// serveur refuse ensuite.
//
// Deux copies subsistent, et ce sont des garde-fous, pas des listes de
// travail : les contraintes CHECK de db/schema.sql, et le tableau de valeurs
// nues de ingest/worker/import-folder.js — un projet Node distinct, en JS,
// qui ne peut pas importer ce fichier. Toutes deux échouent bruyamment si
// elles divergent, dès la première ligne écrite. Ajouter une valeur ici,
// c'est donc les éditer aussi, dans le même commit.
//
// L'ordre des tableaux est l'ordre d'affichage des menus, partout.

type Option<T extends string> = { value: T; label: string };

// Le format. Porté par l'item : une même marque a une boutique *et* un
// pop-up, et c'est très exactement ce qu'on veut pouvoir comparer.
export const PROJECT_TYPES = [
  { value: "store", label: "Boutique" },
  { value: "popup", label: "Pop-up" },
  { value: "shop_in_shop", label: "Shop-in-shop" },
  { value: "window", label: "Vitrine & VM" },
  { value: "exhibition", label: "Salon & exposition" },
  { value: "roadshow", label: "Roadshow" },
  { value: "event", label: "Événementiel" },
] as const satisfies readonly Option<string>[];

export type ProjectType = (typeof PROJECT_TYPES)[number]["value"];

// Le secteur. Porté par la MARQUE, pas par l'item : Tissot est en
// horlogerie sur toutes ses photos, toujours. Le stocker sur l'item
// ouvrirait la porte à la même marque classée en horlogerie sur douze
// photos et en mode sur trois. items.industry existe quand même, comme
// dérogation — une collaboration, un item sans marque — et c'est le
// coalesce(item, marque) des requêtes qui tranche.
//
// Un café ou un restaurant n'a pas de format à lui : c'est une "Boutique"
// dont le secteur est "Restauration". C'est l'intérêt d'avoir deux axes
// plutôt qu'une seule liste qui mélangerait les deux.
export const INDUSTRIES = [
  { value: "fashion", label: "Mode & prêt-à-porter" },
  { value: "sport", label: "Sport & outdoor" },
  { value: "watches", label: "Horlogerie & joaillerie" },
  { value: "accessories", label: "Accessoires & optique" },
  { value: "beauty", label: "Beauté & parfum" },
  { value: "food", label: "Restauration & café" },
  { value: "tech", label: "Tech & électronique" },
  { value: "toys", label: "Jouets & collectibles" },
  { value: "home", label: "Maison & décoration" },
  { value: "department_store", label: "Grand magasin & multimarque" },
  { value: "culture", label: "Culture & institution" },
] as const satisfies readonly Option<string>[];

export type Industry = (typeof INDUSTRIES)[number]["value"];

// Pour peindre un libellé quand on n'a que la valeur — une pilule de filtre,
// une cellule de tableau. Un Record large et non un Record<ProjectType,…> :
// la base peut contenir une valeur retirée du vocabulaire depuis, et une
// cellule vide vaut mieux qu'un plantage.
export const PROJECT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PROJECT_TYPES.map((o) => [o.value, o.label])
);
export const INDUSTRY_LABELS: Record<string, string> = Object.fromEntries(
  INDUSTRIES.map((o) => [o.value, o.label])
);

// Le point de validation unique. Les routes d'API, les pages qui lisent
// l'URL et le CLI passent par là : une valeur inconnue devient null, jamais
// une erreur — un lien partagé avec ?projet=nimportequoi doit afficher la
// galerie entière, pas une page cassée.
export function asProjectType(value: unknown): ProjectType | null {
  const v = String(value ?? "");
  return PROJECT_TYPES.some((o) => o.value === v) ? (v as ProjectType) : null;
}

export function asIndustry(value: unknown): Industry | null {
  const v = String(value ?? "");
  return INDUSTRIES.some((o) => o.value === v) ? (v as Industry) : null;
}
