import type { Metadata } from "next";
import { GalleryFeed } from "@/components/organisms/GalleryFeed";

export const revalidate = 300;

export const metadata: Metadata = { title: "Images" };

export default function ImagesPage() {
  return <GalleryFeed type="image" />;
}
