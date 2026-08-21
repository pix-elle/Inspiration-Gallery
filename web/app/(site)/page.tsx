import { GalleryFeed } from "@/components/organisms/GalleryFeed";

// Content only changes when new items are ingested — near-static, edge-cached.
export const revalidate = 300;

export default function HomePage() {
  return <GalleryFeed />;
}
