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

test("020 cria a tabela de corte e não duplica a migration", () => {
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
    ["id", "emitidas_ate"],
  );
  const linhas = db.prepare("SELECT COUNT(*) n FROM painel_sessao_revogacao").get() as { n: number };
  assert.equal(linhas.n, 0);
  db.close();
});
