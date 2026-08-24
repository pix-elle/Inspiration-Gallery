import type { Metadata } from "next";
import { TransitionLink } from "@/components/atoms/TransitionLink";
import { notFound } from "next/navigation";
import { getItem } from "@/lib/queries";
import { bestWidth } from "@/lib/media";
import { Tag } from "@/components/atoms/Tag";
import { siteConfig } from "@/site.config";

// ISR: pages are generated on demand, then cached — direct loads (shared
// links, social crawlers) stay fast without a DB round-trip per request.
export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) return {};
  const ogImage =
    item.poster_url ?? (item.image_base ? `${item.image_base}/1200.webp` : null);
  return {
    title: item.title ?? siteConfig.name,
    description: item.description ?? undefined,
    openGraph: ogImage ? { images: [ogImage] } : undefined,
  };
}

// Same visual treatment as the in-gallery lightbox (ItemModal): full-screen
// dark layer, centered media sized by aspect ratio, meta below, ✕ top-right.
// This page serves cold entries — shared links, new tabs, refresh, crawlers.
export default async function ItemPage({ params }: Props) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) notFound();

  const ar = item.width / item.height;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black">
      <TransitionLink
        href="/"
        aria-label="Back to gallery"
        className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
          <path d="M3.5 3.5l9 9m0-9l-9 9" />
        </svg>
      </TransitionLink>

      <div className="flex min-h-full flex-col items-center justify-center gap-3 p-4">
        <div
          className="overflow-hidden rounded-xl"
          style={{
            aspectRatio: ar,
            width: `min(92vw, calc(80vh * ${ar}))`,
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

        <div className="flex max-w-[92vw] flex-col items-center gap-1.5 text-center">
          {item.title && (
            <h1 className="text-sm font-semibold text-white">{item.title}</h1>
          )}
          {item.creator && (
            <p className="text-xs text-white/60">by {item.creator}</p>
          )}
          {item.description && (
            <p className="max-w-md text-xs text-white/60">{item.description}</p>
          )}
          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white/60 underline hover:text-white"
            >
              Source ↗
            </a>
          )}
          {item.tags.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {item.tags.map((t) => (
                <Tag key={t} label={t} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
