import "server-only";

import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// The browser uploads straight to Cloudflare: the file never passes through
// Vercel, which has a request body limit far below a 30 MB clip — and would
// be a pointless relay anyway.

const PRESIGN_TTL_SECONDS = 600; // 10 min, enough for a slow connection

// Définis dans lib/media-limits.ts, qui n'est pas "server-only" : la modal
// d'ajout en a besoin pour trier les fichiers avant envoi. Réexportés ici pour
// que les routes qui les importaient déjà n'aient rien à changer.
export { ACCEPTED_TYPES, MAX_UPLOAD_BYTES } from "./media-limits";

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

// Deleting an item deletes its files. The command-line importers deliberately
// left media orphaned — cheap, and ids are never reused — but that was a
// choice for a technical tool. With a delete button in a GUI, files nobody
// can reach again would just be silent waste.
export async function deleteUnder(prefixes: string[]): Promise<number> {
  const s3 = client();
  const Bucket = bucket();
  let deleted = 0;

  for (const Prefix of prefixes) {
    if (!Prefix) continue;
    let token: string | undefined;
    do {
      const listed = await s3.send(
        new ListObjectsV2Command({ Bucket, Prefix, ContinuationToken: token })
      );
      const keys = (listed.Contents ?? []).map((o) => ({ Key: o.Key! }));
      if (keys.length > 0) {
        await s3.send(
          new DeleteObjectsCommand({ Bucket, Delete: { Objects: keys } })
        );
        deleted += keys.length;
      }
      token = listed.NextContinuationToken;
    } while (token);
  }
  return deleted;
}
