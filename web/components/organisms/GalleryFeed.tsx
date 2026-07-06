import { Gallery } from "@/components/organisms/Gallery";
import { getItems } from "@/lib/queries";

type GalleryFeedProps = {
  type?: "image" | "video";
  tag?: string;
};

// Server component shared by /, /images, /videos and /tag/[tag].
// Fetches the first page; Gallery handles pagination with the same filter.
export async function GalleryFeed({ type, tag }: GalleryFeedProps) {
  const { items, nextCursor } = await getItems({ limit: 12, type, tag });

  return (
    <Gallery
      initialItems={items}
      initialCursor={nextCursor}
      type={type}
      tag={tag}
    />
  );
}
