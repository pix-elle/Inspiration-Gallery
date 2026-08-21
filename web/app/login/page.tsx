import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";
import { getSession } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Connexion",
  // A login screen has nothing to offer a search engine.
  robots: { index: false, follow: false },
};

const MESSAGES: Record<string, string> = {
  lien: "Ce lien n'est pas valide. Demande-en un nouveau.",
  expire:
    "Ce lien a expiré ou a déjà été utilisé. Demande-en un nouveau, il reste valable 15 minutes.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  // Already signed in: no reason to show the form again.
  if (await getSession()) redirect("/admin");

  const { erreur } = await searchParams;
  const message = erreur ? MESSAGES[erreur] : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">Administration</h1>
        <p className="text-sm text-foreground/60">
          Pas de mot de passe : tu reçois un lien par email, tu cliques, tu es
          connectée.
        </p>
      </div>

      {message && (
        <p className="rounded-md border border-foreground/15 px-3 py-2 text-sm text-foreground/80">
          {message}
        </p>
      )}

      <LoginForm />
    </main>
  );
}
