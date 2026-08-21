# Inspiration Gallery (Nexus Studio)

Galerie d'inspiration design — images et vidéos — alimentée depuis un
back-office intégré au site.

## Structure

| Dossier | Rôle |
|---|---|
| `web/` | Le site (Next.js), déployé sur Vercel |
| `ingest/` | Le pipeline média (ffmpeg + sharp) : encodage déclenché par le back-office, et scripts d'import en masse |
| `db/schema.sql` | Le schéma de la base Neon — à coller dans le SQL Editor d'un nouveau projet |
| `docs/` | Architecture et guides |

## Publier du contenu

Tout se passe sur **`/admin`**, sur le site lui-même. Pas de mot de passe :
on saisit son adresse email, on reçoit un lien, on clique. Seules les
adresses listées dans `ADMIN_EMAILS` peuvent entrer.

Depuis ce tableau : envoyer une vidéo ou une image, lui donner un titre,
un type de projet (pop-up ou magasin) et une marque — existante ou nouvelle.
Le fichier part directement sur Cloudflare, puis un runner GitHub l'encode
et le publie. Compter une à trois minutes, pendant lesquelles la ligne
affiche « Encodage en cours ».

On peut aussi corriger un texte, masquer un contenu du site sans le
supprimer, le remettre en ligne, relancer un encodage échoué, ou supprimer
définitivement — la suppression efface aussi les fichiers stockés.

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
  **GitHub Actions secrets** du repo, où le workflow d'encodage les lit

## Lancer en local

```bash
cd web
cp .env.example .env.local   # puis remplir DATABASE_URL
npm install
npm run dev                  # → http://localhost:3000
```

## Importer un dossier Google Drive (en masse)

Pour un lot de vidéos déjà rassemblées dans un dossier Drive partagé
(« Toute personne disposant du lien ») :

```bash
cd ingest
node worker/sync-drive.js --dry-run "<lien du dossier>"   # liste, n'importe rien
node worker/sync-drive.js "<lien du dossier>" --tags motion --creator "Alessia"
```

Si le dossier n'est **pas** partagé publiquement (Drive refuse alors tout
téléchargement anonyme), télécharge-le et importe l'arborescence locale :

```bash
node worker/import-folder.js ~/Downloads/boutiques --dry-run
node worker/import-folder.js ~/Downloads/boutiques --limit 8 --videos-only
```

Le nom du dossier parent devient un tag et, à défaut de nom de fichier parlant,
le titre. Relancer une commande ne crée jamais de doublons (empreinte du
fichier). Détails : `docs/05-ingest-cli.md`.

