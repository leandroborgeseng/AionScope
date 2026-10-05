import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLote, parseOrdemCompra } from "./validate";

test("rejeita numero_ordem ausente", () => {
  const r = parseOrdemCompra({ fornecedor: "ACME" });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.error.status, 400);
  assert.ok(r.error.detalhes.some((d) => d.campo === "numero_ordem"));
});

test("rejeita enum desconhecido com 422", () => {
  const r = parseOrdemCompra({ numero_ordem: "OC-1", status: "aberto" });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.error.status, 422);
  assert.ok(r.error.detalhes.some((d) => d.campo === "status"));
});

test("aceita status fora_escopo e duplicada", () => {
  const fora = parseOrdemCompra({ numero_ordem: "OC-FE", status: "fora_escopo" });
  assert.equal(fora.ok, true);
  if (!fora.ok) return;
  assert.equal(fora.data.campos.status, "fora_escopo");

  const dup = parseOrdemCompra({ numero_ordem: "OC-DUP", status: "duplicada" });
  assert.equal(dup.ok, true);
  if (!dup.ok) return;
  assert.equal(dup.data.campos.status, "duplicada");
});

test("rejeita dinheiro com vírgula", () => {
  const r = parseOrdemCompra({ numero_ordem: "OC-1", valor_total: "10,50" });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.error.status, 400);
});

test("aceita nulos e decimal com ponto", () => {
  const r = parseOrdemCompra({
    numero_ordem: "OC-99",
    status: "solicitado",
    categoria: "Instrumental",
    valor_total: "1234.56",
    fornecedor: null,
    itens: [{ descricao: "Pinça", quantidade: 2, valor_unitario: "10.5", valor_total: "21.0" }],
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.data.campos.valor_total, "1234.56");
  assert.equal(r.data.campos.fornecedor, null);
  assert.equal(r.data.itens?.length, 1);
});

test("lote recusa mais de 500", () => {
  const r = parseLote({ ordens: Array.from({ length: 501 }, (_, i) => ({ numero_ordem: String(i) })) });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.error.status, 400);
});
