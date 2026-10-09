import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  absoluteFichaVidaUrl,
  agregarEtiquetasPlano,
  formatMesAno,
  formatProximaLabel,
} from "./agregar-plano";
import type { OsParaEtiqueta } from "./tipos";

function os(
  parcial: Partial<OsParaEtiqueta> & Pick<OsParaEtiqueta, "OS" | "Oficina" | "Tag" | "Abertura">,
): OsParaEtiqueta {
  return {
    CodigoSerialOS: Number(parcial.OS) || 1,
    Equipamento: "Monitor multiparamétrico",
    Modelo: "MX450",
    Fabricante: "Philips",
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
  it("agrupa Prev+TSE+Cal no mesmo equipamento e ignora fechadas/canceladas", () => {
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
});

describe("absoluteFichaVidaUrl", () => {
  it("monta URL absoluta estável para QR", () => {
    assert.equal(
      absoluteFichaVidaUrl("/equipamentos/EQ-1", "https://aionscope.example"),
      "https://aionscope.example/equipamentos/EQ-1",
    );
  });
});
