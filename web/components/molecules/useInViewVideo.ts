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
      { rootMargin: "200px", threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [src]);

  return ref;
}
