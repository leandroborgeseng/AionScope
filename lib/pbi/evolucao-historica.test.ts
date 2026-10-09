import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EquipamentoItem, OsAnaliticoItem } from "./types";
import {
  agregarEvolucaoParque,
  anoCadastroEquipamento,
  isChamadoEngenhariaClinica,
  montarEvolucaoHistorica,
  noParqueNoFimDoAno,
  regressaoLinear,
} from "./evolucao-historica";

function eq(partial: Partial<EquipamentoItem> & Pick<EquipamentoItem, "Id" | "DataDeCadastro">): EquipamentoItem {
  return {
    Tag: "",
    NSerie: "",
    Patrimonio: "",
    Equipamento: "EQ",
    Modelo: "",
    Fabricante: "",
    Criticidade: "",
    Prioridade: "",
    Cliente: "",
    Setor: "",
    GrupoDeSetores: "",
    CentroDeCusto: "",
    DataDeAquisicao: "",
    ValorDeAquisicao: "",
    ValorDeSubstituicao: "",
    DataDeFabricacao: "",
    "DataDeInstalação": "",
    "DataDeInativação": "",
    DataDeGarantia: "",
    DataDeGarantiaEstendida: "",
    RegistroAnvisa: "",
    ValidadeDoRegistroAnvisa: "",
    Situacao: "PRÓPRIO",
    Status: "ATIVO",
    EndOfLife: "",
    EndOfService: "",
    Fornecedor: "",
    GarantiaExterna: "",
    ...partial,
  };
}

function os(partial: Partial<OsAnaliticoItem> & Pick<OsAnaliticoItem, "OS" | "Abertura" | "TipoDeManutencao">): OsAnaliticoItem {
  return {
    CodigoSerialOS: 1,
    Empresa: "",
    Oficina: "ENGENHARIA CLÍNICA",
    Responsavel: "",
    Tipo: "",
    Prioridade: "",
    SituacaoDaOS: "Aberta",
    ComplexidadeDaOS: "",
    PlanoDeManutencao: "",
    Tag: "",
    Equipamento: "",
    Modelo: "",
    Fabricante: "",
    Setor: "",
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
    ...partial,
  };
}

describe("regressaoLinear", () => {
  it("recupera a e b de uma reta exata", () => {
    // y = 10·x + 5  → pontos (0,5) (1,15) (2,25)
    const r = regressaoLinear([
      { x: 0, y: 5 },
      { x: 1, y: 15 },
      { x: 2, y: 25 },
    ]);
    assert.ok(r);
    assert.ok(Math.abs(r.a - 10) < 1e-9);
    assert.ok(Math.abs(r.b - 5) < 1e-9);
    assert.equal(r.r2, 1);
  });

  it("retorna null com menos de 2 pontos", () => {
    assert.equal(regressaoLinear([{ x: 1, y: 2 }]), null);
  });
});

describe("anoCadastroEquipamento", () => {
  it("lê DataDeCadastro BR", () => {
    assert.equal(anoCadastroEquipamento(eq({ Id: 1, DataDeCadastro: "14/05/2015" })), 2015);
  });

  it("ignora vazio", () => {
    assert.equal(anoCadastroEquipamento(eq({ Id: 1, DataDeCadastro: "" })), null);
  });
});

describe("noParqueNoFimDoAno", () => {
  it("inclui cadastro no ano e exclui inativado no mesmo ano", () => {
    const item = eq({
      Id: 1,
      DataDeCadastro: "01/03/2018",
      "DataDeInativação": "15/06/2018",
      Status: "INATIVO",
    });
    assert.equal(noParqueNoFimDoAno(item, 2017), false);
    assert.equal(noParqueNoFimDoAno(item, 2018), false);
    assert.equal(noParqueNoFimDoAno(item, 2019), false);
  });

  it("mantém ativo até o ano anterior à inativação", () => {
    const item = eq({
      Id: 2,
      DataDeCadastro: "01/01/2016",
      "DataDeInativação": "10/02/2020",
      Status: "INATIVO",
    });
    assert.equal(noParqueNoFimDoAno(item, 2019), true);
    assert.equal(noParqueNoFimDoAno(item, 2020), false);
  });

  it("INATIVO sem DataDeInativação fica fora do estoque", () => {
    const item = eq({
      Id: 3,
      DataDeCadastro: "01/01/2016",
      Status: "INATIVO",
    });
    assert.equal(noParqueNoFimDoAno(item, 2019), false);
  });
});

