import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCronogramaAnual } from "./cronograma-anual";
import { chaveTag, datasPorTipo, interpretarDataCronograma } from "./cronograma-datas";
import type { CronogramaItem } from "./types";

const AGORA = new Date(2026, 10, 26);

function linha(parcial: Partial<CronogramaItem>): CronogramaItem {
  return {
    Empresa: "",
    CentroDeCusto: "",
    Setor: "CENTRO CIRÚRGICO - 10A",
    Equipamento: "Bomba ZZ",
    Fabricante: "",
    Modelo: "",
    Tag: "ZZ-02932",
    PlanoDeManutencao: "",
    TipoDeManutencao: "",
    DataDaUltima: "",
    ProximaRealizacao: "",
    Perioridicade: "",
    Observacao: "",
    ...parcial,
  };
}

test("TAG ignora hífen, espaço, caixa e zero à esquerda", () => {
  assert.equal(chaveTag("HSJ-02932"), chaveTag("hsj02932"));
  assert.equal(chaveTag("HSJ-02932"), chaveTag("HSJ 02932"));
  assert.equal(chaveTag("HSJ-02932"), chaveTag("HSJ-2932"));
  assert.equal(chaveTag("ZZTAG"), "ZZTAG");
  assert.equal(chaveTag(""), "");
});

test("código 2099MM ancora no mês e não vira dia", () => {
  const ancora = interpretarDataCronograma("209909735");
  assert.equal(ancora?.mesSomente, true);
  assert.equal(ancora?.date.getFullYear(), 2099);
  assert.equal(ancora?.date.getMonth(), 8);
});

test("preventiva é o tipo que não é TSE nem calibração; código 2099 com periodicidade projeta o mês", () => {
  const datas = datasPorTipo(
    [
      linha({
        Tag: "ZZ02932",
        TipoDeManutencao: "A - MANUTENÇÃO DE EQUIPAMENTOS",
        PlanoDeManutencao: "MONITOR MULTIPARAMETRO SEMESTRAL ZZ",
        ProximaRealizacao: "209909735",
        Perioridicade: "6 Mês(Es)",
      }),
    ],
    AGORA,
  );
  assert.equal(datas.preventiva.ultima, null);
  assert.equal(datas.preventiva.proxima, "03/2027");
  assert.equal(datas.preventiva.motivo, null);
  assert.equal(datas.preventiva.mes, "2027-03");
  assert.equal(JSON.stringify(datas).includes("2099"), false);
  assert.equal(datas.tse.proxima, null);
  assert.equal(datas.calibracao.proxima, null);
});

test("sem periodicidade o código 2099 não vira próxima, e TSE guarda o dia", () => {
  const datas = datasPorTipo(
    [
      linha({
        TipoDeManutencao: "A - SEGURANÇA ELÉTRICA",
        DataDaUltima: "01/02/2026",
        ProximaRealizacao: "15/08/2026",
        Perioridicade: "Anual",
      }),
      linha({
        TipoDeManutencao: "A - CALIBRAÇÃO DE EQUIPAMENTOS MÉDICOS",
        DataDaUltima: "",
        ProximaRealizacao: "209909735",
        Perioridicade: "",
      }),
    ],
    AGORA,
  );
  assert.equal(datas.tse.ultima, "01/02/2026");
  assert.equal(datas.tse.proxima, "15/08/2027");
  assert.equal(datas.tse.vencida, false);
  assert.equal(datas.calibracao.vencida, false);
  assert.equal(datas.calibracao.ultima, null);
  assert.equal(datas.calibracao.proxima, null);
  assert.equal(datas.calibracao.motivo, "código de mês sem periodicidade");
  assert.equal(JSON.stringify(datas).includes("2099"), false);
});

