"use client";

import { useEffect } from "react";
import type { Item } from "@/lib/types";
import { bestWidth } from "@/lib/media";
import { Tag } from "@/components/atoms/Tag";

type ItemModalProps = {
  item: Item;
  onClose: () => void;
};

// Client-side lightbox rendered from data the gallery already holds — the
// open morph starts in the same frame as the click, no network involved.
export function ItemModal({ item, onClose }: ItemModalProps) {
  // Esc closes; body scroll locked while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const ar = item.width / item.height;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={item.title ?? "Item"}
    >
      <button
        onClick={(e) => {
          // Without this the click bubbles to the backdrop's onClose too,
          // closing twice (= two history.back() → lands on a stale entry).
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close"
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
          <path d="M3.5 3.5l9 9m0-9l-9 9" />
        </svg>
      </button>

      <div
        onClick={(e) => e.stopPropagation()}
        className="overflow-hidden rounded-xl"
        style={{
          aspectRatio: ar,
          width: `min(92vw, calc(80vh * ${ar}))`,
          backgroundColor: item.dominant_color ?? "#1a1a1a",
          viewTransitionName: `item-${item.id}`,
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

      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-w-[92vw] flex-col items-center gap-1.5 text-center"
      >
        {item.title && (
          <h2 className="text-sm font-semibold text-white">{item.title}</h2>
        )}
        {item.creator && (
          <p className="text-xs text-white/60">by {item.creator}</p>
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
  );
}
