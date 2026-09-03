import Database from "better-sqlite3";
import { accessSync, constants, readFileSync } from "fs";
import path from "path";
import { resolveDatabasePath } from "./path";
import { MIGRATION_NAME, SCHEMA_SQL } from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __aionSqlite: Database.Database | undefined;
}

function tryReadJson<T>(filePath: string): T | null {
  try {
    accessSync(filePath, constants.R_OK);
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function seedFromJsonFiles(db: Database.Database) {
  const dataDir = path.join(process.cwd(), "data");

  const parqueRow = db.prepare("SELECT id FROM parque_meta WHERE id = 1").get();
  if (!parqueRow) {
    type ParqueJson = {
      valorSubstituicaoManual?: number | null;
      valorApi?: number | null;
      fonte?: string | null;
      escopo?: string | null;
      atualizadoEm?: string | null;
      atualizadoPor?: string | null;
      valorManualReferencia?: number | null;
      notas?: string | null;
    };
    const parque = tryReadJson<ParqueJson>(path.join(dataDir, "parque.json"));
    db.prepare(
      `INSERT INTO parque_meta (
        id, valor_manual, valor_api, escopo, fonte, atualizado_em, atualizado_por,
        valor_manual_referencia, notas
      ) VALUES (1, @valor_manual, @valor_api, @escopo, @fonte, @atualizado_em, @atualizado_por,
        @valor_manual_referencia, @notas)`,
    ).run({
      valor_manual:
        parque?.valorSubstituicaoManual != null && Number.isFinite(parque.valorSubstituicaoManual)
          ? parque.valorSubstituicaoManual
          : null,
      valor_api:
        parque?.valorApi != null && Number.isFinite(parque.valorApi) ? parque.valorApi : null,
      escopo: parque?.escopo === "medicos" ? "medicos" : "todos",
      fonte: parque?.fonte === "manual" ? "manual" : "api",
      atualizado_em: typeof parque?.atualizadoEm === "string" ? parque.atualizadoEm : null,
      atualizado_por: typeof parque?.atualizadoPor === "string" ? parque.atualizadoPor : null,
      valor_manual_referencia:
        parque?.valorManualReferencia != null && Number.isFinite(parque.valorManualReferencia)
          ? parque.valorManualReferencia
          : 57_000_000,
      notas: typeof parque?.notas === "string" ? parque.notas : null,
    });
  }

  const countRow = db.prepare("SELECT COUNT(*) AS n FROM contratos").get() as { n: number };
  if (countRow.n === 0) {
    type ContratosJson = {
      contratos?: Array<{
        id: string;
        nome: string;
        fornecedor?: string;
        valorMensal: number;
        inicio?: string | null;
        fim?: string | null;
        ativo: boolean;
        observacao?: string;
      }>;
    };
    const file = tryReadJson<ContratosJson>(path.join(dataDir, "contratos.json"));
    const list = Array.isArray(file?.contratos) ? file.contratos : [];
    if (list.length) {
      const now = new Date().toISOString();
      const insert = db.prepare(
        `INSERT INTO contratos (
          id, nome, fornecedor, valor_mensal, inicio, fim, ativo, observacao, created_at, updated_at
        ) VALUES (
          @id, @nome, @fornecedor, @valor_mensal, @inicio, @fim, @ativo, @observacao, @created_at, @updated_at
        )`,
      );
      const tx = db.transaction(() => {
        for (const c of list) {
          insert.run({
            id: c.id,
            nome: c.nome,
            fornecedor: c.fornecedor ?? null,
            valor_mensal: c.valorMensal,
            inicio: c.inicio ?? null,
            fim: c.fim ?? null,
            ativo: c.ativo ? 1 : 0,
            observacao: c.observacao ?? null,
            created_at: now,
            updated_at: now,
          });
        }
      });
      tx();
    }
  }
}

function migrate(db: Database.Database) {
  db.exec(SCHEMA_SQL);
  const applied = db
    .prepare("SELECT id FROM schema_migrations WHERE name = ?")
    .get(MIGRATION_NAME);
  if (!applied) {
    seedFromJsonFiles(db);
    db.prepare("INSERT INTO schema_migrations (id, name, applied_at) VALUES (1, ?, ?)").run(
      MIGRATION_NAME,
      new Date().toISOString(),
    );
  } else {
    // Garante linha singleton mesmo se migration já rodou sem seed completo.
    const parqueRow = db.prepare("SELECT id FROM parque_meta WHERE id = 1").get();
    if (!parqueRow) {
      seedFromJsonFiles(db);
    }
  }
}

export function getDb(): Database.Database {
  if (globalThis.__aionSqlite) return globalThis.__aionSqlite;

  const filePath = resolveDatabasePath();
  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);

  globalThis.__aionSqlite = db;
  return db;
}

export function getDatabaseFilePath(): string {
  return resolveDatabasePath();
}
