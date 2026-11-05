import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  absoluteFichaVidaUrl,
  agregarEtiquetasPlano,
  formatMesAno,
  formatProximaLabel,
} from "./agregar-plano";
import {
  compareTagNatural,
  setorListaLabel,
  setorParaEtiqueta,
  truncateSetorEtiqueta,
  SETOR_VAZIO_LABEL,
  type OsParaEtiqueta,
} from "./tipos";

function os(
  parcial: Partial<OsParaEtiqueta> & Pick<OsParaEtiqueta, "OS" | "Oficina" | "Tag" | "Abertura">,
): OsParaEtiqueta {
  return {
    CodigoSerialOS: Number(parcial.OS) || 1,
    Equipamento: "Monitor multiparamétrico",
    Modelo: "MX450",
    Fabricante: "Fabricante Demo",
    Setor: "UTI",
    CentroDeCusto: "CC1",
    Fechamento: "",
    DataDaSolucao: "",
    SituacaoDaOS: "ABERTA",
    PrazoDeEncerramentoOs: "",
    DataLimiteDaSolucao: "",
    ...parcial,
  };
}

describe("agregarEtiquetasPlano", () => {
  it("agrupa Prev+TSE+Cal no mesmo equipamento e ignora fechadas de outro mês e canceladas", () => {
    const itens: OsParaEtiqueta[] = [
      os({
        OS: "1",
        Tag: "EQ-100",
        Oficina: "PREVENTIVA EQUIPAMENTOS",
        Abertura: "05/10/2026 08:00:00",
        PrazoDeEncerramentoOs: "20/10/2026 17:00:00",
      }),
      os({
        OS: "2",
        Tag: "EQ-100",
        Oficina: "SEGURANCA ELETRICA",
        Abertura: "08/10/2026 09:00:00",
        PrazoDeEncerramentoOs: "25/10/2026 17:00:00",
      }),
      os({
        OS: "3",
        Tag: "EQ-100",
        Oficina: "CALIBRACAO DE EQUIPAMENTOS",
        Abertura: "10/10/2026 10:00:00",
        DataLimiteDaSolucao: "30/10/2026 17:00:00",
      }),
      os({
        OS: "4",
        Tag: "EQ-100",
        Oficina: "PREVENTIVA EQUIPAMENTOS",
        Abertura: "01/09/2026 08:00:00",
        Fechamento: "02/09/2026 08:00:00",
        SituacaoDaOS: "FECHADA",
      }),
      os({
        OS: "5",
        Tag: "EQ-200",
        Oficina: "OFICINA GERAL",
        Abertura: "05/10/2026 08:00:00",
      }),
      os({
        OS: "6",
        Tag: "EQ-300",
        Oficina: "PREVENTIVA EQUIPAMENTOS",
        Abertura: "05/10/2026 08:00:00",
        SituacaoDaOS: "Cancelada",
      }),
    ];

    const rows = agregarEtiquetasPlano(itens, { monthKeys: ["2026-10"] });
    assert.equal(rows.length, 1);
    const eq = rows[0]!;
    assert.equal(eq.tag, "EQ-100");
    assert.deepEqual(eq.planos, ["preventiva", "calibracao", "tse"]);
    assert.equal(formatMesAno(eq.realizacao), "10/2026");
    assert.equal(eq.proximaFonte, "prazo-os");
    assert.equal(formatProximaLabel(eq.proxima), "30/10/2026");
    assert.equal(eq.fichaVidaPath, "/equipamentos/EQ-100");
  });

  it("filtra por mês e por tipo de plano", () => {
    const itens: OsParaEtiqueta[] = [
      os({
        OS: "10",
        Tag: "A1",
        Oficina: "PREVENTIVA EQUIPAMENTOS",
        Abertura: "15/09/2026 10:00:00",
        PrazoDeEncerramentoOs: "28/09/2026 17:00:00",
      }),
      os({
        OS: "11",
        Tag: "A1",
        Oficina: "SEGURANCA ELETRICA",
        Abertura: "02/10/2026 10:00:00",
        PrazoDeEncerramentoOs: "15/10/2026 17:00:00",
      }),
      os({
        OS: "12",
        Tag: "B2",
        Oficina: "CALIBRACAO DE EQUIPAMENTOS",
        Abertura: "03/10/2026 10:00:00",
      }),
    ];

    const soOut = agregarEtiquetasPlano(itens, { monthKeys: ["2026-10"] });
    assert.equal(soOut.length, 2);
    assert.ok(soOut.some((r) => r.tag === "A1" && r.planos.includes("tse")));
    assert.ok(!soOut.find((r) => r.tag === "A1")!.planos.includes("preventiva"));

    const soPrev = agregarEtiquetasPlano(itens, {
      monthKeys: ["2026-09", "2026-10"],
      planos: ["preventiva"],
    });
    assert.equal(soPrev.length, 1);
    assert.deepEqual(soPrev[0]!.planos, ["preventiva"]);
  });

  it("usa cronograma ou estimativa +1 ano quando não há prazo na OS", () => {
    const itens: OsParaEtiqueta[] = [
      os({
        OS: "20",
        Tag: "C1",
        Oficina: "PREVENTIVA EQUIPAMENTOS",
        Abertura: "01/10/2026 08:00:00",
      }),
    ];
    const comCrono = agregarEtiquetasPlano(itens, {
      monthKeys: ["2026-10"],
      cronogramaProximas: [{ tag: "C1", proxima: new Date(2027, 3, 15) }],
    });
    assert.equal(comCrono[0]!.proximaFonte, "cronograma");
    assert.equal(formatProximaLabel(comCrono[0]!.proxima), "15/04/2027");

    const semCrono = agregarEtiquetasPlano(itens, { monthKeys: ["2026-10"] });
    assert.equal(semCrono[0]!.proximaFonte, "estimativa");
    assert.equal(formatMesAno(semCrono[0]!.proxima), "10/2027");
  });

  it("E1: preventiva fechada no mês M aparece no filtro M (ZZTESTE)", () => {
    const itens: OsParaEtiqueta[] = [
      os({
        OS: "901",
        Tag: "ZZTESTE-FECH-01",
        Oficina: "PREVENTIVA EQUIPAMENTOS",
        Abertura: "03/10/2026 08:00:00",
        Fechamento: "12/10/2026 16:00:00",
        SituacaoDaOS: "FECHADA",
        PrazoDeEncerramentoOs: "20/10/2026 17:00:00",
      }),
    ];
    const rows = agregarEtiquetasPlano(itens, { monthKeys: ["2026-10"] });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.tag, "ZZTESTE-FECH-01");
    assert.deepEqual(rows[0]!.planos, ["preventiva"]);
    assert.equal(rows[0]!.osPorPlano.preventiva?.os, "901");
    assert.equal(formatMesAno(rows[0]!.realizacao), "10/2026");
  });

  it("E2: OS ainda aberta continua na lista (sem regressão)", () => {
    const itens: OsParaEtiqueta[] = [
      os({
        OS: "902",
        Tag: "ZZTESTE-ABERTA-01",
        Oficina: "PREVENTIVA EQUIPAMENTOS",
        Abertura: "05/10/2026 08:00:00",
        PrazoDeEncerramentoOs: "25/10/2026 17:00:00",
      }),
    ];
    const rows = agregarEtiquetasPlano(itens, { monthKeys: ["2026-10"] });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.osPorPlano.preventiva?.os, "902");
    assert.equal(rows[0]!.osPorPlano.preventiva?.situacao, "ABERTA");
  });

  it("E3: OS cancelada não aparece aberta nem fechada", () => {
    const itens: OsParaEtiqueta[] = [
      os({
        OS: "903",
        Tag: "ZZTESTE-CANC-01",
        Oficina: "PREVENTIVA EQUIPAMENTOS",
        Abertura: "05/10/2026 08:00:00",
        SituacaoDaOS: "Cancelada",
      }),
      os({
        OS: "904",
        Tag: "ZZTESTE-CANC-02",
        Oficina: "PREVENTIVA EQUIPAMENTOS",
        Abertura: "01/10/2026 08:00:00",
        Fechamento: "10/10/2026 12:00:00",
        SituacaoDaOS: "Cancelada",
      }),
    ];
    const rows = agregarEtiquetasPlano(itens, { monthKeys: ["2026-10"] });
    assert.equal(rows.length, 0);
  });

  it("E4: fechada em mês N some do filtro M ≠ N", () => {
    const itens: OsParaEtiqueta[] = [
      os({
        OS: "905",
        Tag: "ZZTESTE-MES-01",
        Oficina: "PREVENTIVA EQUIPAMENTOS",
        Abertura: "20/09/2026 08:00:00",
        Fechamento: "28/09/2026 17:00:00",
        SituacaoDaOS: "FECHADA",
      }),
    ];
    assert.equal(agregarEtiquetasPlano(itens, { monthKeys: ["2026-10"] }).length, 0);
    assert.equal(agregarEtiquetasPlano(itens, { monthKeys: ["2026-09"] }).length, 1);
  });

  it("E5: agregação é só leitura — situação FECHADA permanece no resumo", () => {
    const itens: OsParaEtiqueta[] = [
      os({
        OS: "906",
        Tag: "ZZTESTE-RO-01",
        Oficina: "CALIBRACAO DE EQUIPAMENTOS",
        Abertura: "02/10/2026 09:00:00",
        DataDaSolucao: "15/10/2026 11:00:00",
        SituacaoDaOS: "Encerrada",
      }),
    ];
    const before = structuredClone(itens);
    const rows = agregarEtiquetasPlano(itens, { monthKeys: ["2026-10"] });
    assert.equal(rows[0]!.osPorPlano.calibracao?.situacao, "Encerrada");
    assert.deepEqual(itens, before);
  });

  it("R1: mesma Tag com aberta e fechada no mês prefere a aberta", () => {
    const itens: OsParaEtiqueta[] = [
      os({
        OS: "910",
        Tag: "ZZTESTE-PREF-01",
        Oficina: "PREVENTIVA EQUIPAMENTOS",
        Abertura: "01/10/2026 08:00:00",
        Fechamento: "05/10/2026 16:00:00",
        SituacaoDaOS: "FECHADA",
      }),
      os({
        OS: "911",
        Tag: "ZZTESTE-PREF-01",
        Oficina: "PREVENTIVA EQUIPAMENTOS",
        Abertura: "08/10/2026 08:00:00",
        PrazoDeEncerramentoOs: "30/10/2026 17:00:00",
      }),
    ];
    const rows = agregarEtiquetasPlano(itens, { monthKeys: ["2026-10"] });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.osPorPlano.preventiva?.os, "911");
  });

  it("R1: entre fechadas do mês, fica a de fechamento mais recente", () => {
    const itens: OsParaEtiqueta[] = [
      os({
        OS: "920",
        Tag: "ZZTESTE-PREF-02",
        Oficina: "SEGURANCA ELETRICA",
        Abertura: "01/10/2026 08:00:00",
        Fechamento: "10/10/2026 16:00:00",
        SituacaoDaOS: "FECHADA",
      }),
      os({
        OS: "921",
        Tag: "ZZTESTE-PREF-02",
        Oficina: "SEGURANCA ELETRICA",
        Abertura: "12/10/2026 08:00:00",
        Fechamento: "20/10/2026 16:00:00",
        SituacaoDaOS: "FECHADA",
      }),
    ];
    const rows = agregarEtiquetasPlano(itens, { monthKeys: ["2026-10"] });
    assert.equal(rows[0]!.osPorPlano.tse?.os, "921");
  });

  it("R2: sem monthKeys não inclui fechadas", () => {
    const itens: OsParaEtiqueta[] = [
      os({
        OS: "930",
        Tag: "ZZTESTE-SEM-MES",
        Oficina: "PREVENTIVA EQUIPAMENTOS",
        Abertura: "01/10/2026 08:00:00",
        Fechamento: "12/10/2026 16:00:00",
        SituacaoDaOS: "FECHADA",
      }),
      os({
        OS: "931",
        Tag: "ZZTESTE-ABERTA-02",
        Oficina: "PREVENTIVA EQUIPAMENTOS",
        Abertura: "05/10/2026 08:00:00",
      }),
    ];
    const rows = agregarEtiquetasPlano(itens);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.tag, "ZZTESTE-ABERTA-02");
  });

  it("incluirFechadas=false ignora fechadas mesmo com mês", () => {
    const itens: OsParaEtiqueta[] = [
      os({
        OS: "940",
        Tag: "ZZTESTE-OFF",
        Oficina: "PREVENTIVA EQUIPAMENTOS",
        Abertura: "01/10/2026 08:00:00",
        Fechamento: "12/10/2026 16:00:00",
        SituacaoDaOS: "FECHADA",
      }),
    ];
    assert.equal(
      agregarEtiquetasPlano(itens, { monthKeys: ["2026-10"], incluirFechadas: false }).length,
      0,
    );
  });

  it("E7: filtro de setor aplica também a OS fechadas (ZZTESTE)", () => {
    const itens: OsParaEtiqueta[] = [
      os({
        OS: "950",
        Tag: "ZZTESTE-SETOR-A",
        Oficina: "PREVENTIVA EQUIPAMENTOS",
        Abertura: "01/10/2026 08:00:00",
        Fechamento: "12/10/2026 16:00:00",
        SituacaoDaOS: "FECHADA",
        Setor: "UTI",
      }),
      os({
        OS: "951",
        Tag: "ZZTESTE-SETOR-B",
        Oficina: "PREVENTIVA EQUIPAMENTOS",
        Abertura: "02/10/2026 08:00:00",
        Fechamento: "13/10/2026 16:00:00",
        SituacaoDaOS: "FECHADA",
        Setor: "Centro Cirúrgico",
      }),
    ];
    const rows = agregarEtiquetasPlano(itens, { monthKeys: ["2026-10"] });
    assert.equal(rows.length, 2);
    const soUti = rows.filter((r) => r.setor === "UTI");
    assert.equal(soUti.length, 1);
    assert.equal(soUti[0]!.tag, "ZZTESTE-SETOR-A");
  });

  it("E8 lista: setor vazio agrega vazio e o filtro usa Sem setor", () => {
    const itens: OsParaEtiqueta[] = [
      os({
        OS: "960",
        Tag: "ZZTESTE-SEM-SETOR",
        Oficina: "PREVENTIVA EQUIPAMENTOS",
        Abertura: "01/10/2026 08:00:00",
        Fechamento: "10/10/2026 16:00:00",
        SituacaoDaOS: "FECHADA",
        Setor: "   ",
      }),
    ];
    const rows = agregarEtiquetasPlano(itens, { monthKeys: ["2026-10"] });
    assert.equal(rows[0]!.setor, "");
    assert.equal(setorListaLabel(rows[0]!.setor), SETOR_VAZIO_LABEL);
    assert.equal(setorParaEtiqueta(rows[0]!.setor), "");
  });
});

