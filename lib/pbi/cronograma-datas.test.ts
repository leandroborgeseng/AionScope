import assert from "node:assert/strict";
import { test } from "node:test";
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

test("preventiva sai do nome do plano e da TAG sem hífen; código 2099 não zera a próxima", () => {
  const datas = datasPorTipo(
    [
      linha({
        Tag: "ZZ02932",
        TipoDeManutencao: "A - MANUTENÇÃO DE EQUIPAMENTOS",
        PlanoDeManutencao: "PREVENTIVA ANUAL ZZ",
        ProximaRealizacao: "209909735",
        Perioridicade: "6 Mês(Es)",
      }),
    ],
    AGORA,
  );
  assert.equal(datas.preventiva.ultima, null);
  assert.equal(datas.preventiva.proxima, "03/2027");
  assert.equal(datas.preventiva.mes, "2027-03");
  assert.equal(datas.tse.proxima, null);
  assert.equal(datas.calibracao.proxima, null);
});

test("sem periodicidade a âncora ainda é a próxima, e TSE/calibração guardam o dia", () => {
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
  assert.equal(datas.calibracao.ultima, null);
  assert.equal(datas.calibracao.proxima, "09/2099");
});
