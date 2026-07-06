import type { Metadata } from "next";
import { GalleryFeed } from "@/components/organisms/GalleryFeed";

export const revalidate = 300;

export const metadata: Metadata = { title: "Videos" };

export default function VideosPage() {
  return <GalleryFeed type="video" />;
}
