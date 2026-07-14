"use client";

import { useEffect, useRef } from "react";
import type { Item } from "@/lib/types";
import { bestWidth } from "@/lib/media";
import { Tag } from "@/components/atoms/Tag";

type ItemModalProps = {
  item: Item;
  // `item-${id}` normally (pairs with the tile for the open/close morph);
  // "lb-media" during prev/next so consecutive medias pair with each other.
  mediaTransitionName: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
};

// Client-side lightbox rendered from data the gallery already holds — the
// open morph starts in the same frame as the click, no network involved.
// Prev/next: arrow buttons, ← → keys, and horizontal swipe on touch.
export function ItemModal({
  item,
  mediaTransitionName,
  onClose,
  onPrev,
  onNext,
}: ItemModalProps) {
  // Esc closes, arrows navigate; body scroll locked while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onPrev?.();
      else if (e.key === "ArrowRight") onNext?.();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, onPrev, onNext]);

  // Swipe: horizontal, ≥50px, and clearly more horizontal than vertical.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < 1.5 * Math.abs(dy)) return;
    if (dx < 0) onNext?.();
    else onPrev?.();
  };

  const ar = item.width / item.height;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
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

      {onPrev && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          aria-label="Previous item"
          className="absolute left-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white sm:flex"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
            <path d="M10 3.5 5.5 8l4.5 4.5" />
          </svg>
        </button>
      )}
      {onNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          aria-label="Next item"
          className="absolute right-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white sm:flex"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
            <path d="M6 3.5 10.5 8 6 12.5" />
          </svg>
        </button>
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        className="overflow-hidden rounded-xl"
        style={{
          aspectRatio: ar,
          width: `min(92vw, calc(80vh * ${ar}))`,
          backgroundColor: item.dominant_color ?? "#1a1a1a",
          viewTransitionName: mediaTransitionName,
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
