import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import Database from "better-sqlite3";
import { closeDbForTests, getDb } from "../client";
import { aplicarMigration015BotUsuario } from "./015_bot_usuario";
import { aplicarMigration016BotEntrega } from "./016_bot_entrega";

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

test("016 duas vezes: idempotente e colunas com padrão pendente", () => {
  const db = banco();
  aplicarMigration015BotUsuario(db);
  aplicarMigration016BotEntrega(db);
  aplicarMigration016BotEntrega(db);
  const n = db.prepare("SELECT COUNT(*) n FROM schema_migrations WHERE name = '016_bot_entrega'").get() as { n: number };
  assert.equal(n.n, 1);
  const cols = (db.prepare("PRAGMA table_info(bot_usuario)").all() as Array<{ name: string; dflt_value: string | null }>).map(
    (coluna) => coluna.name,
  );
  for (const coluna of ["entrega_status", "entrega_pedido_em", "motivo_recusa"]) {
    assert.equal(cols.includes(coluna), true, coluna);
  }
  db.prepare(
    `INSERT INTO bot_usuario (
      id, nome, papel, telefone_e164, situacao, dono, criado_em, atualizado_em
    ) VALUES ('p1', 'Ana Exemplo', 'Compras', '+5511900000001', 'pendente', 'dpo', '2026-11-10T00:00:00.000Z', '2026-11-10T00:00:00.000Z')`,
  ).run();
  const linha = db.prepare("SELECT entrega_status, entrega_pedido_em, motivo_recusa FROM bot_usuario").get() as {
    entrega_status: string;
    entrega_pedido_em: string | null;
    motivo_recusa: string | null;
  };
  assert.deepEqual(linha, { entrega_status: "pendente", entrega_pedido_em: null, motivo_recusa: null });
  assert.throws(() => db.prepare("UPDATE bot_usuario SET entrega_status = 'xyz' WHERE id = 'p1'").run());
  const depois = db.prepare("SELECT entrega_status FROM bot_usuario WHERE id = 'p1'").get() as { entrega_status: string };
  assert.equal(depois.entrega_status, "pendente");
  db.close();
});

test("getDb aplica 016 uma vez", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "m016-"));
  const antigo = process.env.DATABASE_PATH;
  try {
    process.env.DATABASE_PATH = path.join(dir, "t.sqlite");
    closeDbForTests();
    const db = getDb();
    getDb();
    const n = db.prepare("SELECT COUNT(*) n FROM schema_migrations WHERE name = '016_bot_entrega'").get() as { n: number };
    assert.equal(n.n, 1);
  } finally {
    closeDbForTests();
    if (antigo === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = antigo;
    rmSync(dir, { recursive: true, force: true });
  }
});
