# Your Tasks (manual setup)

Things only you can do — account setup, credentials, DNS. Check them off as you go.

## Cloudflare R2 — ✅ fait (bucket `alessia-inspiration`)

> Deux pièges rencontrés au montage, à connaître si tu recrées tout un jour :
> le nom de bucket ci-dessous était un **exemple** (le vrai est
> `alessia-inspiration`), et l'endpoint `https://<id>.eu.r2.cloudflarestorage.com`
> ne voit *que* les buckets créés en juridiction EU — pour un bucket standard
> il faut `https://<id>.r2.cloudflarestorage.com`, sans le `.eu`.

- [x] Create a Cloudflare account (or log in) → https://dash.cloudflare.com
- [x] R2 → **Create bucket** — name: `inspiration-media` (region: automatic)
- [x] R2 → **Manage R2 API Tokens** → Create API token
      - Permission: **Object Read & Write**, scoped to the `inspiration-media` bucket
      - Save the **Access Key ID** and **Secret Access Key** (shown once)
- [x] Enable public access for the bucket:
      - Easiest: bucket → Settings → **R2.dev subdomain** → Allow access
        (gives you a `https://pub-xxxx.r2.dev` URL — fine for development)
      - Later/production: connect a **custom domain** (e.g. `cdn.yoursite.com`)
        on the bucket so media is served through Cloudflare's CDN with caching
        → **c'est devenu la priorité n°1**, voir « Performance » plus bas :
        mesuré le 26/08, `r2.dev` n'est pas mis en cache par le CDN et il est
        limité en débit ; chaque image repart chercher l'origine à 340 ms.
        Attention, ce n'est pas qu'un CNAME : R2 exige la zone chez Cloudflare
- [x] Put the values in `web/.env.local` (and later in `ingest/.env`):

```bash
S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com   # sans .eu
S3_BUCKET=alessia-inspiration
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
CDN_BASE_URL=https://pub-xxxx.r2.dev        # or https://cdn.yoursite.com
```

- [x] Tell Claude it's done → the ingest CLI gets switched from local storage to R2
- [ ] **Vérifier les secrets GitHub** : ils ont été saisis avec les mêmes valeurs
      d'exemple que `ingest/.env`. Corriger `S3_BUCKET` en `alessia-inspiration`
      et retirer le `.eu` de `S3_ENDPOINT`, sinon l'encodage échouera en CI
      avec « The specified bucket does not exist ».

## Back-office — ✅ en place

Le portail vit sur `/admin`. Connexion par lien magique, envoi direct vers
R2, encodage sur un runner GitHub. Il reste à :

- [x] Domaine d'envoi vérifié chez Resend — **`send.nexus-studio.ch`**, et non
      `mail.nexus-studio.ch` comme prévu initialement : ce nom porte déjà un
      CNAME vers le webmail Infomaniak, et un CNAME est exclusif. Aucun autre
      enregistrement ne peut coexister dessus, donc Resend n'aurait jamais pu y
      poser son DKIM.
- [x] Variables reportées dans Vercel (`AUTH_SECRET`, `ADMIN_EMAILS`,
      `RESEND_API_KEY`, `AUTH_EMAIL_FROM`…). Rappel : **il faut redéployer**
      après chaque ajout, et vérifier que la portée « Production » est cochée.
- [ ] **`RESEND_AUDIENCE_ID` manque encore en production.** C'est pour ça que
      les inscriptions newsletter n'arrivent pas chez Resend. Valeur à mettre :

      ```
      RESEND_AUDIENCE_ID=a70553c9-2b0d-4f97-82e6-849234764d33
      ```

      C'est l'audience « Inspiration Gallery » — pas « General »
      (`0bd298df-…`), l'audience par défaut du compte.

      Aucune donnée n'est perdue : Neon est la source de vérité et contient
      bien les inscrits. Mais `lib/resend.ts` ne fait rien si la variable
      manque, **sans rien journaliser** — d'où le silence complet. Une fois la
      variable posée, seules les *nouvelles* inscriptions partiront ; les
      anciennes seront à rattraper à la main.

## Performance — mesuré le 26/08/2026

Mesures prises depuis un edge asiatique, mais le diagnostic vaut pour l'Europe :
le trajet vers les États-Unis est le même problème.

| | TTFB | cache edge |
|---|---|---|
| Actif statique *(= coût réseau pur)* | 0,15 s | HIT |
| `/videos`, `/images`, `/about` | 0,15 – 0,18 s | HIT |
| **`/` (accueil)** | **0,44 s** | **MISS** |
| **Chaque média** | **0,34 s** | **aucun cache** |

