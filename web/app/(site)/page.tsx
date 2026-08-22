import { GalleryFeed } from "@/components/organisms/GalleryFeed";
import type { ProjectType } from "@/lib/types";

// Reading searchParams makes this route dynamic. That's the price of shared
// filtered URLs: the alternative — filtering in the browser — would show the
// unfiltered grid first to anyone opening a link someone sent them.
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const one = (key: string) => {
    const value = q[key];
    return (Array.isArray(value) ? value[0] : value) ?? null;
  };

  const projet = one("projet");
  const type = one("type");

  return (
    <GalleryFeed
      filters={{
        type: type === "image" || type === "video" ? type : null,
        projectType:
          projet === "popup" || projet === "store"
            ? (projet as ProjectType)
            : null,
        brand: one("marque"),
        city: one("lieu"),
      }}
    />
  );
}
