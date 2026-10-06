import assert from "node:assert/strict";
import test from "node:test";
import { idsOsAbertas, novasOsDesde } from "./novas-os";
import { snapshotDemoAgora } from "./snapshot-demo-agora";

test("primeiro snapshot não gera alerta de nova OS", () => {
  const ids = idsOsAbertas(snapshotDemoAgora());
  assert.ok(ids.includes("202609698"));
  assert.deepEqual(novasOsDesde(null, ids), []);
});

test("detecta OS nova na fila / detalhes e ignora as que já existiam", () => {
  const anterior = ["202609698", "202609701"];
  const atual = ["202609698", "202609701", "202609799"];
  assert.deepEqual(novasOsDesde(anterior, atual), ["202609799"]);
  assert.deepEqual(novasOsDesde(atual, atual), []);
});

test("idsOsAbertas junta fila, drill e osDetalhes abertas", () => {
  const snap = snapshotDemoAgora();
  const ids = idsOsAbertas(snap);
  assert.ok(ids.includes("202609722"));
  assert.ok(ids.includes("202608100"));
});
