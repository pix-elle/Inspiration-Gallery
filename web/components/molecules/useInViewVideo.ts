"use client";

import { useEffect, useRef } from "react";

// Attach the source and play only while the tile is (nearly) on screen;
// pause when it scrolls away. Keeps bandwidth proportional to what's visible.
export function useInViewVideo(src: string) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!el.src) el.src = src;
          el.play().catch(() => {}); // autoplay can be blocked; poster remains
        } else {
          el.pause();
        }
      },
      // Half the tile must be on screen, and the margin only covers the
      // fold — at 200px/0.25 nine clips decoded at once mid-gallery, which
      // is the real cost on a laptop, not the scrolling itself.
      { rootMargin: "100px", threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [src]);

  return ref;
}
