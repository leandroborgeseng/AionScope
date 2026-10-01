import assert from "node:assert/strict";
import { after, test } from "node:test";
import { apagarCompra, criarCompraManual } from "./store";
import { resumoComprasTv } from "./sync";

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

test("resumoComprasTv conta abertos e SC", () => {
  const idAguarda = criarCompraManual({
    os: "100100100",
    equipamento: "Monitor",
    item: "Sensor",
    setor: "UTI",
    enviado_em: new Date().toISOString(),
  });
  ids.push(idAguarda);

  const idSc = criarCompraManual({
    os: "200200200",
    equipamento: "Bomba",
    item: "Equipo",
    setor: "CC",
    enviado_em: new Date().toISOString(),
    sc_numero: "777",
    sc_em: new Date().toISOString(),
  });
  ids.push(idSc);

  const resumo = resumoComprasTv(new Date());
  assert.ok(resumo.aguardaSc >= 1);
  assert.ok(resumo.aguardaEntrega >= 1);
  assert.ok(resumo.pedidos.some((p) => p.os === "100100100"));
  assert.ok(resumo.pedidos.some((p) => p.os === "200200200" && p.sc.includes("777")));
});
