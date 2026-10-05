import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { closeDbForTests } from "../db/client";
import { editarCategoriaManualmente, listarOrdensCompra, upsertOrdemCompra } from "./store";
import { parseOrdemCompra } from "./validate";

const dir = path.join(os.tmpdir(), `aion-oc-${process.pid}-${Date.now()}`);
let dbPath = "";

function parsed(body: Record<string, unknown>) {
  const r = parseOrdemCompra(body);
  assert.equal(r.ok, true);
  if (!r.ok) throw new Error("parse");
  return r.data;
}

before(() => {
  mkdirSync(dir, { recursive: true });
  dbPath = path.join(dir, "t.sqlite");
  process.env.DATABASE_PATH = dbPath;
  closeDbForTests();
});

after(() => {
  closeDbForTests();
  rmSync(dir, { recursive: true, force: true });
});

test("upsert é idempotente por numero_ordem", () => {
  const primeira = upsertOrdemCompra(
    parsed({
      numero_ordem: "OC-100",
      status: "solicitado",
      fornecedor: "ACME",
      valor_total: "10.00",
      itens: [{ descricao: "Item A", quantidade: 1 }],
    }),
  );
  assert.equal(primeira.created, true);
  assert.equal(primeira.ordem.fornecedor, "ACME");

  const segunda = upsertOrdemCompra(
    parsed({
      numero_ordem: "OC-100",
      status: "ordem_gerada",
      fornecedor: "ACME Ltda",
      valor_total: "12.50",
      itens: [
        { descricao: "Item A", quantidade: 1 },
        { descricao: "Item B", quantidade: 2 },
      ],
    }),
  );
  assert.equal(segunda.created, false);
  assert.equal(segunda.ordem.status, "ordem_gerada");
  assert.equal(segunda.ordem.fornecedor, "ACME Ltda");
  assert.equal(segunda.ordem.valor_total, "12.50");
  assert.equal(segunda.ordem.itens.length, 2);

  const lista = listarOrdensCompra({ page: 1, page_size: 50 });
  assert.equal(lista.itens.filter((o) => o.numero_ordem === "OC-100").length, 1);
});

test("edição manual de categoria não é sobrescrita pelo robô", () => {
  upsertOrdemCompra(
    parsed({
      numero_ordem: "OC-200",
      categoria: "Outros",
      fornecedor: "Beta",
    }),
  );
  const editada = editarCategoriaManualmente("OC-200", "Instrumental");
  assert.ok(editada);
  assert.equal(editada.categoria, "Instrumental");
  assert.equal(editada.editado_manualmente.categoria, true);

  const robot = upsertOrdemCompra(
    parsed({
      numero_ordem: "OC-200",
      categoria: "Equipamentos Médicos",
      fornecedor: "Beta SA",
    }),
  );
  assert.equal(robot.created, false);
  assert.equal(robot.ordem.categoria, "Instrumental");
  assert.equal(robot.ordem.fornecedor, "Beta SA");
  assert.equal(robot.ordem.editado_manualmente.categoria, true);
});

test("listagem filtra sem valor, mês e OS", () => {
  upsertOrdemCompra(
    parsed({
      numero_ordem: "OC-300",
      data_pedido: "2026-03-10",
      numero_os: "123456789",
      valor_total: null,
    }),
  );
  upsertOrdemCompra(
    parsed({
      numero_ordem: "OC-301",
      data_pedido: "2026-04-01",
      numero_os: "999",
      valor_total: "1.00",
    }),
  );

  const semValor = listarOrdensCompra({ page: 1, page_size: 50, sem_valor: true });
  assert.ok(semValor.itens.some((o) => o.numero_ordem === "OC-300"));
  assert.ok(!semValor.itens.some((o) => o.numero_ordem === "OC-301"));

  const mes = listarOrdensCompra({ page: 1, page_size: 50, mes: "2026-03" });
  assert.ok(mes.itens.some((o) => o.numero_ordem === "OC-300"));
  assert.ok(!mes.itens.some((o) => o.numero_ordem === "OC-301"));

  const osFiltro = listarOrdensCompra({ page: 1, page_size: 50, os: "123456" });
  assert.ok(osFiltro.itens.some((o) => o.numero_ordem === "OC-300"));
});
