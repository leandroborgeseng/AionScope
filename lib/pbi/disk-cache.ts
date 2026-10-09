import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "fs";
import path from "path";
import { resolveDatabasePath } from "@/lib/db/path";
import type { PbiResult } from "./types";

type DiskEntry<T> = {
  savedAt: string;
  expiresAt: number;
  payload: PbiResult<T>;
};

function cacheRoot(): string {
  const fromEnv = process.env.PBI_DISK_CACHE_DIR?.trim();
  if (fromEnv) return fromEnv;
  // Mesmo volume do SQLite (/data) quando disponível.
  return path.join(path.dirname(resolveDatabasePath()), "pbi-cache");
}

function ensureRoot(): string | null {
  const root = cacheRoot();
  try {
    mkdirSync(root, { recursive: true });
    return root;
  } catch {
    return null;
  }
}

function fileFor(resource: string, cacheKey: string): string | null {
  const root = ensureRoot();
  if (!root) return null;
  const hash = createHash("sha1").update(cacheKey).digest("hex").slice(0, 24);
  return path.join(root, `${resource}-${hash}.json`);
}

export function readDiskCache<T>(resource: string, cacheKey: string): PbiResult<T> | null {
  const file = fileFor(resource, cacheKey);
  if (!file || !existsSync(file)) return null;
  try {
    const raw = readFileSync(file, "utf8");
    const entry = JSON.parse(raw) as DiskEntry<T>;
    if (!entry?.payload || typeof entry.expiresAt !== "number") return null;
    if (entry.expiresAt <= Date.now()) return null;
    return {
      ...entry.payload,
      cachedAt: entry.savedAt,
    };
  } catch {
    return null;
  }
}

/** Lê entrada expirada (stale) para degradar com elegância se a API falhar. */
export function readDiskCacheStale<T>(resource: string, cacheKey: string): PbiResult<T> | null {
  const file = fileFor(resource, cacheKey);
  if (!file || !existsSync(file)) return null;
  try {
    const raw = readFileSync(file, "utf8");
    const entry = JSON.parse(raw) as DiskEntry<T>;
    if (!entry?.payload?.ok) return null;
    return {
      ...entry.payload,
      cachedAt: entry.savedAt,
    };
  } catch {
    return null;
  }
}

export function writeDiskCache<T>(
  resource: string,
  cacheKey: string,
  payload: PbiResult<T>,
  ttlMs: number,
): void {
  if (!payload.ok) return;
  const file = fileFor(resource, cacheKey);
  if (!file) return;
  const entry: DiskEntry<T> = {
    savedAt: new Date().toISOString(),
    expiresAt: Date.now() + ttlMs,
    payload,
  };
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(entry));
    renameSync(tmp, file);
  } catch {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}
