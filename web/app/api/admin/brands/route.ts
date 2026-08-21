import { requireApiSession } from "@/lib/dal";
import { getBrands } from "@/lib/queries";

export async function GET() {
  const { session, response } = await requireApiSession();
  if (!session) return response;
  return Response.json({ brands: await getBrands() });
}
