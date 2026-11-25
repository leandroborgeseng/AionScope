import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { aplicarMigration020PainelSessaoRevogada } from "./020_painel_sessao_revogada";

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

test("020 duas vezes cria a lista de revogados e não duplica a migration", () => {
  const db = banco();
  aplicarMigration020PainelSessaoRevogada(db);
  aplicarMigration020PainelSessaoRevogada(db);
  const n = db.prepare("SELECT COUNT(*) n FROM schema_migrations WHERE name = '020_painel_sessao_revogada'").get() as {
    n: number;
  };
  assert.equal(n.n, 1);
  const cols = db.prepare("PRAGMA table_info(painel_sessao_revogada)").all() as Array<{ name: string }>;
  assert.deepEqual(
    cols.map((c) => c.name),
    ["jti", "expira_em"],
  );
  db.prepare("INSERT INTO painel_sessao_revogada (jti, expira_em) VALUES ('jti-ficticio-de-teste', 1)").run();
  aplicarMigration020PainelSessaoRevogada(db);
  const ainda = db.prepare("SELECT jti FROM painel_sessao_revogada").get() as { jti: string };
  assert.equal(ainda.jti, "jti-ficticio-de-teste");
  db.close();
});
