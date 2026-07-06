import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getItem } from "@/lib/queries";
import { Tag } from "@/components/atoms/Tag";

type Props = { params: Promise<{ id: string }> };

// Largest variant the ingest CLI actually generated (it never upscales;
// if no standard width fits, it emitted one at the original width).
const VARIANT_WIDTHS = [2000, 1200, 800, 400];
function bestWidth(itemWidth: number): number {
  return VARIANT_WIDTHS.find((w) => w <= itemWidth) ?? itemWidth;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) return {};
  const ogImage =
    item.poster_url ?? (item.image_base ? `${item.image_base}/1200.webp` : null);
  return {
    title: item.title ?? "Inspiration",
    description: item.description ?? undefined,
    openGraph: ogImage ? { images: [ogImage] } : undefined,
  };
}

export default async function ItemPage({ params }: Props) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/"
        className="mb-4 inline-block text-sm text-foreground/60 hover:text-foreground"
      >
        ← Back to gallery
      </Link>

      <div
        className="overflow-hidden rounded-xl"
        style={{
          aspectRatio: item.width / item.height,
          backgroundColor: item.dominant_color ?? "#1a1a1a",
        }}
      >
        {item.type === "video" ? (
          <video
            src={item.video_url!}
            poster={item.poster_url ?? undefined}
            controls
            autoPlay
            muted
            loop
            playsInline
            className="h-full w-full object-cover"
          />
        ) : (
          item.image_base && (
            <picture>
              <source
                type="image/avif"
                srcSet={`${item.image_base}/${bestWidth(item.width)}.avif`}
              />
              <img
                src={`${item.image_base}/${bestWidth(item.width)}.webp`}
                alt={item.title ?? ""}
                className="h-full w-full object-cover"
              />
            </picture>
          )
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {item.title && <h1 className="text-lg font-semibold">{item.title}</h1>}
        {item.description && (
          <p className="text-sm text-foreground/70">{item.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 text-sm text-foreground/60">
          {item.creator && <span>by {item.creator}</span>}
          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Source ↗
            </a>
          )}
        </div>
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((t) => (
              <Tag key={t} label={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
