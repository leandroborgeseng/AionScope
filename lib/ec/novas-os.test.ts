import assert from "node:assert/strict";
import test from "node:test";
import { idsOsAbertas, novasOsDesde } from "./novas-os";
import { snapshotDemoAgora } from "./snapshot-demo-agora";

test("primeiro snapshot não gera alerta de nova OS", () => {
  const ids = idsOsAbertas(snapshotDemoAgora());
  assert.ok(ids.includes("209909698"));
  assert.deepEqual(novasOsDesde(null, ids), []);
});

test("detecta OS nova na fila / detalhes e ignora as que já existiam", () => {
  const anterior = ["209909698", "209909701"];
  const atual = ["209909698", "209909701", "209909799"];
  assert.deepEqual(novasOsDesde(anterior, atual), ["209909799"]);
  assert.deepEqual(novasOsDesde(atual, atual), []);
});

test("idsOsAbertas junta fila, drill e osDetalhes abertas", () => {
  const snap = snapshotDemoAgora();
  const ids = idsOsAbertas(snap);
  assert.ok(ids.includes("209909722"));
  assert.ok(ids.includes("209908100"));
});
