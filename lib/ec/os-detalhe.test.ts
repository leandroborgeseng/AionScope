import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OsAnaliticoItem } from "@/lib/pbi/types";
import { filtrarOsPorQuery, montarOsDetalhe, paraSugestao } from "./os-detalhe";

function osBase(parcial: Partial<OsAnaliticoItem> = {}): OsAnaliticoItem {
  return {
    CodigoSerialOS: 1,
    Empresa: "HSJ",
    OS: "202609698",
    Oficina: "ENGENHARIA CLÍNICA",
    Responsavel: "TECNICO",
    Tipo: "OS",
    Prioridade: "ALTA - 2 HORAS",
    TipoDeManutencao: "A - CORRETIVA",
    SituacaoDaOS: "ABERTA",
    ComplexidadeDaOS: "",
    PlanoDeManutencao: "",
    Tag: "HSJ-01079",
    Equipamento: "BISTURI",
    Modelo: "",
    Fabricante: "",
    Setor: "CC",
    CentroDeCusto: "",
    Abertura: "01/10/2026 08:00:00",
    Parada: "",
    Funcionamento: "",
    Fechamento: "",
    Ocorrencia: "Não corta",
    Causa: "",
    Pendencia: "",
    PendenciaAberta: "",
    PrazoDeEncerramentoOs: "",
    Servico: "Verificar potência",
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
    ObservacaoDaRequisicao: "Urgente para cirurgia",
    ...parcial,
  };
}

describe("montarOsDetalhe", () => {
  it("extrai solicitação e flags de compra/externa", () => {
    const detalhe = montarOsDetalhe(
      osBase({
        PendenciaAberta: "Aguardando compra de cabo",
        Assistencia: "EXT fabricante",
        TipoDeManutencao: "A - CORRETIVA",
      }),
    );
    assert.equal(detalhe.os, "202609698");
    assert.equal(detalhe.solicitacao, "Urgente para cirurgia");
    assert.equal(detalhe.pendenciaCompra, true);
    assert.equal(detalhe.manutencaoExterna, true);
    assert.equal(detalhe.aberto, true);
    assert.match(String(detalhe.etapa), /compra|externo|assistência|atendimento|Sem/i);
  });

  it("marca fechada quando SituacaoDaOS = FECHADA", () => {
    const detalhe = montarOsDetalhe(osBase({ SituacaoDaOS: "FECHADA", Fechamento: "05/10/2026 10:00:00" }));
    assert.equal(detalhe.aberto, false);
  });
});

describe("filtrarOsPorQuery", () => {
  it("prioriza match exato do número da OS", () => {
    const base = montarOsDetalhe(osBase());
    const outra = montarOsDetalhe(osBase({ OS: "202609699", Tag: "HSJ-00001" }));
    const itens = [paraSugestao(outra), paraSugestao(base)];
    const hit = filtrarOsPorQuery(itens, "202609698", 5);
    assert.equal(hit[0]?.os, "202609698");
  });
});
