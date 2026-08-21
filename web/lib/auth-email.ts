import "server-only";

import { MAGIC_TOKEN_TTL_MINUTES } from "@/lib/auth";

// Until mail.nexus-studio.ch is verified, Resend only accepts its own
// onboarding sender and only delivers to the account owner's address — which
// is why AUTH_EMAIL_FROM is a variable rather than a constant. Switching it to
// noreply@mail.nexus-studio.ch is the single change needed once DNS lands.
function sender(): string {
  return process.env.AUTH_EMAIL_FROM ?? "onboarding@resend.dev";
}

export async function sendMagicLink(email: string, link: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Without a key there is no way to deliver the link. Failing loudly in
    // the log beats a login screen that silently never works.
    console.error("RESEND_API_KEY manquant — lien de connexion non envoyé");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Nexus Studio <${sender()}>`,
      to: [email],
      subject: "Ton lien de connexion",
      text: [
        "Voici ton lien pour accéder à l'espace d'administration :",
        "",
        link,
        "",
        `Il est valable ${MAGIC_TOKEN_TTL_MINUTES} minutes et ne fonctionne qu'une seule fois.`,
        "",
        "Si tu n'as pas demandé ce lien, ignore simplement cet email.",
      ].join("\n"),
    }),
  });

  if (!res.ok) {
    console.error(`Resend a refusé l'envoi (${res.status}) : ${await res.text()}`);
  }
}
