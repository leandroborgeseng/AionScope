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
import { readContrato, setContratoAtivo, upsertContrato } from "@/lib/cadastros/store";

const COLS = "id, nome, fornecedor, valor_mensal, inicio, fim, ativo, observacao, tipo, equipamento, numero, chave_importacao";

function checksum(db: Database.Database) {
  const rows = db.prepare(`SELECT ${COLS} FROM contratos ORDER BY id`).all();
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

/** Banco pós-009 com 16 contratos (valores fictícios) — 10 Manutenção somando 124.004,14, 6 Locação. */
function banco009(file: string) {
  const db = new Database(file);
  db.exec(SCHEMA_SQL);
  aplicarMigration009ContratosProprios(db);
  const ins = db.prepare(
    "INSERT INTO contratos (id, nome, fornecedor, valor_mensal, inicio, fim, ativo, tipo, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
  );
  const man = [12400.41, 12400.41, 12400.41, 12400.41, 12400.41, 12400.41, 12400.41, 12400.41, 12400.41, 12400.45];
  man.forEach((v, i) => ins.run(`m${i}`, `M${i}`, "F", v, "2026-01-01", null, 1, "MANUTENCAO", "2026-10-20T00:00:00Z", "2026-10-20T00:00:00Z"));
  for (let i = 0; i < 6; i++) ins.run(`l${i}`, `L${i}`, "F", 7015.81, "2026-01-01", null, 1, "LOCACAO", "2026-10-20T00:00:00Z", "2026-10-20T00:00:00Z");
  return db;
}

test("C6 010 aplicada 2x: aditiva, idempotente, 16 contratos e R$ 124.004,14 Manutenção iguais", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "m010-"));
  try {
    const db = banco009(path.join(dir, "t.sqlite"));
    const antes = checksum(db);
    aplicarMigration010ContratosInativadoEm(db);
    aplicarMigration010ContratosInativadoEm(db);
    assert.equal(checksum(db), antes);
    const cols = (db.prepare("PRAGMA table_info(contratos)").all() as Array<{ name: string }>).map((c) => c.name);
    assert.ok(cols.includes("inativado_em"));
    const r = db.prepare("SELECT COUNT(*) n, ROUND(SUM(CASE WHEN tipo='MANUTENCAO' THEN valor_mensal END), 2) m, COUNT(inativado_em) d FROM contratos").get() as { n: number; m: number; d: number };
    assert.deepEqual(r, { n: 16, m: 124004.14, d: 0 });
    const n = db.prepare("SELECT COUNT(*) n FROM schema_migrations WHERE name = '010_contratos_inativado_em'").get() as { n: number };
    assert.equal(n.n, 1);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("C5 store: inativar grava inativado_em BRT; reinativar mantém; reativar limpa; edição completa respeita transição", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "m010b-"));
  const file = path.join(dir, "t.sqlite");
  const old = process.env.DATABASE_PATH;
  try {
    banco009(file).close();
    process.env.DATABASE_PATH = file;
    closeDbForTests();
    const ina = setContratoAtivo("m0", false)!;
    assert.equal(ina.ativo, false);
    assert.match(ina.inativadoEm ?? "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/);
    const primeira = ina.inativadoEm;
    assert.equal(setContratoAtivo("m0", false)!.inativadoEm, primeira, "inativo→inativo mantém a data");
    const re = setContratoAtivo("m0", true)!;
    assert.equal(re.ativo, true);
    assert.equal(re.inativadoEm, null);

    const c = readContrato("m1")!;
    const viaEdicao = upsertContrato({ ...c, ativo: false });
    assert.ok(viaEdicao.inativadoEm, "PATCH completo ativo→false grava data");
    assert.equal(upsertContrato({ ...viaEdicao, nome: "outro" }).inativadoEm, viaEdicao.inativadoEm);
    assert.equal(upsertContrato({ ...viaEdicao, ativo: true }).inativadoEm, null);
  } finally {
    closeDbForTests();
    if (old === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = old;
    rmSync(dir, { recursive: true, force: true });
  }
});
