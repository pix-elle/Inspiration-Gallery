import Link from "next/link";
import { siteConfig } from "@/site.config";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 px-2 py-1">
      {siteConfig.logoImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={siteConfig.logoImage}
          alt=""
          className="h-7 w-7 rounded-md object-contain"
        />
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background text-sm font-bold">
          {siteConfig.name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="text-sm font-semibold tracking-tight">
        {siteConfig.name}
      </span>
    </Link>
  );
}
