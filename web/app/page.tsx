import { Gallery } from "@/components/organisms/Gallery";
import { getItems } from "@/lib/queries";

// Content only changes when new items are ingested — near-static, edge-cached.
export const revalidate = 300;

export default async function HomePage() {
  const { items } = await getItems({ limit: 30 });

  return <Gallery initialItems={items} />;
}
