import { getItems } from "@/lib/queries";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const tag = url.searchParams.get("tag");
  const typeParam = url.searchParams.get("type");
  const type = typeParam === "image" || typeParam === "video" ? typeParam : null;

  const projectParam = url.searchParams.get("projet");
  const projectType =
    projectParam === "popup" || projectParam === "store" ? projectParam : null;

  const data = await getItems({
    limit: 12,
    cursor,
    tag,
    type,
    projectType,
    brand: url.searchParams.get("marque"),
    city: url.searchParams.get("lieu"),
  });

  return Response.json(data, {
    headers: {
      // Content changes only on ingest — cache at the edge, serve stale while
      // revalidating so scrolling never waits on the database.
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
