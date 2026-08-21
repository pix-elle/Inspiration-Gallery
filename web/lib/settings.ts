import "server-only";

import { cache } from "react";
import { neon, neonConfig } from "@neondatabase/serverless";
import { Agent, fetch as undiciFetch } from "undici";

const ipv4Agent = new Agent({ connect: { family: 4 } });
neonConfig.fetchFunction = (url: string, init: Record<string, unknown>) =>
  undiciFetch(url, { ...init, dispatcher: ipv4Agent });

const sql = neon(process.env.DATABASE_URL!);

// The site's editable copy. Structural configuration — logo, menu tabs,
// social links — stays in site.config.ts: it's a developer's decision and it
// belongs in git, where a change is reviewable and revertable. What lives
// here is what someone might want to reword on a Tuesday afternoon.
//
// Defaults are the source of truth for the shape: a key absent from the
// database falls back to its default, so adding a setting never requires a
// migration and never leaves a blank page.
export const SETTING_DEFAULTS = {
  // The pop-up starts disabled on purpose: it interrupts a visitor who came
  // to look at the gallery, and that's a decision to make deliberately.
  newsletterPopupEnabled: "false",
  newsletterPopupDelaySeconds: "8",
  newsletterPopupTitle:
    "L'inspiration vidéo SaaS qui performe, chaque semaine dans votre inbox",
  newsletterPopupSuccess: "C'est noté — premier envoi la semaine prochaine ✦",
  sidebarNewsletterTitle: "La newsletter",
  sidebarNewsletterText:
    "L'inspiration vidéo SaaS qui performe, chaque semaine directement dans votre inbox.",
  subscribeButtonLabel: "Recevoir la newsletter",
  subscribeButtonLabelShort: "S'abonner",
  siteDescription: "A curated gallery of design inspiration — images and videos.",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = Record<SettingKey, string>;

export const SETTING_KEYS = Object.keys(SETTING_DEFAULTS) as SettingKey[];

// Memoized per render pass: the sidebar, the modal and the metadata all ask
// for it, and one page render should hit the database once.
export const getSettings = cache(async (): Promise<Settings> => {
  const rows = (await sql`select key, value from settings`) as {
    key: string;
    value: string;
  }[];

  const stored = new Map(rows.map((r) => [r.key, r.value]));
  const out = { ...SETTING_DEFAULTS } as Settings;
  for (const key of SETTING_KEYS) {
    const value = stored.get(key);
    if (value !== undefined) out[key] = value;
  }
  return out;
});

export async function updateSettings(edits: Partial<Settings>) {
  for (const [key, value] of Object.entries(edits)) {
    if (!SETTING_KEYS.includes(key as SettingKey)) continue;
    await sql`
      insert into settings (key, value) values (${key}, ${value})
      on conflict (key) do update set value = excluded.value, updated_at = now()
    `;
  }
}

export function isOn(value: string): boolean {
  return value === "true";
}
