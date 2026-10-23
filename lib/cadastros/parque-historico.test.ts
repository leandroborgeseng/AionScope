import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const dir = mkdtempSync(path.join(os.tmpdir(), "parque-hist-"));
process.env.DATABASE_PATH = path.join(dir, "t.sqlite");

import { getDb } from "@/lib/db/client";
import { aplicarMigration014ParqueHistorico } from "@/lib/db/migrations/014_parque_historico";
import { readParqueMeta } from "./store";
import { gravarValorParque, lerHistoricoParque } from "./parque-historico";
import { isConsultaValorParque } from "@/lib/pbi/scheduler";
import type { EquipamentoItem } from "@/lib/pbi/types";

const eq = (Tag: string, ValorDeSubstituicao: string) => ({ Id: 1, Tag, Equipamento: "Demo", ValorDeSubstituicao }) as unknown as EquipamentoItem;

test("migração 014 é idempotente e aditiva", () => {
  const db = getDb();
  const antes = readParqueMeta();
  aplicarMigration014ParqueHistorico(db);
  aplicarMigration014ParqueHistorico(db);
  assert.equal((db.prepare("SELECT COUNT(*) n FROM schema_migrations WHERE name='014_parque_historico'").get() as { n: number }).n, 1);
  assert.deepEqual(readParqueMeta(), antes);
});

test("P1/P4: grava soma dos ativos com valor e registra o valor anterior sem apagar histórico", () => {
  const anterior = readParqueMeta();
  const r1 = gravarValorParque([eq("DEMO-1", "100.000,50"), eq("DEMO-2", "200.000,00"), eq("DEMO-3", "")], { origem: "agendador", agora: new Date("2026-10-01T12:00:00Z") });
  assert.equal(r1.meta.valorApi, 300_000.5);
  assert.equal(r1.meta.atualizadoEm, "2026-10-01T12:00:00.000Z");
  const r2 = gravarValorParque([eq("DEMO-1", "150.000,00")], { origem: "manual", atualizadoPor: "teste", agora: new Date("2026-11-01T02:00:00Z") });
  assert.equal(r2.meta.valorApi, 150_000);
  const h = lerHistoricoParque();
  assert.equal(h.length, 2);
  assert.equal(h[0].valorAnterior, 300_000.5);
  assert.equal(h[0].valorNovo, 150_000);
  assert.equal(h[0].competencia, "2026-10");
  assert.equal(h[0].origem, "manual");
  assert.equal(h[1].valorAnterior, anterior.valorApi);
  assert.equal(h[1].itensComValor, 2);
  assert.equal(h[1].itensTotal, 3);
  assert.equal(h[1].atualizadoEmAnterior, anterior.atualizadoEm);
});

test("P1: agendador reconhece só a consulta do card (ativos + substituição)", () => {
  assert.equal(isConsultaValorParque("equipamentos", "apenasAtivos=true&incluirComponentes=false&incluirCustoSubstituicao=true"), true);
  assert.equal(isConsultaValorParque("equipamentos", "apenasAtivos=false&incluirComponentes=false&incluirCustoSubstituicao=false"), false);
  assert.equal(isConsultaValorParque("os-analitico", "apenasAtivos=true&incluirComponentes=false&incluirCustoSubstituicao=true"), false);
});

import { lerParqueMensal } from "./parque-historico";
test("P6: uma foto por mês (último valor do mês, chave YYYY-MM BRT)", () => {
  gravarValorParque([eq("DEMO-1", "500.000,00")], { origem: "agendador", agora: new Date("2026-11-10T12:00:00Z") });
  gravarValorParque([eq("DEMO-1", "600.000,00")], { origem: "agendador", agora: new Date("2026-11-20T12:00:00Z") });
  const m = lerParqueMensal();
  assert.deepEqual(m.map((r) => [r.competencia, r.valor]), [["2026-10", 150_000], ["2026-11", 600_000]]);
});
