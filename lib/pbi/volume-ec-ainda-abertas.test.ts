import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OsAnaliticoItem } from "./types";
import {
  buildVolumeAbertasFechadas,
  currentCalendarYearRange,
  isOsAindaAberta,
  mesTrabalhoPendente,
} from "./volume-ec";

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

describe("ainda abertas / meses futuros", () => {
  it("conta OS sem fechamento como trabalho a matar no mês do prazo", () => {
    const hoje = new Date(2026, 9, 8); // out/2026
    const range = currentCalendarYearRange(hoje);
    assert.equal(range.toISO, "2026-12-31");

    const itens: OsAnaliticoItem[] = [
      os({
        OS: "1",
        Oficina: "PREVENTIVA EQUIPAMENTOS",
        Abertura: "10/10/2026 10:00:00",
        PrazoDeEncerramentoOs: "15/11/2026 10:00:00",
      }),
      os({
        OS: "2",
        Oficina: "PREVENTIVA EQUIPAMENTOS",
        Abertura: "01/09/2026 10:00:00",
        Fechamento: "05/09/2026 10:00:00",
      }),
    ];

    assert.equal(isOsAindaAberta(itens[0]!), true);
    assert.equal(isOsAindaAberta(itens[1]!), false);
    assert.deepEqual(mesTrabalhoPendente(itens[0]!), { year: 2026, month: 10 }); // novembro

    const volume = buildVolumeAbertasFechadas(itens, range, {
      oficinaEquals: "PREVENTIVA EQUIPAMENTOS",
    });
    assert.equal(volume.totalAindaAbertas, 1);
    const nov = volume.months.find((m) => m.month === 10);
    assert.ok(nov);
    assert.equal(nov!.aindaAbertas, 1);
    const out = volume.months.find((m) => m.month === 9);
    assert.equal(out!.abertas, 1);
    assert.equal(out!.aindaAbertas, 0);
  });
});
