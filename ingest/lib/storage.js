import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, extname } from "node:path";
import { env, useR2, LOCAL_MEDIA_DIR, CDN_BASE_URL } from "./env.js";

const CONTENT_TYPES = {
  ".avif": "image/avif",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
};

let s3 = null;
if (useR2) {
  const { S3Client } = await import("@aws-sdk/client-s3");
  s3 = new S3Client({
    region: "auto",
    endpoint: env.S3_ENDPOINT,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
}

// key = path under the bucket / media dir, e.g. "items/abc123/800.avif".
// Returns the public URL to store in the database.
export async function storeBuffer(buffer, key) {
  if (useR2) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await s3.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: CONTENT_TYPES[extname(key)] ?? "application/octet-stream",
        // Content-addressed by item id — safe to cache forever.
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
  } else {
    const dest = join(LOCAL_MEDIA_DIR, key);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, buffer);
  }
  return `${CDN_BASE_URL}/${key}`;
}

// Télécharge un objet du bucket (l'original déposé par le portail). On passe
// par l'API S3 authentifiée plutôt que par l'URL publique : le runner a déjà
// les identifiants, et rien n'oblige alors les sources à être publiques.
export async function fetchObject(key) {
  if (!useR2) throw new Error("Téléchargement depuis R2 impossible en mode local");
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const res = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  return Buffer.from(await res.Body.transformToByteArray());
}

export function storageMode() {
  return useR2 ? `R2 (${env.S3_BUCKET})` : `local (${LOCAL_MEDIA_DIR})`;
}
