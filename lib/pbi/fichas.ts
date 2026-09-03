export type FichaIndicadorId = "planejado" | "custo" | "sla" | "volume" | "satisfacao";

export type FichaIndicador = {
  id: FichaIndicadorId;
  nomeDoIndicador: string;
  areaSetor: string;
  pilar: string;
  finalidadeDoIndicador: string;
  meta: string;
  referenciaDaMeta: string;
  responsavel: string;
  supervisao: string;
  cargo: string;
  formula: string;
  coletaDeDados: string;
  periodicidade: string;
};

const BASE = {
  areaSetor: "Engenharia Clínica",
  pilar: "Qualidade",
  responsavel: "Leandro Borges",
  supervisao: "",
  cargo: "Engenheiro Clínico",
} as const;

export const FICHAS: Record<FichaIndicadorId, FichaIndicador> = {
  planejado: {
    id: "planejado",
    nomeDoIndicador: "% Manutenções Planejadas x Realizadas",
    ...BASE,
    finalidadeDoIndicador:
      "Avaliar a aderência ao plano de manutenção preventiva, medindo o percentual de manutenções previstas que foram efetivamente executadas dentro do período programado.",
    meta: "> 90%",
    referenciaDaMeta:
      "Benchmarks nacionais (Rede D’Or, HIAE, ANVISA) e boas práticas de engenharia clínica recomendam ≥ 90% de execução das manutenções preventivas programadas.",
    formula:
      "(Nº de manutenções preventivas, calibrações e TSE executadas no mês do plano / Nº total de manutenções previstas no cronograma) × 100",
    coletaDeDados:
      "Effort GlobalThings. Previsto: API cronograma (ProximaRealizacao + Perioridicade no ano). Executado: API listagem_analitica_das_os — mesma Tag e tipo, com Fechamento ou DataDaSolucao no mês. Recorte médico (exclui M - / O -). Limitação: ProximaRealizacao às vezes vem como código (ex.: 202607275); planos sem data válida não entram no denominador.",
    periodicidade: "Mensal",
  },
  custo: {
    id: "custo",
    nomeDoIndicador: "Custo Total de Manutenção (Equipamentos Médicos)",
    ...BASE,
    cargo: "Engenharia Clínica",
    finalidadeDoIndicador:
      "Monitorar o custo total das manutenções (preventivas, corretivas e calibrações) dos equipamentos médicos, permitindo avaliar a eficiência do uso dos recursos e subsidiar decisões de gestão orçamentária e investimentos.",
    meta: "≤ 4% do valor total do parque tecnológico",
    referenciaDaMeta:
      "Benchmark internacional (Joint Commission / ECRI) entre 4 e 6% do valor de substituição do parque.",
    formula:
      "(Soma de Custo das OS de equipamentos médicos no período / Soma de ValorDeAquisicao do parque médico filtrado) × 100",
    coletaDeDados:
      "Effort GlobalThings. Numerador: Custo (formato BR) da OS analítica cuja Tag está no parque médico; data = Fechamento ou, se vazio, Abertura. Denominador: cadastro de equipamentos (estoque atual, não muda por mês). Recorte médico + filtros globais. Limitações: Custo frequentemente 0,00; contratos de manutenção ainda não entram; a meta oficial cita valor de substituição, o dashboard usa ValorDeAquisicao.",
    periodicidade: "Mensal",
  },
  sla: {
    id: "sla",
    nomeDoIndicador: "% Atendimento no Prazo",
    ...BASE,
    finalidadeDoIndicador:
      "Medir a pontualidade do primeiro atendimento das OS com equipamento, comparando DataDoAtendimento com o limite de prazo.",
    meta: "A definir na planilha oficial",
    referenciaDaMeta:
      "Indicador ainda não consta na aba Eng Clínica de IndicadoresEC-definicao.xlsx. Meta operacional a validar com a supervisão.",
    formula:
      "(Nº de OS com DataDoAtendimento ≤ limite / Nº de OS com atendimento e limite calculável) × 100",
    coletaDeDados:
      "Effort GlobalThings — API listagem_analitica_das_os. Só OS com Tag. Limite: 1) DataLimiteDoAtendimento; 2) senão Abertura + horas extraídas de Prioridade (BAIXA 72h, MÉDIA 12h, ALTA 2h). Sem DataDoAtendimento = sem atendimento (fora do %). Limitação: DataLimiteDoAtendimento costuma vir vazia; Prioridade sem horas usa o fallback por faixa.",
    periodicidade: "Mensal",
  },
  volume: {
    id: "volume",
    nomeDoIndicador: "Volume de Trabalho da Oficina de Engenharia Clínica",
    ...BASE,
    finalidadeDoIndicador:
      "Tornar visível o volume de OS processadas pela equipe de Engenharia Clínica, mês a mês, para apoiar gestão de capacidade e comunicação do trabalho realizado.",
    meta: "Monitoramento (sem meta percentual)",
    referenciaDaMeta:
      "Indicador ainda não consta na aba Eng Clínica de IndicadoresEC-definicao.xlsx. Serve para acompanhamento operacional, não para meta de qualidade.",
    formula:
      "Abertas = OS com Abertura no mês; Fechadas = OS com Fechamento (ou DataDaSolucao se Fechamento vazio) no mês; Processadas = Abertas + Fechadas. Média mensal = Processadas do período ÷ número de meses do recorte.",
    coletaDeDados:
      "Effort GlobalThings — API listagem_analitica_das_os (Abertura, Fechamento, Oficina, TipoDeManutencao). Recorte: Oficina contendo Engenharia/Clínica, se existir; senão tipos de EC (A -, calibração, TSE, instrumental). Exclui M - predial e O - obras. Respeita filtros globais e recorte médico.",
    periodicidade: "Mensal",
  },
  satisfacao: {
    id: "satisfacao",
    nomeDoIndicador: "Satisfação dos Usuários (Avaliação da OS)",
    ...BASE,
    finalidadeDoIndicador:
      "Acompanhar a satisfação dos requisitantes a partir do campo de avaliação preenchido na OS, medindo cobertura de respostas e a distribuição das notas.",
    meta: "A definir na planilha oficial",
    referenciaDaMeta:
      "Indicador ainda não consta na aba Eng Clínica de IndicadoresEC-definicao.xlsx. Nos dados atuais a avaliação é qualitativa (BOM / REGULAR), não escala 1–5.",
    formula:
      "% avaliadas = (OS com Avaliacao preenchida / OS do recorte EC no período) × 100. % positivas = (OS com Avaliacao BOM ou ÓTIMO / OS avaliadas) × 100. Se a API enviar número 1–5, usa-se a média.",
    coletaDeDados:
      "Effort GlobalThings — API listagem_analitica_das_os (Avaliacao, ObservacaoDaAvaliacao, MotivoDaAvaliacao). Recorte da oficina de EC + filtros globais + eq. médicos. Limitação: no dump real a maioria vem vazia; valores observados: BOM, REGULAR e vazio. MotivoDaAvaliacao não é preenchido. O campo existe; falta uso operacional.",
    periodicidade: "Mensal",
  },
};

export const FICHA_CAMPOS: { key: keyof FichaIndicador; label: string; section?: string }[] = [
  { key: "nomeDoIndicador", label: "Nome do Indicador" },
  { key: "areaSetor", label: "Área (Setor)" },
  { key: "pilar", label: "Pilar" },
  { key: "finalidadeDoIndicador", label: "Finalidade do Indicador" },
  { key: "meta", label: "Meta" },
  { key: "referenciaDaMeta", label: "Referência da Meta" },
  { key: "responsavel", label: "Responsável", section: "Dados Gerais Sobre o Responsável" },
  { key: "supervisao", label: "Supervisão" },
  { key: "cargo", label: "Cargo" },
  { key: "formula", label: "Fórmula", section: "Dados sobre a Coleta" },
  { key: "coletaDeDados", label: "Coleta de Dados" },
  { key: "periodicidade", label: "Periodicidade" },
];
