import { test } from "node:test";
import assert from "node:assert/strict";
import { queryErrorMessage } from "@/lib/pbi/query-error";
import { buildCustoParqueAno } from "@/lib/pbi/custo-manutencao-parque";

test("sem erro: null", () => {
  assert.equal(queryErrorMessage({ ok: true }, null), null);
  assert.equal(queryErrorMessage(undefined, null), null);
});
test("payload ok:false", () => {
  assert.equal(queryErrorMessage({ ok: false, message: "500" }, null), "500");
  assert.equal(queryErrorMessage({ ok: false }, null, "fb"), "fb");
});
test("falha de rede/timeout do react-query (sem data)", () => {
  assert.equal(queryErrorMessage(undefined, new TypeError("Failed to fetch")), "Failed to fetch");
  assert.equal(queryErrorMessage(undefined, new Error("")), "falha ao consultar a fonte de dados");
  assert.equal(queryErrorMessage(undefined, { x: 1 }, "fb"), "fb");
});
test("erro de rede vira avulsos indisponíveis: sem %, sem status", () => {
  const avulsosDisponiveis = queryErrorMessage(undefined, new TypeError("Failed to fetch")) == null;
  const months = Array.from({ length: 12 }, (_, m) => ({ year: 2026, month: m }));
  const ind = buildCustoParqueAno({
    year: 2026,
    months: months as never,
    contratos: [],
    gastoMonths: [] as never,
    valorParque: 57_000_000,
    avulsosDisponiveis,
    mesAtual: 9,
  });
  assert.ok(ind.faltando.includes("custos avulsos indisponíveis"));
  assert.equal(ind.atual?.status ?? null, null);
  assert.equal(ind.atual?.pctAcumulado ?? null, null);
});
