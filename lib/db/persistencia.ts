import { accessSync, constants, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import path from "path";
import { resolveAnexosRoot } from "@/lib/ordens-compra/anexos";
import { diretorioEvidencias, anosEvidenciaDisponiveis } from "@/lib/treinamentos/evidencias";
import { getDatabaseFilePath, getDb } from "./client";
import { resolveDatabasePath } from "./path";

function canWriteDir(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true });
    accessSync(dir, constants.W_OK);
    const probe = path.join(dir, ".aionscope-persist-probe");
    writeFileSync(probe, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

function isEphemeralPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  const cwd = process.cwd().replace(/\\/g, "/");
  return (
    normalized.startsWith(`${cwd}/data/`) ||
    normalized.includes("/app/data/") ||
    normalized.startsWith("./data/") ||
    /\/workspace\/data\//.test(normalized)
  );
}

/** Diagnóstico de persistência (Railway volume /data). */
export function diagnosticoPersistencia() {
  const databasePath = resolveDatabasePath();
  const databaseDir = path.dirname(databasePath);
  const anexosRoot = resolveAnexosRoot();
  const evidenciasDir = diretorioEvidencias();

  let databaseBytes: number | null = null;
  if (existsSync(databasePath)) {
    try {
      databaseBytes = statSync(databasePath).size;
    } catch {
      databaseBytes = null;
    }
  }

  let ordensCompra = 0;
  try {
    getDb();
    ordensCompra = (
      getDb().prepare("SELECT COUNT(*) AS n FROM ordens_compra").get() as { n: number }
    ).n;
  } catch {
    ordensCompra = -1;
  }

  const databaseWritable = canWriteDir(databaseDir);
  const anexosWritable = canWriteDir(anexosRoot);
  const evidenciasWritable = canWriteDir(evidenciasDir);
  const ephemeral = isEphemeralPath(databasePath);
  const volumeMount = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim() || null;
  const dataRootOk = canWriteDir("/data");

  const ok = databaseWritable && anexosWritable && !ephemeral;

  const avisos: string[] = [];
  if (ephemeral) {
    avisos.push(
      "SQLite está em disco efêmero (/app/data). Crie um Volume Railway montado em /data e defina DATABASE_PATH=/data/aionscope.sqlite.",
    );
  }
  if (!dataRootOk) {
    avisos.push("/data não é gravável — volume ausente ou permissão do mount (entrypoint corrige no próximo deploy).");
  }
  if (!anexosWritable) {
    avisos.push("Pasta de anexos de OC não é gravável.");
  }
  if (!evidenciasWritable) {
    avisos.push("Pasta de evidências de treinamentos não é gravável.");
  }
  if (!volumeMount && process.env.RAILWAY_ENVIRONMENT) {
    avisos.push(
      "RAILWAY_VOLUME_MOUNT_PATH vazio — confira se o Volume está anexado ao serviço (Settings → Volumes → mount /data).",
    );
  }

  return {
    ok,
    ephemeral,
    databasePath,
    databaseFile: getDatabaseFilePath(),
    databaseBytes,
    databaseWritable,
    anexosRoot,
    anexosWritable,
    evidenciasDir,
    evidenciasWritable,
    evidenciasAnos: anosEvidenciaDisponiveis(),
    ordensCompra,
    dataRootWritable: dataRootOk,
    railwayVolumeMount: volumeMount,
    railwayEnvironment: process.env.RAILWAY_ENVIRONMENT ?? null,
    databasePathEnv: process.env.DATABASE_PATH?.trim() || null,
    avisos,
  };
}

/** Stamp leve no volume para validar sobrevivência após redeploy. */
export function gravarStampVolume() {
  const dir = path.dirname(resolveDatabasePath());
  if (isEphemeralPath(path.join(dir, "x"))) return null;
  const stamp = path.join(dir, ".aionscope-volume-stamp");
  const payload = { em: new Date().toISOString(), pid: process.pid };
  writeFileSync(stamp, JSON.stringify(payload));
  return payload;
}

export function lerStampVolume() {
  const dir = path.dirname(resolveDatabasePath());
  const stamp = path.join(dir, ".aionscope-volume-stamp");
  if (!existsSync(stamp)) return null;
  try {
    return JSON.parse(readFileSync(stamp, "utf8")) as { em: string; pid: number };
  } catch {
    return null;
  }
}
