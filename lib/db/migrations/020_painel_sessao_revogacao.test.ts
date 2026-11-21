import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { aplicarMigration020PainelSessaoRevogacao } from "./020_painel_sessao_revogacao";

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

test("020 cria a tabela de jti e não duplica a migration", () => {
  const db = banco();
  aplicarMigration020PainelSessaoRevogacao(db);
  aplicarMigration020PainelSessaoRevogacao(db);
  const n = db.prepare("SELECT COUNT(*) n FROM schema_migrations WHERE name = '020_painel_sessao_revogacao'").get() as {
    n: number;
  };
  assert.equal(n.n, 1);
  const cols = db.prepare("PRAGMA table_info(painel_sessao_revogacao)").all() as Array<{ name: string }>;
  assert.deepEqual(
    cols.map((coluna) => coluna.name),
    ["jti", "revogada_em"],
  );
  const linhas = db.prepare("SELECT COUNT(*) n FROM painel_sessao_revogacao").get() as { n: number };
  assert.equal(linhas.n, 0);
  db.close();
});

test("020 em banco com o corte global acrescenta a tabela de jti e preserva a linha antiga", () => {
  const db = banco();
  db.exec(`
    CREATE TABLE painel_sessao_revogacao (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      emitidas_ate INTEGER NOT NULL
    );
  `);
  db.prepare("INSERT INTO schema_migrations (id, name, applied_at) VALUES (20, '020_painel_sessao_revogacao', ?)").run(
    "2026-01-01T00:00:00.000Z",
  );
  db.prepare("INSERT INTO painel_sessao_revogacao (id, emitidas_ate) VALUES (1, 100)").run();
  aplicarMigration020PainelSessaoRevogacao(db);
  const cols = db.prepare("PRAGMA table_info(painel_sessao_jti)").all() as Array<{ name: string }>;
  assert.deepEqual(
    cols.map((coluna) => coluna.name),
    ["jti", "revogada_em"],
  );
  const antiga = db.prepare("SELECT emitidas_ate AS ate FROM painel_sessao_revogacao WHERE id = 1").get() as {
    ate: number;
  };
  assert.equal(antiga.ate, 100);
  const n = db.prepare("SELECT COUNT(*) n FROM schema_migrations WHERE name = '020_painel_sessao_revogacao'").get() as {
    n: number;
  };
  assert.equal(n.n, 1);
  db.close();
});
