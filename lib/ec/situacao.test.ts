import assert from "node:assert/strict";
import test from "node:test";
import { ordenarFila } from "./fila";
import { horasNoTexto, metaHorasEsforco } from "./meta";
import { situacaoPrimeiroAtendimento } from "./situacao";

test("lê as horas do texto do Effort", () => {
  assert.equal(horasNoTexto("ALTA (2HS)"), 2);
  assert.equal(horasNoTexto("MÉDIA (MÁX. 12 HS)"), 12);
  assert.equal(horasNoTexto("BAIXA (MÁX. 72HS)"), 72);
  assert.equal(metaHorasEsforco("BAIXA (12HS)", "ALTO (MÁX. 4HS)"), 12);
  assert.equal(metaHorasEsforco("", "ALTA CRITICIDADE (MÁX 2H)"), 2);
});

test("bordas da situação", () => {
  assert.equal(situacaoPrimeiroAtendimento({ atendida: true, horasDecorridas: 9, metaHoras: 2 }), "ATENDIDA");
  assert.equal(situacaoPrimeiroAtendimento({ atendida: false, horasDecorridas: 4.1, metaHoras: 2 }), "GRAVE");
  assert.equal(situacaoPrimeiroAtendimento({ atendida: false, horasDecorridas: 4, metaHoras: 2 }), "ATRASADA");
  assert.equal(situacaoPrimeiroAtendimento({ atendida: false, horasDecorridas: 2, metaHoras: 2 }), "VENCE LOGO");
  assert.equal(situacaoPrimeiroAtendimento({ atendida: false, horasDecorridas: 1.5, metaHoras: 2 }), "VENCE LOGO");
  assert.equal(situacaoPrimeiroAtendimento({ atendida: false, horasDecorridas: 1.49, metaHoras: 2 }), "NO PRAZO");
  assert.equal(situacaoPrimeiroAtendimento({ atendida: false, horasDecorridas: 3, metaHoras: null }), "SEM META");
});

test("fila grave antes de atrasada, e crítico parado antes", () => {
  const fila = ordenarFila([
    { id: "b", tipo: "os" as const, situacao: "NO PRAZO" as const, criticidadeOrdem: 0, parado: false, aberturaMs: 1 },
    { id: "a", tipo: "os" as const, situacao: "GRAVE" as const, criticidadeOrdem: 2, parado: false, aberturaMs: 3 },
    { id: "c", tipo: "os" as const, situacao: "GRAVE" as const, criticidadeOrdem: 0, parado: true, aberturaMs: 9 },
  ]);
  assert.deepEqual(fila.map((item) => item.id), ["c", "a", "b"]);
});
