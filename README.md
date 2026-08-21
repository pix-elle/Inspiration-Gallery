# Inspiration Gallery (Motioon)

Galerie d'inspiration design — images et vidéos — alimentée depuis Notion.

## Structure

| Dossier | Rôle |
|---|---|
| `web/` | Le site (Next.js), déployé sur Vercel |
| `ingest/` | Le robot qui importe le contenu depuis Notion (tourne toutes les 15 min via GitHub Actions) |
| `db/schema.sql` | Le schéma de la base Neon — à coller dans le SQL Editor d'un nouveau projet |
| `docs/` | Architecture et guides |

## Modifier le site sans coder

Tout ce qui est éditable (nom, logo, onglets du menu, réseaux sociaux)
est dans **`web/site.config.ts`** — un seul fichier, commenté en français,
modifiable directement depuis l'interface GitHub (icône crayon ✏️).
Chaque commit redéploie le site automatiquement.

## Variables d'environnement

Les secrets ne sont jamais dans le repo. Chaque dossier contient un
`.env.example` commenté qui liste ce qu'il faut et où le trouver :

- `web/.env.example` → copier en `web/.env.local` (local) ou dans les
  Environment Variables du projet **Vercel** (production)
- `ingest/.env.example` → copier en `ingest/.env` (local) ou dans les
  **GitHub Actions secrets** du repo (production)

## Lancer en local

```bash
cd web
cp .env.example .env.local   # puis remplir DATABASE_URL
npm install
npm run dev                  # → http://localhost:3000
```

## Importer un dossier Google Drive (en masse)

Pour un lot de vidéos déjà rassemblées dans un dossier Drive partagé
(« Toute personne disposant du lien »), sans passer par Notion ligne par ligne :

```bash
cd ingest
node worker/sync-drive.js --dry-run "<lien du dossier>"   # liste, n'importe rien
node worker/sync-drive.js "<lien du dossier>" --tags motion --creator "Alessia"
```

Relancer la commande ne crée pas de doublons. Détails : `docs/05-ingest-cli.md`.

## Publier du contenu

Tout se passe dans la base Notion « Inspiration — Inbox » : remplir une
ligne (fichier ou lien Dropbox/Drive), passer le Statut sur **À poster**,
le robot publie au prochain passage. **À retirer** dépublie un item.
Le robot écrit le résultat (✅ Publié / ❌ Erreur + message) dans la ligne.
