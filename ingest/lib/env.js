import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

// Single source of truth: web/.env.local. An ingest/.env (if present) can
// override — that's where R2 credentials go if you'd rather keep them separate.
config({ path: join(here, "../../web/.env.local") });
config({ path: join(here, "../.env"), override: true });

export const env = process.env;

// R2 is configured when the S3 vars exist; otherwise we run in local mode and
// write files into web/public/media (served by Next during development).
export const useR2 = Boolean(env.S3_ENDPOINT && env.S3_ACCESS_KEY_ID);
export const LOCAL_MEDIA_DIR = join(here, "../../web/public/media");
export const CDN_BASE_URL = useR2 ? env.CDN_BASE_URL : "/media";
