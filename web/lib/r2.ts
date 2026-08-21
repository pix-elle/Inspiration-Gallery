import "server-only";

import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// The browser uploads straight to Cloudflare: the file never passes through
// Vercel, which has a request body limit far below a 30 MB clip — and would
// be a pointless relay anyway.

const PRESIGN_TTL_SECONDS = 600; // 10 min, enough for a slow connection

// Same list the ingest pipeline accepts, plus HEIC: iPhones shoot in it by
// default, and ffmpeg decodes it (sharp's prebuilt binary can't).
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

export const MAX_UPLOAD_BYTES = 500 * 1000 * 1000; // 500 Mo, comme l'affiche le Finder

function client(): S3Client {
  const { S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
  if (!S3_ENDPOINT || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    throw new Error("Identifiants R2 manquants (S3_*)");
  }
  return new S3Client({
    region: "auto",
    endpoint: S3_ENDPOINT,
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
  });
}

function bucket(): string {
  const name = process.env.S3_BUCKET;
  if (!name) throw new Error("S3_BUCKET manquant");
  return name;
}

// One URL, one key, one content type, ten minutes. Nothing about it lets the
// holder write anywhere else in the bucket.
//
// signableHeaders is not decoration: without it the content type stays out of
// the signature, and the very same URL happily accepts a file of any other
// type — measured, not assumed. With it, R2 rejects anything whose header
// doesn't match what we signed.
export async function presignUpload(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client(), command, {
    expiresIn: PRESIGN_TTL_SECONDS,
    signableHeaders: new Set(["content-type"]),
  });
}

// Read back what actually landed. The size and type announced by the browser
// are a claim; this is the measurement, and it runs before any row is created.
export async function headUpload(key: string) {
  try {
    const r = await client().send(
      new HeadObjectCommand({ Bucket: bucket(), Key: key })
    );
    return { size: r.ContentLength ?? 0, contentType: r.ContentType ?? "" };
  } catch {
    return null; // absent: the upload never completed
  }
}
