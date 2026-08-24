import type { Metadata } from "next";
import { requireSession } from "@/lib/dal";
import { getAdminItems, getBrands, getBrandsWithCounts } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { AdminTable } from "./AdminTable";
import { AdminTabs } from "./AdminTabs";
import { BrandsPanel } from "./BrandsPanel";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

// Nothing here may be cached or prerendered: the table is per-session data.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // The real gate. proxy.ts only redirected on a missing cookie; this is what
  // verifies the signature, the expiry and the allowlist.
  const session = await requireSession();
  const [items, brands, brandsWithCounts, settings] = await Promise.all([
    getAdminItems(),
    getBrands(),
    getBrandsWithCounts(),
    getSettings(),
  ]);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-lg font-semibold">Administration</h1>
        <div className="flex items-center gap-4 text-sm text-foreground/60">
          <span>{session.email}</span>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </header>

      <AdminTabs
        medias={<AdminTable initialItems={items} initialBrands={brands} />}
        marques={<BrandsPanel initialBrands={brandsWithCounts} />}
        textes={<SettingsForm initial={settings} items={items} />}
      />
    </main>
  );
}