describe("agregarEvolucaoParque", () => {
  it("começa no menor DataDeCadastro e acumula quantidade/valor", () => {
    const hoje = new Date(2020, 5, 15);
    const itens = [
      eq({ Id: 1, DataDeCadastro: "14/05/2015", ValorDeSubstituicao: "1000", Equipamento: "Monitor multiparamétrico" }),
      eq({ Id: 2, DataDeCadastro: "01/01/2018", ValorDeSubstituicao: "2.500,00", Equipamento: "Ventilador" }),
      eq({
        Id: 3,
        DataDeCadastro: "01/06/2017",
        ValorDeSubstituicao: "500",
        "DataDeInativação": "01/01/2019",
        Status: "INATIVO",
        Equipamento: "Bomba de infusão",
      }),
      eq({ Id: 4, DataDeCadastro: "" }),
      // predial — fora do recorte médico
      eq({
        Id: 5,
        DataDeCadastro: "01/01/2015",
        ValorDeSubstituicao: "99999",
        Equipamento: "Ar condicionado split",
        Tipo: "Predial",
      }),
    ];
    const r = agregarEvolucaoParque(itens, hoje);
    assert.equal(r.anoInicio, 2015);
    assert.equal(r.anoFim, 2020);
    assert.equal(r.naoMedicos, 1);
    assert.equal(r.semCadastro, 1);
    assert.equal(r.serie[0]?.ano, 2015);
    assert.equal(r.serie[0]?.quantidade, 1);
    assert.equal(r.serie[0]?.valorSubstituicao, 1000);
    assert.equal(r.serie[0]?.entrantes, 1);

    const y2018 = r.serie.find((s) => s.ano === 2018);
    assert.ok(y2018);
    // 2015 + 2017 + 2018 (ainda ativos) — sem o split predial
    assert.equal(y2018.quantidade, 3);
    assert.equal(y2018.valorSubstituicao, 1000 + 2500 + 500);
    assert.equal(y2018.entrantes, 1);

    const y2019 = r.serie.find((s) => s.ano === 2019);
    assert.ok(y2019);
    // id 3 inativado em 2019
    assert.equal(y2019.quantidade, 2);
    assert.equal(y2019.valorSubstituicao, 1000 + 2500);
  });
});

describe("isChamadoEngenhariaClinica", () => {
  it("aceita A - e rejeita M -/cancelada", () => {
    assert.equal(
      isChamadoEngenhariaClinica(
        os({ OS: "1", Abertura: "01/01/2024", TipoDeManutencao: "A - CORRETIVA ENGENHARIA CLÍNICA" }),
      ),
      true,
    );
    assert.equal(
      isChamadoEngenhariaClinica(os({ OS: "2", Abertura: "01/01/2024", TipoDeManutencao: "M - PREDIAL" })),
      false,
    );
    assert.equal(
      isChamadoEngenhariaClinica(
        os({
          OS: "3",
          Abertura: "01/01/2024",
          TipoDeManutencao: "A - CORRETIVA",
          SituacaoDaOS: "Cancelada",
        }),
      ),
      false,
    );
  });
});

describe("agregarEvolucaoChamados / montarEvolucaoHistorica", () => {
  it("conta por ano de Abertura e alinha ao parque", () => {
    const hoje = new Date(2022, 0, 10);
    const equipamentos = [
      eq({ Id: 1, DataDeCadastro: "01/01/2020", ValorDeSubstituicao: "100" }),
    ];
    const lista = [
      os({ OS: "1", Abertura: "15/03/2020", TipoDeManutencao: "A - CORRETIVA ENGENHARIA CLÍNICA" }),
      os({ OS: "2", Abertura: "15/03/2020", TipoDeManutencao: "A - CORRETIVA ENGENHARIA CLÍNICA" }),
      os({ OS: "3", Abertura: "01/08/2021", TipoDeManutencao: "CALIBRAÇÃO" }),
      os({ OS: "4", Abertura: "01/08/2021", TipoDeManutencao: "M - CIVIL" }),
    ];
    const snap = montarEvolucaoHistorica({
      equipamentos,
      os: lista,
      chamadosPeriodoApi: "Todos",
      hoje,
    });
    assert.equal(snap.anoInicio, 2020);
    assert.equal(snap.campoCadastro, "DataDeCadastro");
    assert.equal(snap.chamadosTotal, 3);
    assert.deepEqual(
      snap.chamados.map((c) => [c.ano, c.quantidade]),
      [
        [2020, 2],
        [2021, 1],
        [2022, 0],
      ],
    );
  });
});
