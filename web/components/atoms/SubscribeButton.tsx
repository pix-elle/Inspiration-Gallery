"use client";

// Fired on window; SubscribeModal listens and opens immediately.
export const OPEN_SUBSCRIBE_EVENT = "subscribe:open";

export function SubscribeButton({
  label = "Subscribe",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_SUBSCRIBE_EVENT))}
      className={`rounded-full bg-foreground text-background text-sm font-medium transition-opacity hover:opacity-80 ${className}`}
    >
      {label}
    </button>
  );
}