Premier appel après inactivité : **3,19 s** (démarrage à froid).

### 1. Domaine personnalisé sur le bucket R2 — le plus rentable

Les médias sortent de `pub-998667dd44be44f6bbe22f8ab32d2261.r2.dev`.
**Cloudflare ne met pas ce domaine en cache sur son CDN** — il est prévu pour
le développement. Deux appels successifs sur le même fichier : 0,336 s puis
0,383 s, aucune accélération, et pas de `cf-cache-status` dans la réponse.
La doc Cloudflare précise en plus qu'il est **limité en débit** et « à réserver
au développement » : ce n'est pas seulement lent, c'est bridable.

Les fichiers portent pourtant déjà `Cache-Control: public, max-age=31536000,
immutable`. Ils sont parfaitement cachables ; personne ne les cache. Une
douzaine d'images par écran à 340 ms au lieu de ~50 ms depuis l'edge.

> ⚠️ **Ce n'est PAS un simple CNAME à poser chez Infomaniak**, contrairement à
> ce qui était noté ici au départ. Un domaine personnalisé R2 exige que la zone
> soit **dans le compte Cloudflare** qui héberge le bucket. Le mode
> « partial CNAME », qui l'éviterait, est réservé à l'offre **Business**.
> Il faut donc déplacer toute la zone `nexus-studio.ch` chez Cloudflare — la
> même opération délicate qu'en août, avec les mails en jeu.

#### Étapes, dans cet ordre

**A. Sans risque — rien n'est actif tant que les NS ne bougent pas**

- [ ] dash.cloudflare.com → **Add a domain** → `nexus-studio.ch` → offre
      **Free** → méthode **serveurs de noms** (pas le CNAME partiel).
      Utiliser **le compte qui héberge déjà le bucket R2**, sinon R2 ne pourra
      pas se servir du domaine.
- [ ] Laisser Cloudflare scanner, puis **vérifier l'import un par un**. Le scan
      rate régulièrement des TXT. Les douze enregistrements attendus :

      | Type  | Nom                      | Valeur                                          |
      |-------|--------------------------|-------------------------------------------------|
      | MX    | `nexus-studio.ch`        | `mta-gw.infomaniak.ch` · priorité 10            |
      | TXT   | `nexus-studio.ch`        | `v=spf1 include:spf.infomaniak.ch -all`         |
      | TXT   | `nexus-studio.ch`        | `lemlist-verif=16c905d`                          |
      | TXT   | `_dmarc`                 | `v=DMARC1; p=none; rua=mailto:contact@nexus-studio.ch` |
      | CNAME | `mail`                   | `mail.infomaniak.ch`                             |
      | CNAME | `webmail`                | `webmail.infomaniak.ch`                          |
      | CNAME | `smtp`                   | `mail.infomaniak.ch`                             |
      | CNAME | `imap`                   | `mail.infomaniak.ch`                             |
      | CNAME | `pop`                    | `mail.infomaniak.ch`                             |
      | CNAME | `inspiration`            | `3a26c06af75983be.vercel-dns-017.com`           |
      | CNAME | `send.send`              | `send.forge.rmta.net`                            |
      | TXT   | `resend._domainkey.send` | la clé DKIM (`p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBg…`) |

- [ ] **Nuage GRIS (DNS only) sur `inspiration`** : Vercel gère déjà son
      certificat et son CDN, le proxy Cloudflare ajouterait un intermédiaire de
      trop. Gris aussi sur `mail`, `webmail`, `smtp`, `imap`, `pop` — le proxy
      ne fait passer que du HTTP, jamais le trafic mail.

**B. Irréversible — c'est là qu'on a failli couper les mails en août**

- [ ] Désactiver DNSSEC chez Infomaniak. Il a été **réactivé** depuis la
      migration d'août (`DS 33959 13 2 CF05…` au registre le 30/08), et
      basculer les NS dans cet état provoque un `SERVFAIL` général — site *et*
      mails.
- [ ] Attendre que le DS disparaisse, **vérifier** avant d'avancer :

      ```
      dig DS nexus-studio.ch @a.nic.ch +short
      ```

      Tant que ça répond, ne pas continuer. Une fois vide, attendre encore une
      heure (TTL du DS).
- [ ] Basculer les serveurs de noms chez Infomaniak vers ceux de Cloudflare.
- [ ] Vérifier la délégation et les mails :

      ```
      dig NS nexus-studio.ch @a.nic.ch
      dig MX nexus-studio.ch +short
      ```

**C. Le CDN lui-même**

