// Ce que le back-office accepte à l'envoi. Volontairement SANS "server-only" :
// la modal d'ajout doit trier les fichiers déposés avant le moindre envoi, et
// elle tourne dans le navigateur. Deux listes qui divergeraient donneraient le
// pire des cas — un fichier accepté à l'écran puis refusé par le serveur.
//
// La route /api/admin/uploads revalide tout de son côté : ceci accélère le
// retour à l'utilisateur, ça ne remplace pas le contrôle serveur.

// Même liste que le pipeline d'ingest, plus le HEIC : les iPhones filment
// dedans par défaut, et ffmpeg sait le décoder (pas le binaire de sharp).
export const ACCEPTED_TYPES: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heic",
};

// Mo et non Mio : le chiffre affiché doit être celui que le Finder montre,
// sinon un fichier « de 500 Mo » se fait refuser pour 524 Mo.
export const MAX_UPLOAD_BYTES = 500 * 1000 * 1000;

export const ACCEPT_ATTRIBUTE = Object.keys(ACCEPTED_TYPES).join(",");

export const megabytes = (bytes: number) => Math.round(bytes / 1e6);

/** null si le fichier passe ; sinon le motif à afficher tel quel. */
export function rejectionReason(file: File): string | null {
  if (!ACCEPTED_TYPES[file.type.toLowerCase()]) {
    return "format non supporté";
  }
  if (file.size <= 0) return "fichier vide";
  if (file.size > MAX_UPLOAD_BYTES) {
    return `${megabytes(file.size)} Mo — maximum ${megabytes(MAX_UPLOAD_BYTES)} Mo`;
  }
  return null;
}
