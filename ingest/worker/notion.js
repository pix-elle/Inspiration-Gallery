// Minimal Notion API client (no SDK dependency — Node 20+ fetch).
import { env } from "../lib/env.js";

const NOTION_API = "https://api.notion.com/v1";

async function notionFetch(path, body) {
  const res = await fetch(`${NOTION_API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Notion API ${path}: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function notionPatch(path, body) {
  const res = await fetch(`${NOTION_API}${path}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Notion API ${path}: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// Rows ready for the robot: checked, and not already published or in flight.
export async function fetchQueue() {
  const data = await notionFetch(`/databases/${env.NOTION_DATABASE_ID}/query`, {
    filter: {
      and: [
        { property: "Prêt à publier", checkbox: { equals: true } },
        { property: "Statut", select: { does_not_equal: "✅ Publié" } },
        { property: "Statut", select: { does_not_equal: "Traitement" } },
      ],
    },
    page_size: 10, // per run — keeps each cron run short; the next run continues
  });
  return data.results.map(parseRow);
}

function plain(richText) {
  return (richText ?? []).map((t) => t.plain_text).join("") || null;
}

function parseRow(page) {
  const p = page.properties;
  return {
    pageId: page.id,
    title: plain(p["Titre"]?.title),
    fileUrl: p["Fichier"]?.files?.[0]?.file?.url ?? p["Fichier"]?.files?.[0]?.external?.url ?? null,
    fileName: p["Fichier"]?.files?.[0]?.name ?? null,
    linkUrl: p["Lien fichier"]?.url ?? null,
    tags: (p["Tags"]?.multi_select ?? []).map((t) => t.name),
    category: p["Catégorie"]?.select?.name ?? null,
    creator: plain(p["Créateur"]?.rich_text),
    sourceUrl: p["Source"]?.url ?? null,
    description: plain(p["Description"]?.rich_text),
  };
}

export async function setStatus(pageId, status, extra = {}) {
  const properties = {
    Statut: { select: { name: status } },
  };
  if (extra.error !== undefined) {
    properties["Erreur"] = {
      rich_text: extra.error
        ? [{ text: { content: String(extra.error).slice(0, 1900) } }]
        : [],
    };
  }
  if (extra.itemId) {
    properties["ID item"] = { rich_text: [{ text: { content: extra.itemId } }] };
  }
  if (extra.publishedAt) {
    properties["Publié le"] = { date: { start: extra.publishedAt } };
  }
  await notionPatch(`/pages/${pageId}`, { properties });
}
