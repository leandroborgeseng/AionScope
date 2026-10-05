import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { closeDbForTests } from "../db/client";
import {
  editarOrdemSala,
  listarOrdensCompra,
  marcarEntregue,
  resumoOrdensCompraTv,
  upsertOrdemCompra,
} from "./store";
import { parseOrdemCompra, parseSalaPatch } from "./validate";

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
  assert.equal(primeira.ordem.data_entrega, null);

  const segunda = upsertOrdemCompra(
    parsed({
      numero_ordem: "OC-100",
      status: "ordem_gerada",
      fornecedor: "ACME Ltda",
      valor_total: "12.50",
      data_ordem: "2026-10-01",
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

test("edição manual de categoria / OS / entrega não é sobrescrita pelo robô", () => {
  upsertOrdemCompra(
    parsed({
      numero_ordem: "OC-200",
      categoria: "Outros",
      fornecedor: "Beta",
      numero_os: "111",
    }),
  );
  const editada = editarOrdemSala("OC-200", {
    categoria: "Instrumental",
    numero_os: "999888777",
    data_entrega: "2026-10-05",
    itens_entregues: "2 pinças",
  });
  assert.ok(editada);
  assert.equal(editada.categoria, "Instrumental");
  assert.equal(editada.numero_os, "999888777");
  assert.equal(editada.data_entrega, "2026-10-05");
  assert.equal(editada.itens_entregues, "2 pinças");
  assert.equal(editada.editado_manualmente.categoria, true);
  assert.equal(editada.editado_manualmente.numero_os, true);
  assert.equal(editada.editado_manualmente.data_entrega, true);

  const robot = upsertOrdemCompra(
    parsed({
      numero_ordem: "OC-200",
      categoria: "Equipamentos Médicos",
      fornecedor: "Beta SA",
      numero_os: "000",
    }),
  );
  assert.equal(robot.created, false);
  assert.equal(robot.ordem.categoria, "Instrumental");
  assert.equal(robot.ordem.numero_os, "999888777");
  assert.equal(robot.ordem.data_entrega, "2026-10-05");
  assert.equal(robot.ordem.itens_entregues, "2 pinças");
  assert.equal(robot.ordem.fornecedor, "Beta SA");
});

test("listagem filtra sem valor, mês, OS e abertas", () => {
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
  marcarEntregue("OC-301", "kit completo", "2026-04-20");

  const semValor = listarOrdensCompra({ page: 1, page_size: 50, sem_valor: true });
  assert.ok(semValor.itens.some((o) => o.numero_ordem === "OC-300"));
  assert.ok(!semValor.itens.some((o) => o.numero_ordem === "OC-301"));

  const mes = listarOrdensCompra({ page: 1, page_size: 50, mes: "2026-03" });
  assert.ok(mes.itens.some((o) => o.numero_ordem === "OC-300"));
  assert.ok(!mes.itens.some((o) => o.numero_ordem === "OC-301"));

  const osFiltro = listarOrdensCompra({ page: 1, page_size: 50, os: "123456" });
  assert.ok(osFiltro.itens.some((o) => o.numero_ordem === "OC-300"));

  const abertas = listarOrdensCompra({ page: 1, page_size: 50, abertas: true });
  assert.ok(abertas.itens.some((o) => o.numero_ordem === "OC-300"));
  assert.ok(!abertas.itens.some((o) => o.numero_ordem === "OC-301"));
});

test("resumo TV: aberta aparece; entregue sai; contadores", () => {
  upsertOrdemCompra(
    parsed({
      numero_ordem: "OC-TV-1",
      status: "solicitado",
      data_pedido: "2026-09-01",
      fornecedor: "Gamma",
      categoria: "Instrumental",
      valor_total: "100.00",
    }),
  );
  upsertOrdemCompra(
    parsed({
      numero_ordem: "OC-TV-2",
      status: "ordem_gerada",
      data_pedido: "2026-09-10",
      data_ordem: "2026-09-15",
      fornecedor: "Delta",
      numero_os: "555",
      valor_total: "50.00",
    }),
  );

  const agora = new Date("2026-10-05T12:00:00");
  let resumo = resumoOrdensCompraTv(agora);
  assert.ok(resumo.pedidos.some((p) => p.numeroOrdem === "OC-TV-1"));
  assert.ok(resumo.pedidos.some((p) => p.numeroOrdem === "OC-TV-2"));
  assert.ok(resumo.aguardaResposta >= 1);
  assert.ok(resumo.aguardaEntrega >= 1);

  marcarEntregue("OC-TV-1", "tudo", "2026-10-03");
  resumo = resumoOrdensCompraTv(agora);
  assert.ok(!resumo.pedidos.some((p) => p.numeroOrdem === "OC-TV-1"));
  assert.ok(resumo.pedidos.some((p) => p.numeroOrdem === "OC-TV-2"));
  assert.ok(resumo.entreguesMes >= 1);
});

test("parseSalaPatch aceita OS, entrega e marcar_entregue", () => {
  const ok = parseSalaPatch({
    numero_ordem: "OC-x",
    numero_os: "123",
    marcar_entregue: true,
    itens_entregues: "2 un",
  });
  assert.equal(ok.ok, true);
  if (!ok.ok) throw new Error("fail");
  assert.equal(ok.patch.numero_os, "123");
  assert.equal(ok.patch.itens_entregues, "2 un");
  assert.ok(ok.patch.data_entrega);
});

test("fora_escopo: sai da TV, filtro excluidas, robô não reabre status", () => {
  upsertOrdemCompra(
    parsed({
      numero_ordem: "OC-FE-1",
      status: "ordem_gerada",
      data_pedido: "2026-09-01",
      data_ordem: "2026-09-05",
      fornecedor: "Outro Cliente SA",
      valor_total: "80.00",
    }),
  );

  const agora = new Date("2026-10-05T12:00:00");
  let resumo = resumoOrdensCompraTv(agora);
  assert.ok(resumo.pedidos.some((p) => p.numeroOrdem === "OC-FE-1"));

  const marcada = editarOrdemSala("OC-FE-1", {
    marcar_fora_escopo: true,
    motivo_exclusao: "outro cliente",
  });
  assert.ok(marcada);
  assert.equal(marcada.status, "fora_escopo");
  assert.equal(marcada.motivo_exclusao, "outro cliente");
  assert.equal(marcada.editado_manualmente.status, true);
  assert.equal(marcada.editado_manualmente.motivo_exclusao, true);

  resumo = resumoOrdensCompraTv(agora);
  assert.ok(!resumo.pedidos.some((p) => p.numeroOrdem === "OC-FE-1"));

  const abertas = listarOrdensCompra({ page: 1, page_size: 50, abertas: true });
  assert.ok(!abertas.itens.some((o) => o.numero_ordem === "OC-FE-1"));

  const excluidas = listarOrdensCompra({ page: 1, page_size: 50, excluidas: true });
  assert.ok(excluidas.itens.some((o) => o.numero_ordem === "OC-FE-1"));

  const robot = upsertOrdemCompra(
    parsed({
      numero_ordem: "OC-FE-1",
      status: "ordem_gerada",
      fornecedor: "Outro Cliente SA",
    }),
  );
  assert.equal(robot.ordem.status, "fora_escopo");
  assert.equal(robot.ordem.motivo_exclusao, "outro cliente");

  const restaurada = editarOrdemSala("OC-FE-1", { restaurar_tv: true });
  assert.ok(restaurada);
  assert.equal(restaurada.status, "ordem_gerada");
  assert.equal(restaurada.motivo_exclusao, null);

  resumo = resumoOrdensCompraTv(agora);
  assert.ok(resumo.pedidos.some((p) => p.numeroOrdem === "OC-FE-1"));
});

test("parseSalaPatch aceita marcar_fora_escopo, marcar_duplicada e restaurar_tv", () => {
  const fora = parseSalaPatch({
    numero_ordem: "OC-x",
    marcar_fora_escopo: true,
    motivo_exclusao: "não realizado",
  });
  assert.equal(fora.ok, true);
  if (!fora.ok) throw new Error("fail");
  assert.equal(fora.patch.marcar_fora_escopo, true);
  assert.equal(fora.patch.status, "fora_escopo");
  assert.equal(fora.patch.motivo_exclusao, "não realizado");

  const dup = parseSalaPatch({
    numero_ordem: "OC-x",
    marcar_duplicada: true,
    motivo_exclusao: "mesmo orçamento",
  });
  assert.equal(dup.ok, true);
  if (!dup.ok) throw new Error("fail");
  assert.equal(dup.patch.marcar_duplicada, true);
  assert.equal(dup.patch.status, "duplicada");
  assert.equal(dup.patch.motivo_exclusao, "mesmo orçamento");

  const volta = parseSalaPatch({ numero_ordem: "OC-x", restaurar_tv: true });
  assert.equal(volta.ok, true);
  if (!volta.ok) throw new Error("fail");
  assert.equal(volta.patch.restaurar_tv, true);
});

test("duplicada: sai da TV, filtro duplicadas, robô não reabre status", () => {
  upsertOrdemCompra(
    parsed({
      numero_ordem: "OC-DUP-1",
      status: "ordem_gerada",
      data_pedido: "2026-09-02",
      data_ordem: "2026-09-06",
      fornecedor: "Dup SA",
      valor_total: "80.00",
      numero_orcamento: "ORC-99",
    }),
  );
  upsertOrdemCompra(
    parsed({
      numero_ordem: "OC-DUP-2",
      status: "ordem_gerada",
      data_pedido: "2026-09-02",
      data_ordem: "2026-09-07",
      fornecedor: "Dup SA",
      valor_total: "80.00",
      numero_orcamento: "ORC-99",
    }),
  );

  const agora = new Date("2026-10-05T12:00:00");
  let resumo = resumoOrdensCompraTv(agora);
  assert.ok(resumo.pedidos.some((p) => p.numeroOrdem === "OC-DUP-1"));

  const marcada = editarOrdemSala("OC-DUP-1", {
    marcar_duplicada: true,
    motivo_exclusao: "mesmo orçamento ORC-99",
  });
  assert.ok(marcada);
  assert.equal(marcada.status, "duplicada");
  assert.equal(marcada.motivo_exclusao, "mesmo orçamento ORC-99");
  assert.equal(marcada.editado_manualmente.status, true);

  resumo = resumoOrdensCompraTv(agora);
  assert.ok(!resumo.pedidos.some((p) => p.numeroOrdem === "OC-DUP-1"));
  assert.ok(resumo.pedidos.some((p) => p.numeroOrdem === "OC-DUP-2"));

  const abertas = listarOrdensCompra({ page: 1, page_size: 50, abertas: true });
  assert.ok(!abertas.itens.some((o) => o.numero_ordem === "OC-DUP-1"));

  const duplicadas = listarOrdensCompra({ page: 1, page_size: 50, duplicadas: true });
  assert.ok(duplicadas.itens.some((o) => o.numero_ordem === "OC-DUP-1"));

  const porPedido = listarOrdensCompra({
    page: 1,
    page_size: 50,
    data_pedido_de: "2026-09-01",
    data_pedido_ate: "2026-09-03",
    ordenar: "data_pedido",
  });
  assert.ok(porPedido.itens.some((o) => o.numero_ordem === "OC-DUP-2"));

  const robot = upsertOrdemCompra(
    parsed({
      numero_ordem: "OC-DUP-1",
      status: "ordem_gerada",
      fornecedor: "Dup SA",
    }),
  );
  assert.equal(robot.ordem.status, "duplicada");

  const restaurada = editarOrdemSala("OC-DUP-1", { restaurar_tv: true });
  assert.ok(restaurada);
  assert.equal(restaurada.status, "ordem_gerada");
  assert.equal(restaurada.motivo_exclusao, null);
});