describe("compareTagNatural / setor na etiqueta (E7–E9)", () => {
  it("E7/ET1: ordenação natural crescente (TAG-2 antes de TAG-10)", () => {
    const tags = ["ZZTESTE-TAG-10", "ZZTESTE-TAG-2", "ZZTESTE-TAG-1"];
    tags.sort(compareTagNatural);
    assert.deepEqual(tags, ["ZZTESTE-TAG-1", "ZZTESTE-TAG-2", "ZZTESTE-TAG-10"]);
  });

  it("E8: setorListaLabel mapeia vazio para Sem setor", () => {
    assert.equal(setorListaLabel(""), SETOR_VAZIO_LABEL);
    assert.equal(setorListaLabel("  "), SETOR_VAZIO_LABEL);
    assert.equal(setorListaLabel(null), SETOR_VAZIO_LABEL);
    assert.equal(setorListaLabel("UTI Adulto"), "UTI Adulto");
  });

  it("ET3/E9: setorParaEtiqueta some na etiqueta se vazio; trunca ~28 chars", () => {
    assert.equal(setorParaEtiqueta(""), "");
    assert.equal(setorParaEtiqueta(SETOR_VAZIO_LABEL), "");
    assert.equal(setorParaEtiqueta("UTI"), "UTI");
    const longo = "CENTRO CIRURGICO AMBULATORIAL EXTENSO DE TESTE";
    const trunc = truncateSetorEtiqueta(longo);
    assert.ok(trunc.endsWith("…"));
    assert.ok(trunc.length <= 28);
  });
});

describe("absoluteFichaVidaUrl", () => {
  it("monta URL absoluta estável para QR", () => {
    assert.equal(
      absoluteFichaVidaUrl("/equipamentos/EQ-1", "https://aionscope.example"),
      "https://aionscope.example/equipamentos/EQ-1",
    );
  });
});
