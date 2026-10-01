import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
  apagarCompra,
  atualizarCompra,
  criarCompraManual,
  listarCompras,
  obterCompra,
} from "./store";

const ids: string[] = [];

after(() => {
  for (const id of ids) {
    try {
      apagarCompra(id);
    } catch {
      /* ignore */
    }
  }
});

test("CRUD manual de compra recalcula situação", () => {
  const id = criarCompraManual({
    os: "111222333",
    equipamento: "Monitor multiparamétrico",
    item: "Cabo SpO2",
    setor: "UTI",
    enviado_em: new Date().toISOString(),
  });
  ids.push(id);

  const criada = obterCompra(id);
  assert.ok(criada);
  assert.equal(criada.situacao, "aguarda SC");
  assert.ok(criada.conversation_id?.startsWith("manual:"));

  const comSc = atualizarCompra(id, {
    sc_numero: "9988",
    sc_em: new Date().toISOString(),
  });
  assert.equal(comSc.situacao, "aguarda entrega");
  assert.equal(comSc.sc_numero, "9988");

  const entregue = atualizarCompra(id, {
    entregue_em: new Date().toISOString(),
    origem_entrega: "manual",
  });
  assert.equal(entregue.situacao, "entregue");

  const lista = listarCompras();
  assert.ok(lista.some((c) => c.id === id));

  apagarCompra(id);
  ids.pop();
  assert.equal(obterCompra(id), undefined);
});
