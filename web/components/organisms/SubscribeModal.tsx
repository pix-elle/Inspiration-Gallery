"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { OPEN_SUBSCRIBE_EVENT } from "@/components/atoms/SubscribeButton";
import type { Item } from "@/lib/types";

const DISMISSED_KEY = "newsletter-dismissed";
const SUBSCRIBED_KEY = "newsletter-subscribed";

// The teaser is portrait more often than not — every clip in the gallery is
// filmed on a phone. Left alone it makes a pop-up taller than the viewport,
// so the media box never gets narrower than 16:9 and crops instead.
const WIDEST_ALLOWED = 16 / 9;

type Props = {
  /** Auto-opening after a delay; an explicit click always opens the modal. */
  autoOpen: boolean;
  delaySeconds: number;
  title: string;
  successMessage: string;
  buttonLabel: string;
};

// Lead-capture modal: shows once per visitor after a short while on the
// site, teasing the weekly SaaS video inspiration newsletter. The teaser
// video is the freshest video item, fetched from the (edge-cached) API.
// Also opens on demand when a SubscribeButton fires OPEN_SUBSCRIBE_EVENT.
export function SubscribeModal({
  autoOpen,
  delaySeconds,
  title,
  successMessage,
  buttonLabel,
}: Props) {
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

  // Trigger 1: once per visitor, after a bit of engagement — and only when
  // the pop-up is switched on in the back-office. Trigger 2 below stays
  // active either way: a visitor who clicks "s'abonner" asked for it.
  useEffect(() => {
    if (!autoOpen) return;
    try {
      if (
        localStorage.getItem(DISMISSED_KEY) ||
        localStorage.getItem(SUBSCRIBED_KEY)
      ) {
        return;
      }
    } catch {
      // Private browsing: showing the pop-up beats crashing the page.
    }
    const timer = setTimeout(openWithVideo, delaySeconds * 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen, delaySeconds]);

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
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Nothing to remember, but the modal still closes.
    }
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
      try {
        localStorage.setItem(SUBSCRIBED_KEY, "1");
      } catch {
        // The signup went through; only the "don't ask again" is lost.
      }
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
        className="relative flex w-[min(92vw,400px)] flex-col gap-5 rounded-2xl bg-white p-6 text-neutral-900 shadow-2xl"
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer"
          className="absolute right-3 top-3 z-10 rounded-full bg-white/85 p-1.5 text-neutral-500 backdrop-blur transition-colors hover:bg-white hover:text-neutral-900"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        {video && (
          <div
            className="overflow-hidden rounded-lg"
            style={{
              // Never taller than 16:9; a wider clip keeps its own shape.
              aspectRatio: Math.max(WIDEST_ALLOWED, video.width / video.height),
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
          {title}
        </h2>

        {status === "done" ? (
          <p className="pb-1 text-center text-sm text-neutral-600">
            {successMessage}
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
                {status === "sending" ? "Inscription…" : buttonLabel}
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
