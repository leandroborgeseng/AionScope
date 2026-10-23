/**
 * M1 ciclo 3: ALLOWLIST por resource para quem chama SEM sessão de admin.
 * Montada a partir dos campos que as telas públicas usam (app/, components/, hooks/, lib/ fora de lib/ec e lib/db),
 * sem R$, sem nomes de pessoas e sem links. Qualquer outro campo sai (inclusive campo novo do PBI).
 * Ciclo 4: CentroDeCusto/CentrosDeCusto entram (exceção exata em EXCECOES_RE_SUSPEITO_RS).
 * contratos, anexos-equipamento, anexos-os e oficina não têm allowlist: sem sessão respondem 401.
 */
import type { PbiResource } from "./catalog";

export const ALLOWLIST_PUBLICA: Partial<Record<PbiResource, readonly string[]>> = {
  "cronograma": [
    "Empresa", "Setor", "Equipamento", "Fabricante", "Modelo", "Tag",
    "PlanoDeManutencao", "TipoDeManutencao", "CentroDeCusto", "DataDaUltima", "ProximaRealizacao", "Perioridicade", "Observacao",
  ],
  "tipo-manutencao": [
    "Id", "Descricao",
  ],
  "os-analitico": [
    "CodigoSerialOS", "Empresa", "OS", "Oficina", "Tipo", "Prioridade",
    "TipoDeManutencao", "SituacaoDaOS", "PlanoDeManutencao", "Tag", "Patrimonio", "Equipamento",
    "Modelo", "Fabricante", "Setor", "Abertura", "Fechamento", "Ocorrencia",
    "Causa", "Pendencia", "PendenciaAberta", "PrazoDeEncerramentoOs", "Servico", "Deslocamento",
    "ObservacaoDaOS", "Status", "DataLimiteDoAtendimento", "DataDoAtendimento", "DataLimiteDaSolucao", "DataDaSolucao",
    "CentroDeCusto", "ObservacaoDaRequisicao", "Avaliacao", "ObservacaoDaAvaliacao", "MotivoDaAvaliacao", "LiberadoParaUso", "JustificativaEncerramento",
  ],
  "os-resumida": [
    "CodigoSerialOS", "Empresa", "OS", "Oficina", "Tipo", "Prioridade",
    "TipoDeManutencao", "SituacaoDaOS", "PlanoDeManutencao", "Equipamento", "Modelo", "Fabricante",
    "Setor", "Abertura", "Fechamento", "Ocorrencia", "Causa", "Status",
    "DataDaSolucao", "PendenciaAberta", "Itens",
  ],
  "equipamentos": [
    "Id", "Tag", "NSerie", "Patrimonio", "Equipamento", "Modelo",
    "Fabricante", "Criticidade", "Prioridade", "RazaoSocial", "CodigoCliente", "Cliente",
    "Setor", "GrupoDeSetores", "DataDeAquisicao", "NotaFiscal", "RegistroAnvisa", "ValidadeDoRegistroAnvisa",
    "Situacao", "Status", "EndOfLife", "EndOfService", "Fornecedor", "Observacao",
    "DataDeCadastro", "Tipo", "TipoEquipamento", "TipoDeEquipamento", "GrupoFamilia", "Familia",
    "Classificacao", "Categoria", "CentroDeCusto",
  ],
  "tmef": [
    "Empresa", "Tag", "Equipamento", "Setor", "Modelo", "Fabricante",
    "Patrimonio", "Os", "MTBF",
  ],
  "tpm": [
    "Empresa", "Tag", "Equipamento", "Setor", "Modelo", "Fabricante",
    "Patrimonio", "Os", "MTBF",
  ],
  "disp-equipamento": [
    "EquipamentoId", "Tag", "EquipamentoDescricaoCompleta", "ModeloDescricao", "Fabricante", "Criticidade",
    "SetorDescricao", "CaminhoSetor", "Patrimonio", "PossuiOSParadaSemFuncionamento", "DisponibilidadePercentualPeriodo", "TMEF",
    "TMPR", "DiasParado", "DiasFuncionando", "CentrosDeCusto", "DisponibilidadeMensal", "Ano", "Mes",
    "DisponibilidadePercentual",
  ],
  "disp-equipamento-mes": [
    "EquipamentoId", "Tag", "EquipamentoDescricaoCompleta", "ModeloDescricao", "Fabricante", "Criticidade",
    "SetorDescricao", "CaminhoSetor", "Patrimonio", "PossuiOSParadaSemFuncionamento", "DisponibilidadePercentualPeriodo", "TMEF",
    "TMPR", "DiasParado", "DiasFuncionando", "CentrosDeCusto", "DisponibilidadeMensal", "Ano", "Mes",
    "DisponibilidadePercentual",
  ],
  "monitor-reacao": [
    "Empresa", "Cliente", "Setor", "Numero", "Observacao", "Tag",
    "Equipamento", "TipoManutencao", "Prioridade", "TempoDecorrido", "PrazoParaAtendimento",
  ],
  "monitor-atendimento": [
    "Empresa", "Cliente", "Setor", "ObservacaoDaRequisicao", "Tag", "Equipamento",
    "TipoManutencao", "Prioridade", "TempoDecorrido", "PrazoParaAtendimento",
  ],
};