- [ ] R2 → bucket `alessia-inspiration` → **Settings → Custom Domain** →
      `cdn.nexus-studio.ch`. Cloudflare crée le CNAME tout seul, la zone étant
      désormais chez lui.
- [ ] Réactiver DNSSEC, **depuis Cloudflare** cette fois : il fournit son
      propre DS à saisir chez Infomaniak.
- [ ] Mettre `CDN_BASE_URL` à jour dans Vercel **et** dans `ingest/.env`
- [ ] Réécrire les URL déjà en base — remplacement d'hôte sur `image_base`,
      `video_url`, `poster_url`. À préparer en SQL réversible, ~500 lignes.

#### Alternative si le risque sur les mails gêne

Un **domaine séparé pour les médias** (~10 €/an), placé entièrement chez
Cloudflare. Zone vierge, aucun MX, aucun DKIM : la migration devient sans
enjeu et `nexus-studio.ch` n'est jamais touché. Plus cher et moins élégant,
mais ça supprime le seul vrai danger de l'opération.

### 2. Rendre l'accueil cachable à l'edge

C'est la seule route en MISS. `page.tsx` lit `searchParams` pour les filtres,
ce qui rend toute la route dynamique. `/videos` et `/images` prouvent que la
version cachée coûte 0,15 s — l'accueil coûte trois fois plus cher.

