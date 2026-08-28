import { env } from "cloudflare:workers";

export interface AppEnv {
  DB: D1Database;
  FILES: R2Bucket;
  ASSETS: Fetcher;
  SESSION_SECRET?: string;
  PII_ENCRYPTION_KEY?: string;
  ADMIN_INITIAL_USERNAME?: string;
  ADMIN_INITIAL_PASSWORD?: string;
  ADMIN_INITIAL_DISPLAY_NAME?: string;
  TURNSTILE_SECRET_KEY?: string;
}

export function getEnv(): AppEnv { return env as unknown as AppEnv; }
