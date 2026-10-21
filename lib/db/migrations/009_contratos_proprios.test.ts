import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../schema";
import { closeDbForTests, getDb } from "../client";
import { aplicarMigration009ContratosProprios } from "./009_contratos_proprios";

function checksum(db: Database.Database) {
  const rows = db
    .prepare(
      "SELECT id, nome, fornecedor, valor_mensal, inicio, fim, ativo, observacao, created_at, updated_at FROM contratos ORDER BY id",
    )
    .all();
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

function bancoAntigo(file: string) {
  const db = new Database(file);
  db.exec(SCHEMA_SQL); // schema pré-009: contratos sem tipo/equipamento/numero
  const ins = db.prepare(
    "INSERT INTO contratos (id, nome, fornecedor, valor_mensal, inicio, fim, ativo, observacao, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
  );
  ins.run("a", "Antigo 1", "X", 10.5, null, null, 1, null, "2025-01-01T00:00:00Z", "2025-01-01T00:00:00Z");
  ins.run("b", "Antigo 2", null, 20, "2025-01-01", "2025-12-31", 0, "obs", "2025-02-01T00:00:00Z", "2025-02-01T00:00:00Z");
  return db;
}

test("009 aplicada 2x sobre contratos antigos sem tipo: aditiva, idempotente, checksum igual", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "m009-"));
  try {
    const db = bancoAntigo(path.join(dir, "t.sqlite"));
    const antes = checksum(db);
    aplicarMigration009ContratosProprios(db);
    aplicarMigration009ContratosProprios(db);
    assert.equal(checksum(db), antes);
    const cols = (db.prepare("PRAGMA table_info(contratos)").all() as Array<{ name: string }>).map((c) => c.name);
    for (const c of ["tipo", "equipamento", "numero", "chave_importacao"]) assert.ok(cols.includes(c), c);
    const tipos = db.prepare("SELECT tipo FROM contratos").all() as Array<{ tipo: null }>;
    assert.ok(tipos.every((t) => t.tipo === null), "antigos ficam Sem tipo");
    const n = db.prepare("SELECT COUNT(*) n FROM schema_migrations WHERE name = '009_contratos_proprios'").get() as { n: number };
    assert.equal(n.n, 1);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("subida do app (getDb) 2x sobre banco antigo preserva linhas", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "m009b-"));
  const file = path.join(dir, "t.sqlite");
  const old = process.env.DATABASE_PATH;
  try {
    const db0 = bancoAntigo(file);
    const antes = checksum(db0);
    db0.close();
    process.env.DATABASE_PATH = file;
    for (let i = 0; i < 2; i++) {
      closeDbForTests();
      const db = getDb();
      assert.equal(checksum(db), antes);
      assert.equal((db.prepare("SELECT COUNT(*) n FROM contratos").get() as { n: number }).n, 2);
    }
  } finally {
    closeDbForTests();
    if (old === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = old;
    rmSync(dir, { recursive: true, force: true });
  }
});
