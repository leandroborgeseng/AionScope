import assert from "node:assert/strict";
import { test } from "node:test";
import type { LinhaRecorte } from "@/lib/ec/sala-recortes";
import { aplicarFiltros, escreverUrlDrill, isRecorteDrill, lerUrlDrill } from "./sala-recorte";

function linha(p: Partial<LinhaRecorte> & { os: string }): LinhaRecorte {
  return {
    equipamento: "Equipamento Demo",
    tag: "EQ-DEMO-01",
    setor: "Setor Demo A",
    oficina: "ENGENHARIA CLINICA",
    tipo: "A - Corretiva",
    situacaoOs: "Aberta",
    etapa: "Em atendimento",
    prioridade: "Média",
    aberturaIso: "2026-10-01T08:00:00",
    abertura: "01/10/2026 08:00",
    fechamento: "—",
    idadeDias: 14,
    idade: "14d",
    semMovimento: "—",
    ...p,
  };
}

test("C9/D9: drill, OS e filtros vão e voltam pela URL sem perder outros parâmetros", () => {
  const url = escreverUrlDrill("?demo=drill", {
    drill: "envelhecimento.faixa.d16a30",
    os: "DEMO-1",
    filtros: { etapa: "Em atendimento", periodo: "30d", ordem: "recente" },
  });
  const params = new URLSearchParams(url);
  assert.equal(params.get("demo"), "drill");
  assert.deepEqual(lerUrlDrill(url), {
    drill: "envelhecimento.faixa.d16a30",
    os: "DEMO-1",
    filtros: { etapa: "Em atendimento", periodo: "30d", ordem: "recente" },
  });
  assert.equal(escreverUrlDrill(url, { drill: null, os: null, filtros: {} }), "?demo=drill");
});

test("C5/D3: filtros combinam entre si e 'Exibindo X de N' parte do total do recorte", () => {
  const linhas = [
    linha({ os: "DEMO-1", etapa: "Em atendimento", idadeDias: 3, aberturaIso: "2026-10-12T08:00:00" }),
    linha({ os: "DEMO-2", etapa: "Reparo externo", idadeDias: 20, aberturaIso: "2026-09-25T08:00:00" }),
    linha({ os: "DEMO-3", etapa: "Em atendimento", idadeDias: 40, aberturaIso: "2026-09-05T08:00:00", oficina: "INSTRUMENTAL" }),
  ];
  assert.deepEqual(aplicarFiltros(linhas, {}).map((l) => l.os), ["DEMO-3", "DEMO-2", "DEMO-1"]);
  assert.deepEqual(aplicarFiltros(linhas, { ordem: "recente" }).map((l) => l.os), ["DEMO-1", "DEMO-2", "DEMO-3"]);
  assert.deepEqual(aplicarFiltros(linhas, { etapa: "Em atendimento", periodo: "30d" }).map((l) => l.os), ["DEMO-1"]);
  assert.deepEqual(aplicarFiltros(linhas, { oficina: "INSTRUMENTAL" }).map((l) => l.os), ["DEMO-3"]);
  assert.equal(aplicarFiltros(linhas, { tipo: "Inexistente" }).length, 0);
});

test("movimento Aberta/Fechada inclui 'Ambas', como no indicador", () => {
  const linhas = [linha({ os: "A", movimento: "Aberta" }), linha({ os: "F", movimento: "Fechada" }), linha({ os: "X", movimento: "Ambas" })];
  assert.deepEqual(aplicarFiltros(linhas, { movimento: "Fechada" }).map((l) => l.os).sort(), ["F", "X"]);
});

test("só Envelhecimento/Fluxo/Programadas usam o recorte do servidor", () => {
  assert.ok(isRecorteDrill("fluxo.entraram"));
  assert.ok(!isRecorteDrill("agora.grave"));
  assert.ok(!isRecorteDrill("ciclo.eol.2030"));
});
