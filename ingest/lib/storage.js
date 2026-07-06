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

export function storageMode() {
  return useR2 ? `R2 (${env.S3_BUCKET})` : `local (${LOCAL_MEDIA_DIR})`;
}
