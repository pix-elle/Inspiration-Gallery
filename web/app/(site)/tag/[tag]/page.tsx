import type { Metadata } from "next";
import { TransitionLink } from "@/components/atoms/TransitionLink";
import { GalleryFeed } from "@/components/organisms/GalleryFeed";

export const revalidate = 300;

type Props = { params: Promise<{ tag: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  return { title: `#${decodeURIComponent(tag)}` };
}

export default async function TagPage({ params }: Props) {
  const { tag: raw } = await params;
  const tag = decodeURIComponent(raw);

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-lg font-semibold">#{tag}</h1>
        <TransitionLink
          href="/"
          className="text-sm text-foreground/60 hover:text-foreground"
        >
          Clear ×
        </TransitionLink>
      </div>
      <GalleryFeed filters={{ tag }} showFilters={false} />
    </div>
  );
}