- [ ] Tester le rendu partiel préalable de Next 16 (coquille statique servie
      depuis l'edge, partie filtrée dynamique). Encore expérimental.

### 3. Rapprocher la fonction et la base — public européen

`x-vercel-id: sin1::iad1` : la fonction s'exécute à **Washington**, et Neon est
en `us-east-1`. Les deux sont bien colocalisés, mais du mauvais côté de
l'Atlantique pour un public européen.

- [ ] Passer Vercel en `fra1` (Francfort) ou `cdg1` (Paris)
- [ ] Passer Neon en `eu-central-1`

> ⚠️ **Déplacer les deux ensemble.** Bouger la fonction sans la base
> aggraverait la situation : chaque requête SQL traverserait alors
> l'Atlantique, et il y en a plusieurs par page.

Gain attendu : les 0,29 s d'écart entre l'accueil et une page cachée
tomberaient à quelques dizaines de millisecondes.

### 4. Démarrages à froid

3,19 s contre 0,45 s ensuite. Sur un site à faible trafic, de vrais visiteurs
les subissent. Réglage de plateforme plutôt que problème de code.

## Vidéos — lenteur au chargement de la grille

66 vidéos publiées, **toutes en 1080×1920**, 5,5 Mo en moyenne, jusqu'à
19,6 Mo. La tuile fait ~400 px de large : le navigateur décode **sept fois
plus de pixels que nécessaire**, et plusieurs clips à la fois.

Le code client est déjà bon (`preload="none"`, observateur d'intersection à
50 %, poster, pause hors écran) et l'encodage a `+faststart`. Le problème est
qu'il n'existe **qu'une seule taille de vidéo pour deux usages**, la grille et
la lightbox — alors que les images, elles, ont quatre variantes.

À faire dans cet ordre, le client d'abord (une heure, sans réencodage) :

- [ ] Séparer « charger » de « jouer » dans `useInViewVideo` : attacher la
      source plus tôt (300–400 px de marge) mais ne lancer la lecture qu'à
      50 % de visibilité. Le réseau prend de l'avance sans augmenter le nombre
      de décodages simultanés.
- [ ] Plafonner les lectures simultanées à ~3, les plus visibles.
- [ ] *Si ça ne suffit pas :* variante de grille en **540×960** dans
      `ingest/lib/video.js` + backfill des 66 vidéos. Quatre fois moins de
      pixels à décoder.
- [ ] Ajouter `-maxrate` / `-bufsize` à l'encodage : `crf 26` s'emballe sur les
      séquences chargées, d'où le clip à 19,6 Mo.

> La colonne `video_av1_url` existe, elle est **vide pour les 66 vidéos**, et
> rien ne la lit. Piste abandonnée — et tant mieux : l'AV1 pèse moins mais se
> décode bien plus cher en logiciel, ce qui aggraverait exactement ce
> problème-ci sur une grille qui joue toute seule.

## Recadrage 9:16 — décision en attente

Le commit `0b85e21` **existe en local mais n'est pas poussé**. Il met toutes
les tuiles de la grille au format 9:16.

Contrairement à ce qu'on croyait, **aucune image n'était déjà conforme** : les
248 dites « verticales » sont en 3:4 (0,74–0,75). Les 436 sont donc recadrées,
les portraits de 25 % de leur largeur et les paysages de 58 %.

Le recadrage se fait à l'affichage, donc le navigateur télécharge des pixels
qu'il jette :

| | 12 tuiles, mobile |
|---|---|
| Mosaïque d'origine | 0,12 Mo |
| Recadrage à l'affichage (`0b85e21`) | **1,06 Mo** — ×9 |
| Recadrage à la source | **0,31 Mo** — même rendu |

Il restera 2,5× l'original quoi qu'il arrive : une tuile 9:16 montre 2,37 fois
plus de pixels qu'une 4:3 de même largeur. On affiche plus, on paie plus.

- [ ] Trancher : pousser tel quel, attendre le CDN, ou refaire à la source
- [ ] Si « à la source » : variantes 400 et 800 en 9:16 pour la grille, 1200 et
      2000 en cadrage plein **pour la lightbox** — sinon on perd l'intérêt
      d'ouvrir une photo. ~30 % de stockage en plus, beaucoup moins de bande
      passante. `refresh-images.js` sert de modèle pour le rattrapage.

## Netteté — 9 items du 22 août

Corrigé le 29/08 : dix items avaient en base `4032x3024` alors que leurs
fichiers étaient en portrait 3:4 — la grille réservait une tuile paysage et
`object-cover` n'en montrait qu'une bande. Reliquat du bug EXIF que
`refresh-images.js` avait traité côté fichiers mais pas côté base. Dimensions
remises à `3024x4032`, vérifié 436/436 cohérentes. Sauvegarde des anciennes
valeurs dans le scratchpad de la session.

Reste un défaut mineur sur neuf d'entre eux :

- [ ] Leurs fichiers portent l'ancienne convention — `400.avif` fait en réalité
      300 px de large, mais le `srcset` le déclare `400w`. Le navigateur croit
      obtenir plus de détail qu'il n'en reçoit, d'où un léger flou. Réencodage
      impossible en l'état : **aucun de ces items n'a conservé son fichier
      source** sur R2, il faudrait les originaux depuis le disque (shooting du
      22 août).

## Divers en attente

- [ ] **Aucun `og:image` sur le site.** `metadataBase` est en place, mais il
      n'y a aucune image déclarée : les partages LinkedIn et WhatsApp sortent
      sans vignette. Format à produire : **1200 × 630 px**, PNG ou JPEG, sous
      300 Ko, à déposer en `web/app/opengraph-image.png` (Next génère les
      balises tout seul). Garder logo et texte dans le carré central de
      630 × 630, plusieurs plateformes recadrent en carré.
- [ ] **Les items vidéo se partagent sans aperçu.** `generateMetadata` de
      `app/(site)/item/[id]/page.tsx` sert `poster.avif` — **aucun robot social
      ne lit l'AVIF**. Les items image servent du `.webp`, que LinkedIn rend
      mal. Correctif : produire un **JPEG 1200 px** dans le pipeline d'ingest à
      côté des variantes AVIF/WebP, et le pointer là.
- [ ] **`nexus-studio.ch` et `www` renvoient 404**, servis par une
      infrastructure Wix qui n'est plus utilisée. Trois options : laisser tel
      quel, nettoyer les enregistrements A, ou rediriger vers
      `inspiration.nexus-studio.ch` via la redirection web d'Infomaniak.
      **Ne pas toucher aux MX ni au SPF** — la messagerie tourne dessus.
- [ ] **Ménage dans les marques** (onglet Marques, déjà en place). 23 des 47
      sont en minuscules. Trois natures de problème : la casse pure (`tissot`,
      `longines` — le slug ne bouge pas), l'orthographe (`carrhart` →
      Carhartt, `stassy` → Stüssy, `fredperry`, `off white` — **le slug
      change**, les liens partagés casseront), et ce qui n'est peut-être pas
      une marque (`modif` et ses 34 items, `vitrines`, `boutiques`, `popups`,
      `tissot bangkok one` qui ressemble à un lieu).
- [ ] **DMARC.** Aujourd'hui `p=none` avec `rua=mailto:contact@nexus-studio.ch`.
      Il n'y a **aucun DKIM** sur le domaine, et SPF ne survit pas au transfert
      de message : passer en `p=reject` sans DKIM rejetterait une partie du
      courrier légitime. Chemin : lire les rapports 2 à 4 semaines → aligner
      tous les expéditeurs (Infomaniak, lemlist, Resend) → `p=quarantine` →
      `p=reject`.

## Later (not blocking anything yet)

- [ ] Buy/choose the domain for the site
- [ ] Create a Vercel account for deployment (Phase 7)
- [ ] `brew install ffmpeg` if not already installed (needed for video ingestion)
