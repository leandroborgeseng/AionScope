import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../db/schema";
import { aplicarMigration009ContratosProprios } from "../db/migrations/009_contratos_proprios";
import {
  CSV_20_10_SHA256,
  importarContratos,
  parseCsvContratos,
  sha256,
  totaisConferem,
  totaisImportadosNoBanco,
  totaisLinhas,
} from "./importar-contratos";

// CSV fictício (o real não vai para o repositório público). Duas linhas com mesmo fornecedor/equipamento.
const FICTICIO = [
  "fornecedor;equipamento;valor_mensal;tipo",
  "ACME;BOMBA;100.50;Manutenção",
  "ACME;BOMBA;200.00;Manutenção",
  "BETA;CAMA;50;Locação",
].join("\n");

function novoBanco() {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  aplicarMigration009ContratosProprios(db);
  return db;
}

test("parse: chaves por linha, centavos exatos, tipo normalizado", () => {
  const l = parseCsvContratos(FICTICIO, "teste");
  assert.deepEqual(l.map((x) => x.chave), ["teste:1", "teste:2", "teste:3"]);
  assert.equal(l[0].valorCentavos, 10050);
  assert.equal(l[2].tipo, "LOCACAO");
  const t = totaisLinhas(l);
  assert.equal(t.MANUTENCAO.centavos, 30050);
  assert.equal(t.TOTAL.qtde, 3);
});

test("parse rejeita cabeçalho, tipo e valor inválidos", () => {
  assert.throws(() => parseCsvContratos("a;b;c;d\nX;Y;1;Manutenção"));
  assert.throws(() => parseCsvContratos("fornecedor;equipamento;valor_mensal;tipo\nX;Y;1;Serviço"));
  assert.throws(() => parseCsvContratos("fornecedor;equipamento;valor_mensal;tipo\nX;Y;-1;Locação"));
  assert.throws(() => parseCsvContratos("fornecedor;equipamento;valor_mensal;tipo\nX;Y;;Locação"));
});

test("importação idempotente: 2x não duplica e não sobrescreve edição", () => {
  const db = novoBanco();
  const l = parseCsvContratos(FICTICIO, "teste");
  const r1 = importarContratos(db, l, { dryRun: false });
  assert.equal(r1.inseridos.length, 3);
  db.prepare("UPDATE contratos SET fim = '2026-06-30' WHERE chave_importacao = 'teste:1'").run();
  const r2 = importarContratos(db, l, { dryRun: false });
  assert.equal(r2.inseridos.length, 0);
  assert.equal(r2.existentes.length, 3);
  assert.equal((db.prepare("SELECT COUNT(*) n FROM contratos").get() as { n: number }).n, 3);
  const fim = db.prepare("SELECT fim FROM contratos WHERE chave_importacao = 'teste:1'").get() as { fim: string };
  assert.equal(fim.fim, "2026-06-30");
  const acme = db.prepare("SELECT COUNT(*) n FROM contratos WHERE fornecedor = 'ACME'").get() as { n: number };
  assert.equal(acme.n, 2, "linhas iguais de fornecedor/equipamento ficam separadas");
});

test("dry-run não grava", () => {
  const db = novoBanco();
  const r = importarContratos(db, parseCsvContratos(FICTICIO, "teste"), { dryRun: true });
  assert.equal(r.inseridos.length, 3);
  assert.equal((db.prepare("SELECT COUNT(*) n FROM contratos").get() as { n: number }).n, 0);
});

test("importação real exige migration 009", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  assert.throws(() => importarContratos(db, parseCsvContratos(FICTICIO), { dryRun: false }), /009/);
});

// Com o CSV real disponível localmente (CONTRATOS_CSV), confere hash, totais e 2x = 16.
const csvReal = process.env.CONTRATOS_CSV;
test("CSV real 20/10: sha256, totais 10/6/16 e reimportação = 16", { skip: !csvReal || !existsSync(csvReal) }, () => {
  const bruto = readFileSync(csvReal!);
  assert.equal(sha256(bruto), CSV_20_10_SHA256);
  const l = parseCsvContratos(bruto.toString("utf8"));
  assert.ok(totaisConferem(totaisLinhas(l)));
  const db = novoBanco();
  importarContratos(db, l, { dryRun: false });
  importarContratos(db, l, { dryRun: false });
  const t = totaisImportadosNoBanco(db);
  assert.ok(totaisConferem(t));
  assert.equal(t.TOTAL.qtde, 16);
  const braun = db.prepare("SELECT valor_mensal v FROM contratos WHERE fornecedor = 'B BRAUN' ORDER BY v").all() as Array<{ v: number }>;
  assert.deepEqual(braun.map((b) => b.v), [9372.6, 25489.26]);
  const vig = db.prepare("SELECT DISTINCT inicio, fim FROM contratos").all();
  assert.deepEqual(vig, [{ inicio: "2026-01-01", fim: "2027-01-01" }]);
});