test("código 2099 com dia válido não publica o dia nem o ano", () => {
  const ancora = interpretarDataCronograma("209907275");
  assert.equal(ancora?.codigo, true);
  assert.equal(ancora?.mesSomente, true);
  assert.equal(ancora?.date.getMonth(), 6);
  const datas = datasPorTipo(
    [
      linha({
        TipoDeManutencao: "A - CALIBRAÇÃO DE EQUIPAMENTOS MÉDICOS",
        ProximaRealizacao: "209907275",
        Perioridicade: "",
      }),
    ],
    AGORA,
  );
  assert.equal(datas.calibracao.proxima, null);
  assert.equal(datas.calibracao.motivo, "código de mês sem periodicidade");
  assert.equal(JSON.stringify(datas).includes("27/07"), false);
  assert.equal(JSON.stringify(datas).includes("2099"), false);
  assert.equal(datas.calibracao.vencida, false);
});

test("próxima que já passou marca vencida", () => {
  const datas = datasPorTipo(
    [
      linha({
        TipoDeManutencao: "A - MANUTENÇÃO DE EQUIPAMENTOS",
        PlanoDeManutencao: "MONITOR ZZ",
        ProximaRealizacao: "20/05/2025",
      }),
    ],
    AGORA,
  );
  assert.equal(datas.preventiva.proxima, "20/05/2025");
  assert.equal(datas.preventiva.vencida, true);
  assert.equal(datas.preventiva.motivo, null);
});

test("tipo vazio com plano de calibração é calibração; corretiva não vira preventiva", () => {
  const calibracao = datasPorTipo(
    [
      linha({
        TipoDeManutencao: "",
        PlanoDeManutencao: "CALIBRAÇÃO ANUAL",
        ProximaRealizacao: "15/03/2027",
      }),
    ],
    AGORA,
  );
  assert.equal(calibracao.calibracao.proxima, "15/03/2027");
  assert.equal(calibracao.preventiva.proxima, null);
  assert.equal(calibracao.tse.proxima, null);

  const tse = datasPorTipo(
    [
      linha({
        TipoDeManutencao: "Corretiva",
        PlanoDeManutencao: "SEGURANÇA ELÉTRICA",
        ProximaRealizacao: "15/04/2027",
      }),
    ],
    AGORA,
  );
  assert.equal(tse.tse.proxima, "15/04/2027");
  assert.equal(tse.preventiva.proxima, null);
  assert.equal(tse.calibracao.proxima, null);

  const corretiva = datasPorTipo(
    [
      linha({
        TipoDeManutencao: "Corretiva",
        PlanoDeManutencao: "PLANO GENERICO ZZ",
        ProximaRealizacao: "15/05/2027",
      }),
    ],
    AGORA,
  );
  assert.equal(corretiva.preventiva.proxima, null);
  assert.equal(corretiva.tse.proxima, null);
  assert.equal(corretiva.calibracao.proxima, null);
});

test("painel /api/pbi/cronograma não classifica pelo nome do plano", () => {
  const vazio = buildCronogramaAnual({
    cronograma: [
      linha({
        TipoDeManutencao: "",
        PlanoDeManutencao: "CALIBRAÇÃO ANUAL",
        ProximaRealizacao: "15/03/2027",
      }),
    ],
    os: [],
    equipamentos: [],
    year: 2027,
    somenteMedicos: true,
    today: AGORA,
  });
  assert.equal(vazio.groups.length, 0);
  const peloTipo = buildCronogramaAnual({
    cronograma: [
      linha({
        TipoDeManutencao: "Calibração",
        PlanoDeManutencao: "CALIBRAÇÃO ANUAL",
        ProximaRealizacao: "15/03/2027",
      }),
    ],
    os: [],
    equipamentos: [],
    year: 2027,
    somenteMedicos: true,
    today: AGORA,
  });
  assert.equal(peloTipo.groups.length, 1);
  assert.equal(peloTipo.groups[0]?.equipamentos[0]?.plans[0]?.tipo, "Calibração");
});
