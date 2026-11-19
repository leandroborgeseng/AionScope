import assert from "node:assert/strict";
import { test } from "node:test";
import { calcularTempo, diasCivis, textoDaEtapa } from "./andamento";

const abertura = "01/03/2026 10:00";

test("dias civis usam o calendário de São Paulo na virada do dia", () => {
  const origem = new Date(2026, 2, 1, 22, 0, 0);
  const aindaDia1 = new Date("2026-03-02T02:30:00.000Z");
  const jaDia2 = new Date("2026-03-02T03:30:00.000Z");
  assert.equal(diasCivis(origem, aindaDia1), 0);
  assert.equal(diasCivis(origem, jaDia2), 1);
});

test("tempo da etapa: pendência, atendimento, abertura e OS não atendida", () => {
  const agora = new Date("2026-03-12T15:00:00.000Z");
  const comPendencia = calcularTempo(
    { Abertura: abertura, DataDoAtendimento: "03/03/2026 10:00", PendenciaAbertaEm: "02/03/2026 10:00" },
    agora,
  );
  assert.equal(comPendencia.diasNaEtapaOrigem, "pendencia");
  assert.equal(comPendencia.diasNaEtapa, 10);
  assert.deepEqual(comPendencia.tempoAteAtendimento, { horas: 48, dias: 2 });
  assert.equal(comPendencia.dataAtendimento, "03/03/2026 10:00");

  const soAtendimento = calcularTempo(
    { Abertura: "10/03/2026 08:00", DataDoAtendimento: "11/03/2026 08:00", PendenciaAbertaEm: "" },
    agora,
  );
  assert.equal(soAtendimento.diasNaEtapaOrigem, "atendimento");
  assert.equal(soAtendimento.diasNaEtapa, 1);
  assert.deepEqual(soAtendimento.tempoAteAtendimento, { horas: 24, dias: 1 });

  const semAtendimento = calcularTempo(
    { Abertura: "12/03/2026 08:00", DataDoAtendimento: "", PendenciaAbertaEm: "" },
    agora,
  );
  assert.equal(semAtendimento.diasNaEtapaOrigem, "abertura");
  assert.equal(semAtendimento.diasNaEtapa, 0);
  assert.equal(semAtendimento.dataAtendimento, null);
  assert.equal(semAtendimento.tempoAteAtendimento, null);
  assert.equal(textoDaEtapa("Sem 1º atendimento", 0), "Sem 1º atendimento desde hoje");
  assert.equal(textoDaEtapa("Em atendimento", 1), "Em atendimento há 1 dia");
  assert.equal(textoDaEtapa("Aguarda peça/compra", 12), "Aguarda peça/compra há 12 dias");
});

test("virada do fuso não antecipa o dia da etapa", () => {
  const ainda = calcularTempo(
    { Abertura: "01/03/2026 22:00", DataDoAtendimento: "", PendenciaAbertaEm: "" },
    new Date("2026-03-02T02:30:00.000Z"),
  );
  const depois = calcularTempo(
    { Abertura: "01/03/2026 22:00", DataDoAtendimento: "", PendenciaAbertaEm: "" },
    new Date("2026-03-02T03:30:00.000Z"),
  );
  assert.equal(ainda.diasNaEtapa, 0);
  assert.equal(ainda.diasNaEtapaOrigem, "abertura");
  assert.equal(depois.diasNaEtapa, 1);
  assert.equal(textoDaEtapa("Sem 1º atendimento", depois.diasNaEtapa), "Sem 1º atendimento há 1 dia");
});
