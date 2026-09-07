import type { Industry, ProjectType } from "./taxonomy";

export type Item = {
  id: string;
  type: "image" | "video";
  title: string | null;
  description: string | null;
  tags: string[];
  category: string | null;
  source_url: string | null;
  creator: string | null;
  width: number;
  height: number;
  dominant_color: string | null;
  blur_data_url: string | null;
  poster_url: string | null;
  image_base: string | null;
  video_url: string | null;
  video_av1_url: string | null;
  created_at: string;

  // Admin-side columns. The public gallery only ever sees status
  // "published", but the type is shared with the back-office.
  status: ItemStatus;
  error: string | null;
  project_type: ProjectType | null;
  // Dérogation : l'industrie vient normalement de la marque. Renseignée ici,
  // elle l'emporte — c'est le coalesce(i.industry, b.industry) des requêtes.
  industry: Industry | null;
  brand_id: string | null;
  source_key: string | null; // the untouched original kept on R2
  updated_at: string;

  // Where it was shot, read from the file's own metadata at import time.
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  country: string | null;
};

// What the gallery can be narrowed by. All optional, all combinable, all
// carried in the URL so a filtered view can be shared.
export type GalleryFilters = {
  type?: "image" | "video" | null;
  tag?: string | null;
  projectType?: ProjectType | null;
  industry?: Industry | null;
  brand?: string | null; // slug
  city?: string | null;
};

export type FilterOptions = {
  brands: { slug: string; name: string; count: number }[];
  cities: { city: string; count: number }[];
  projectTypes: { value: ProjectType; count: number }[];
  industries: { value: Industry; count: number }[];
  types: { value: "image" | "video"; count: number }[];
};

// processing → the Actions runner is encoding it; failed carries `error`.
// unpublished is a reversible hide, distinct from deleting the row.
export type ItemStatus = "processing" | "published" | "unpublished" | "failed";

// Le vocabulaire vit dans lib/taxonomy.ts, avec ses libellés. Réexporté ici
// pour que les fichiers qui importaient déjà ProjectType depuis "@/lib/types"
// n'aient rien à changer.
export type { ProjectType, Industry } from "./taxonomy";

export type Brand = {
  id: string;
  name: string;
  slug: string;
  // Le secteur de la marque, dont ses items héritent.
  industry: Industry | null;
  created_at: string;
};

export type ItemsPage = {
  items: Item[];
  nextCursor: string | null;
};
