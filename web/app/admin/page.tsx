import type { Metadata } from "next";
import { requireSession } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  // The real gate. proxy.ts only redirected on a missing cookie; this is what
  // verifies the signature, the expiry and the allowlist.
  const session = await requireSession();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-lg font-semibold">Administration</h1>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="text-sm text-foreground/60 underline underline-offset-4 hover:text-foreground"
          >
            Se déconnecter
          </button>
        </form>
      </header>

      <p className="text-sm text-foreground/60">
        Connectée en tant que{" "}
        <span className="text-foreground">{session.email}</span>. Le tableau des
        vidéos arrive à l&apos;étape suivante.
      </p>
    </main>
  );
}
