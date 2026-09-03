import { accessSync, constants, mkdirSync } from "fs";
import path from "path";

const DEFAULT_RAILWAY = "/data/aionscope.sqlite";
const LOCAL_FALLBACK = path.join(process.cwd(), "data", "aionscope.sqlite");

function canWriteDir(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true });
    accessSync(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/** Resolve o arquivo SQLite: DATABASE_PATH → /data (Railway) → data/ no workspace. */
export function resolveDatabasePath(): string {
  const fromEnv = process.env.DATABASE_PATH?.trim();
  if (fromEnv) {
    const dir = path.dirname(fromEnv);
    if (canWriteDir(dir)) return fromEnv;
  }

  const railwayDir = path.dirname(DEFAULT_RAILWAY);
  if (canWriteDir(railwayDir)) return DEFAULT_RAILWAY;

  const localDir = path.dirname(LOCAL_FALLBACK);
  canWriteDir(localDir);
  return LOCAL_FALLBACK;
}
