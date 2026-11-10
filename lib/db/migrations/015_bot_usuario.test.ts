import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import Database from "better-sqlite3";
import { closeDbForTests, getDb } from "../client";
import { aplicarMigration015BotUsuario } from "./015_bot_usuario";

const TELEFONE = "+5511900000001";

function banco() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);
  return db;
}

function inserir(
  db: Database.Database,
  id: string,
  situacao: string,
) {
  db.prepare(
    `INSERT INTO bot_usuario (
      id, nome, papel, telefone_e164, situacao, dono, criado_em, atualizado_em
    ) VALUES (?, 'Ana Exemplo', 'Compras', ?, ?, 'dpo', '2026-11-10T00:00:00.000Z', '2026-11-10T00:00:00.000Z')`,
  ).run(id, TELEFONE, situacao);
}

test("015 duas vezes: idempotente, colunas novas, índice único só de aprovados", () => {
  const db = banco();
  aplicarMigration015BotUsuario(db);
  aplicarMigration015BotUsuario(db);

  const n = db.prepare("SELECT COUNT(*) n FROM schema_migrations WHERE name = '015_bot_usuario'").get() as { n: number };
  assert.equal(n.n, 1);

  const cols = (db.prepare("PRAGMA table_info(bot_usuario)").all() as Array<{ name: string }>).map((c) => c.name);
  for (const coluna of ["email", "setor", "outros_setores", "aprovado_por", "telefone_e164", "verificado_em"]) {
    assert.ok(cols.includes(coluna), coluna);
  }
  assert.equal(cols.includes("setores_adicionais"), false);

  const auditoria = (db.prepare("PRAGMA table_info(bot_auditoria)").all() as Array<{ name: string }>).map((c) => c.name);
  for (const proibida of ["telefone", "email", "setor", "outros_setores", "corpo", "nome", "payload"]) {
    assert.equal(auditoria.includes(proibida), false, proibida);
  }

  const indice = db
    .prepare("SELECT sql FROM sqlite_master WHERE name = 'idx_bot_usuario_telefone_aprovado'")
    .get() as { sql: string };
  assert.match(indice.sql, /UNIQUE/);
  assert.match(indice.sql, /ativo/);
  assert.match(indice.sql, /inativo/);

  inserir(db, "p1", "pendente");
  inserir(db, "p2", "pendente");
  inserir(db, "r1", "recusado");
  inserir(db, "a1", "ativo");
  assert.throws(() => inserir(db, "a2", "ativo"));
  assert.throws(() => inserir(db, "i1", "inativo"));
  db.close();
});

test("getDb aplica 015 uma vez e preserva o índice parcial", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "m015-"));
  const antigo = process.env.DATABASE_PATH;
  try {
    process.env.DATABASE_PATH = path.join(dir, "t.sqlite");
    closeDbForTests();
    const db = getDb();
    getDb();
    const n = db.prepare("SELECT COUNT(*) n FROM schema_migrations WHERE name = '015_bot_usuario'").get() as { n: number };
    assert.equal(n.n, 1);
    const indice = db
      .prepare("SELECT sql FROM sqlite_master WHERE name = 'idx_bot_usuario_telefone_aprovado'")
      .get() as { sql: string };
    assert.match(indice.sql, /WHERE situacao IN \('ativo', 'inativo'\)/);
  } finally {
    closeDbForTests();
    if (antigo === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = antigo;
    rmSync(dir, { recursive: true, force: true });
  }
});

after(() => {
  closeDbForTests();
});
