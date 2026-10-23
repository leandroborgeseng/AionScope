import assert from "node:assert/strict";
import { test } from "node:test";
import { competenciaBRT, equipamentosSemValor, escolherValorParque, formatDataBRT, frescorParque } from "./parque-frescor";
import type { EquipamentoItem } from "./types";

const eq = (Tag: string, ValorDeSubstituicao: string) => ({ Id: 1, Tag, Equipamento: "Equipamento Demo", Modelo: "M-DEMO", Setor: "Setor Demo", ValorDeSubstituicao }) as unknown as EquipamentoItem;

test("P2: soma ao vivo tem prioridade sobre o valor gravado", () => {
  assert.deepEqual(escolherValorParque({ aoVivo: 2_000_000, gravado: 1_000_000 }), { valor: 2_000_000, fonte: "ao-vivo" });
});
test("P2: valor gravado só como reserva quando a API falha", () => {
  assert.deepEqual(escolherValorParque({ aoVivo: null, gravado: 1_000_000 }), { valor: 1_000_000, fonte: "gravado" });
});
test("P6: parque 0 ou ausente => null (C11)", () => {
  assert.deepEqual(escolherValorParque({ aoVivo: 0, gravado: 0 }), { valor: null, fonte: null });
  assert.deepEqual(escolherValorParque({ aoVivo: undefined, gravado: null }), { valor: null, fonte: null });
});
test("P3: data em BRT (virada de dia UTC) e alerta acima de 30 dias", () => {
  assert.equal(formatDataBRT("2026-09-04T01:30:00Z"), "03/09/2026");
  const agora = Date.parse("2026-10-23T12:00:00Z");
  const velho = frescorParque("2026-09-03T22:59:00Z", agora);
  assert.equal(velho.texto, "Valor do parque atualizado em 03/09/2026");
  assert.equal(velho.desatualizado, true);
  const novo = frescorParque("2026-10-23T11:00:00Z", agora);
  assert.equal(novo.desatualizado, false);
  assert.equal(frescorParque("2026-09-23T12:00:00Z", agora).desatualizado, false); // exatamente 30 dias
  assert.equal(frescorParque(null, agora).desatualizado, true);
});
test("competência YYYY-MM em BRT", () => {
  assert.equal(competenciaBRT("2026-11-01T02:00:00Z"), "2026-10");
});
test("lista de ativos sem valor de substituição", () => {
  const r = equipamentosSemValor([eq("DEMO-3", "1.000,00"), eq("DEMO-2", ""), eq("DEMO-1", "0")]);
  assert.deepEqual(r.map((e) => e.Tag), ["DEMO-1", "DEMO-2"]);
});

import { parqueRegraDe, valorParqueDoMes } from "./parque-frescor";
const fotos = [{ competencia: "2026-08", valor: 800 }, { competencia: "2026-10", valor: 1000 }];
test("regra: padrão único; PARQUE_REGRA=mensal liga a regra mensal", () => {
  assert.equal(parqueRegraDe(undefined), "unico");
  assert.equal(parqueRegraDe("x"), "unico");
  assert.equal(parqueRegraDe(" Mensal "), "mensal");
});
test("modo único: todos os meses usam o mesmo valor", () => {
  for (const c of ["2026-01", "2026-08", "2026-10"]) assert.equal(valorParqueDoMes("unico", 1200, fotos, c), 1200);
});
test("modo mensal: foto do mês, senão a anterior, senão o valor único", () => {
  assert.equal(valorParqueDoMes("mensal", 1200, fotos, "2026-08"), 800);
  assert.equal(valorParqueDoMes("mensal", 1200, fotos, "2026-09"), 800);
  assert.equal(valorParqueDoMes("mensal", 1200, fotos, "2026-10"), 1000);
  assert.equal(valorParqueDoMes("mensal", 1200, fotos, "2026-03"), 1200);
});
