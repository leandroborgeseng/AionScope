import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OsAnaliticoItem } from "./types";
import { currentCalendarYearRange } from "./volume-ec";
import { buildOficinasPlanoComparativo } from "./oficinas-plano-comparativo";

function os(parcial: Partial<OsAnaliticoItem> & Pick<OsAnaliticoItem, "OS" | "Oficina" | "Abertura">): OsAnaliticoItem {
  return {
    CodigoSerialOS: 1,
    Empresa: "HSJ",
    Responsavel: "",
    Tipo: "",
    Prioridade: "",
    TipoDeManutencao: "A - PREVENTIVA",
    SituacaoDaOS: "ABERTA",
    ComplexidadeDaOS: "",
    PlanoDeManutencao: "",
    Tag: "T1",
    Equipamento: "EQ",
    Modelo: "",
    Fabricante: "",
    Setor: "S",
    CentroDeCusto: "",
    Parada: "",
    Funcionamento: "",
    Fechamento: "",
    Ocorrencia: "",
    Causa: "",
    Pendencia: "",
    PendenciaAberta: "",
    PrazoDeEncerramentoOs: "",
    Servico: "",
    HorasTrabalhadas: "",
    TecnicoResolvedor: "",
    Custo: "",
    Deslocamento: "",
    SLAAtendimento: "",
    Status: "",
    DataLimiteDoAtendimento: "",
    DataDoAtendimento: "",
    DataLimiteDaSolucao: "",
    DataDaSolucao: "",
    Avaliacao: "",
    Seguro: "",
    LiberadoParaUso: "",
    JustificativaEncerramento: "",
    ...parcial,
  };
}

describe("buildOficinasPlanoComparativo", () => {
  it("separa Preventiva / Calibração / TSE mês a mês e exclui Oficina Geral", () => {
    const hoje = new Date(2026, 9, 6); // out/2026
    const range = currentCalendarYearRange(hoje);
    const itens: OsAnaliticoItem[] = [
      os({
        OS: "1",
        Oficina: "PREVENTIVA EQUIPAMENTOS",
        Abertura: "15/03/2026 10:00:00",
        Fechamento: "20/03/2026 10:00:00",
      }),
      os({
        OS: "2",
        Oficina: "CALIBRACAO DE EQUIPAMENTOS",
        Abertura: "10/03/2026 10:00:00",
      }),
      os({
        OS: "3",
        Oficina: "SEGURANCA ELETRICA",
        Abertura: "05/03/2026 10:00:00",
        Fechamento: "06/03/2026 10:00:00",
      }),
      os({
        OS: "4",
        Oficina: "OFICINA GERAL",
        Abertura: "01/03/2026 10:00:00",
        Fechamento: "02/03/2026 10:00:00",
      }),
    ];

    const comp = buildOficinasPlanoComparativo(itens, range);
    assert.equal(comp.totais.length, 3);
    const mar = comp.months.find((m) => m.month === 2);
    assert.ok(mar);
    const prev = mar!.porOficina.find((p) => p.filterKey === "preventiva");
    const calib = mar!.porOficina.find((p) => p.filterKey === "calibracao");
    const tse = mar!.porOficina.find((p) => p.filterKey === "seguranca-eletrica");
    assert.equal(prev?.abertas, 1);
    assert.equal(prev?.fechadas, 1);
    assert.equal(calib?.abertas, 1);
    assert.equal(calib?.fechadas, 0);
    assert.equal(tse?.abertas, 1);
    assert.equal(tse?.fechadas, 1);
    // Oficina Geral não entra em nenhum total
    const totalAbertas = comp.totais.reduce((s, t) => s + t.abertas, 0);
    assert.equal(totalAbertas, 3);
  });
});
