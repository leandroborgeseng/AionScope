import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../schema";
import { closeDbForTests } from "../client";
import { aplicarMigration009ContratosProprios } from "./009_contratos_proprios";
import { aplicarMigration010ContratosInativadoEm } from "./010_contratos_inativado_em";
import { aplicarMigration013ContratosSuspensao } from "./013_contratos_suspensao";
import { readContrato, setContratoInativacao, setContratoSuspensao, upsertContrato } from "@/lib/cadastros/store";

const COLS = "id, nome, fornecedor, valor_mensal, inicio, fim, ativo, observacao, tipo, equipamento, numero, chave_importacao, inativado_em";
const checksum = (db: Database.Database) =>
  createHash("sha256").update(JSON.stringify(db.prepare(`SELECT ${COLS} FROM contratos ORDER BY id`).all())).digest("hex");

function banco010(file: string) {
  const db = new Database(file);
  db.exec(SCHEMA_SQL);
  aplicarMigration009ContratosProprios(db);
  aplicarMigration010ContratosInativadoEm(db);
  const ins = db.prepare("INSERT INTO contratos (id, nome, fornecedor, valor_mensal, inicio, fim, ativo, tipo, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)");
  for (let i = 0; i < 5; i++) ins.run(`m${i}`, `M${i}`, "F", 1000 + i, "2026-01-01", null, 1, "MANUTENCAO", "2026-10-20T00:00:00Z", "2026-10-20T00:00:00Z");
  return db;
}

test("013 aplicada 2x: aditiva, idempotente, dados iguais, colunas nulas", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "m013-"));
  try {
    const db = banco010(path.join(dir, "t.sqlite"));
    const antes = checksum(db);
    aplicarMigration013ContratosSuspensao(db);
    aplicarMigration013ContratosSuspensao(db);
    assert.equal(checksum(db), antes);
    const r = db.prepare("SELECT COUNT(*) n, COUNT(suspenso_de) a, COUNT(suspenso_ate) b FROM contratos").get();
    assert.deepEqual(r, { n: 5, a: 0, b: 0 });
    const n = db.prepare("SELECT COUNT(*) n FROM schema_migrations WHERE name = '013_contratos_suspensao'").get() as { n: number };
    assert.equal(n.n, 1);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("store: suspensão grava/limpa; inativação com data efetiva; edição completa preserva suspensão", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "m013b-"));
  const old = process.env.DATABASE_PATH;
  try {
    const file = path.join(dir, "t.sqlite");
    banco010(file).close();
    process.env.DATABASE_PATH = file;
    closeDbForTests();
    const s = setContratoSuspensao("m0", "2026-07-01", "2027-06-30")!;
    assert.equal(s.suspensoDe, "2026-07-01");
    assert.equal(s.suspensoAte, "2027-06-30");
    const e = upsertContrato({ ...s, equipamento: "OUTRO" });
    assert.equal(e.suspensoDe, "2026-07-01");
    assert.equal(setContratoSuspensao("m0", null, null)!.suspensoDe, null);
    const i = setContratoInativacao("m1", null)!;
    assert.equal(i.ativo, false);
    assert.equal(i.inativadoEm, null);
    assert.equal(setContratoInativacao("m2", "2026-03-31")!.inativadoEm, "2026-03-31T23:59:59-03:00");
    assert.equal(setContratoInativacao("nao-existe", null), null);
    assert.equal(readContrato("m3")!.suspensoDe, null);
  } finally {
    closeDbForTests();
    if (old === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = old;
    rmSync(dir, { recursive: true, force: true });
  }
});
