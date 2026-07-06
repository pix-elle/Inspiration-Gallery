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
};

export type ItemsPage = {
  items: Item[];
  nextCursor: string | null;
};
