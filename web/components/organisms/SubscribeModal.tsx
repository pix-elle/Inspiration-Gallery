"use client";

import { useEffect, useRef, useState } from "react";
import { OPEN_SUBSCRIBE_EVENT } from "@/components/atoms/SubscribeButton";
import type { Item } from "@/lib/types";

const SHOW_AFTER_MS = 8000;
const DISMISSED_KEY = "newsletter-dismissed";
const SUBSCRIBED_KEY = "newsletter-subscribed";

// Lead-capture modal: shows once per visitor after a short while on the
// site, teasing the weekly SaaS video inspiration newsletter. The teaser
// video is the freshest video item, fetched from the (edge-cached) API.
// Also opens on demand when a SubscribeButton fires OPEN_SUBSCRIBE_EVENT.
export function SubscribeModal() {
  const [video, setVideo] = useState<Item | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
    "idle"
  );
  // Where the modal was opened from — sent along with the email.
  const sourceRef = useRef<"modal" | "button">("modal");
  const videoRef = useRef<HTMLVideoElement>(null);

  const openWithVideo = async () => {
    try {
      const res = await fetch("/api/items?type=video");
      const page = await res.json();
      const item: Item | undefined = page.items?.[0];
      if (item?.video_url) setVideo(item);
    } catch {
      // opens even without a teaser video
    }
    setOpen(true);
  };

  // Trigger 1: once per visitor, after a bit of engagement.
  useEffect(() => {
    if (
      localStorage.getItem(DISMISSED_KEY) ||
      localStorage.getItem(SUBSCRIBED_KEY)
    ) {
      return;
    }
    const timer = setTimeout(openWithVideo, SHOW_AFTER_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trigger 2: explicit click on a SubscribeButton — always opens, even
  // if the auto-modal was dismissed or the visitor already subscribed.
  useEffect(() => {
    const onOpen = () => {
      sourceRef.current = "button";
      openWithVideo();
    };
    window.addEventListener(OPEN_SUBSCRIBE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SUBSCRIBE_EVENT, onOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setOpen(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: sourceRef.current }),
      });
      if (!res.ok) throw new Error();
      localStorage.setItem(SUBSCRIBED_KEY, "1");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label="S'abonner à la newsletter"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-[min(92vw,400px)] flex-col gap-5 rounded-2xl bg-white p-6 text-neutral-900 shadow-2xl"
      >
        {video && (
          <div
            className="overflow-hidden rounded-lg"
            style={{
              aspectRatio: video.width / video.height,
              backgroundColor: video.dominant_color ?? "#1a1a1a",
            }}
          >
            <video
              ref={videoRef}
              src={video.video_url!}
              poster={video.poster_url ?? undefined}
              autoPlay
              muted
              loop
              playsInline
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <h2 className="text-center text-lg font-semibold leading-snug">
          L&apos;inspiration vidéo SaaS qui performe, chaque semaine dans votre
          inbox
        </h2>

        {status === "done" ? (
          <p className="pb-1 text-center text-sm text-neutral-600">
            C&apos;est noté — premier envoi la semaine prochaine ✦
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-2">
            {/* One shared underline spanning the field AND the button */}
            <div className="flex items-center gap-3 border-b border-neutral-300 pb-2 transition-colors focus-within:border-neutral-900">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email-pro.com"
                autoComplete="email"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
              />
              <button
                type="submit"
                disabled={status === "sending"}
                className="shrink-0 text-sm font-medium tracking-wide text-neutral-900 transition-colors hover:text-neutral-600 disabled:text-neutral-400"
              >
                {status === "sending" ? "Inscription…" : "S'abonner"}
              </button>
            </div>
            {status === "error" && (
              <p className="text-xs text-red-500">
                Une erreur est survenue — réessayez.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
