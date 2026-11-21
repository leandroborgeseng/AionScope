import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { aplicarMigration019BotSetorApelido } from "./019_bot_setor_apelido";

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

test("019 duas vezes grava o apelido CC e não duplica a migration", () => {
  const db = banco();
  aplicarMigration019BotSetorApelido(db);
  aplicarMigration019BotSetorApelido(db);
  const n = db.prepare("SELECT COUNT(*) n FROM schema_migrations WHERE name = '019_bot_setor_apelido'").get() as { n: number };
  assert.equal(n.n, 1);
  const linhas = db.prepare("SELECT apelido, nome FROM bot_setor_apelido").all() as Array<{ apelido: string; nome: string }>;
  assert.deepEqual(linhas, [{ apelido: "CC", nome: "Centro Cirúrgico" }]);
  db.close();
});
