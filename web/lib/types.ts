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
  brand_id: string | null;
  source_key: string | null; // the untouched original kept on R2
  updated_at: string;
};

// processing → the Actions runner is encoding it; failed carries `error`.
// unpublished is a reversible hide, distinct from deleting the row.
export type ItemStatus = "processing" | "published" | "unpublished" | "failed";

export type ProjectType = "popup" | "store";

export type Brand = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

export type ItemsPage = {
  items: Item[];
  nextCursor: string | null;
};
