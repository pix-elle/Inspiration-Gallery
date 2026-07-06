import { getItems } from "@/lib/queries";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const tag = url.searchParams.get("tag");
  const typeParam = url.searchParams.get("type");
  const type = typeParam === "image" || typeParam === "video" ? typeParam : null;

  const data = await getItems({ limit: 12, cursor, tag, type });

  return Response.json(data, {
    headers: {
      // Content changes only on ingest — cache at the edge, serve stale while
      // revalidating so scrolling never waits on the database.
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
