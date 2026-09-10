export type FichaIndicadorId =
  | "planejado"
  | "custo"
  | "sla"
  | "volume"
  | "satisfacao"
  | "os-abertas-fechadas"
  | "gasto-reparo-medicos"
  | "manutencoes-planejadas-executadas"
  | "custo-manutencao-parque"
  | "corretivas-por-prioridade"
  | "sla-primeiro-atendimento"
  | "sla-criticidade"
  | "gap-preventiva"
  | "motivos-corretivas";

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
      "Effort GlobalThings. Previsto: API cronograma (ProximaRealizacao + Perioridicade no ano; códigos YYYYMM+id com dia inválido ancoram no mês). Executado: API listagem_analitica_das_os — mesma Tag e tipo, com Fechamento ou DataDaSolucao no mês. Recorte médico (exclui M - / O -). Limitação: planos sem mês/data válida não entram no denominador.",
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
  "os-abertas-fechadas": {
    id: "os-abertas-fechadas",
    nomeDoIndicador: "OS abertas × fechadas",
    ...BASE,
    finalidadeDoIndicador:
      "Comparar, mês a mês, a entrada de OS (abertura) com a execução (fechamento) da oficina de Engenharia Clínica, evidenciando déficit ou superávit de capacidade.",
    meta: "Monitoramento (saldo próximo de zero)",
    referenciaDaMeta:
      "Indicador operacional de capacidade. Não consta como meta percentual na planilha IndicadoresEC-definicao.xlsx; o acompanhamento visa equilibrar entrada e execução.",
    formula:
      "Abertas no mês = OS com Abertura no mês. Fechadas no mês = OS com Fechamento (ou DataDaSolucao se Fechamento vazio) no mês. Coberto = min(abertas, fechadas). Déficit = max(0, abertas − fechadas). Superávit = max(0, fechadas − abertas). Saldo do período = total abertas − total fechadas.",
    coletaDeDados:
      "Effort GlobalThings — API listagem_analitica_das_os. Recorte só por TipoDeManutencao de Engenharia Clínica (inclui A -, calibração, TSE, instrumental; exclui M - predial e O - obras). Não aplica filtro de equipamentos médicos. Intervalo rolante de 12 meses.",
    periodicidade: "Mensal",
  },
  "gasto-reparo-medicos": {
    id: "gasto-reparo-medicos",
    nomeDoIndicador: "Gasto mensal com reparo de equipamentos médicos",
    ...BASE,
    finalidadeDoIndicador:
      "Acompanhar o custo das OS de reparo (corretiva, assistência técnica, man. externa / instrumental) de equipamentos médicos fechadas no mês, para gestão orçamentária da oficina.",
    meta: "Monitoramento (sem meta percentual nesta ficha)",
    referenciaDaMeta:
      "Derivado do molde de custo da planilha IndicadoresEC-definicao.xlsx, restrito a reparos de eq. médicos. Meta percentual do parque permanece no indicador de custo total de manutenção.",
    formula:
      "Gasto do mês = soma do campo Custo das OS que: (1) têm Tag no índice de equipamentos médicos; (2) são tipo de reparo (corretiva / assistência / instrumental / man. externa — exclui calibração, TSE, preventiva); (3) têm Fechamento ou DataDaSolucao no mês. Média mensal = gasto total do período ÷ número de meses do gráfico.",
    coletaDeDados:
      "Effort GlobalThings — API listagem_analitica_das_os (Custo, Fechamento, DataDaSolucao, TipoDeManutencao, Tag) + índice médico via API de equipamentos. OS sem tag médica, sem data de fechamento ou fora do tipo reparo não entram. Intervalo rolante de 12 meses.",
    periodicidade: "Mensal",
  },
  "manutencoes-planejadas-executadas": {
    id: "manutencoes-planejadas-executadas",
    nomeDoIndicador: "% Manutenções Planejadas x Realizadas (DESATIVADO)",
    ...BASE,
    finalidadeDoIndicador:
      "DESATIVADO na UI: a API não expõe data de emissão do laudo. Contar executado por Fechamento/DataDaSolucao distorce o cumprimento e não deve ser usado em auditoria. Reativar quando houver campo confiável de emissão de laudo.",
    meta: "> 90% (quando reativado)",
    referenciaDaMeta:
      "Benchmarks nacionais (Rede D’Or, HIAE, ANVISA) e boas práticas de engenharia clínica recomendam ≥ 90% de execução das manutenções preventivas programadas — desde que o evento seja a emissão do laudo, não o fechamento da OS.",
    formula:
      "Planejado no mês = ocorrências do cronograma (Preventiva / Calibração / TSE). Executado desejado = data de emissão do laudo (indisponível na API). NÃO usar Fechamento/DataDaSolucao como proxy oficial.",
    coletaDeDados:
      "Probe 2026-03: os-analitico sem campos de laudo/emissão; anexos_os/anexos_equipamento só DataHoraInclusao; TipoAnexo vazio; 0% das OS preventivas fechadas com anexo laudoish pareado; nomes sem padrão LAUDO_YYYY-MM-DD. Evidências alternativas: /cronograma e /qmentum/sem-preventiva. Lib mantida em lib/pbi/manutencoes-planejadas.ts.",
    periodicidade: "Mensal (quando reativado)",
  },
  "custo-manutencao-parque": {
    id: "custo-manutencao-parque",
    nomeDoIndicador: "Custo de manutenção / valor do parque",
    ...BASE,
    cargo: "Engenharia Clínica",
    finalidadeDoIndicador:
      "Monitorar a despesa mensal de manutenção (contratos + custos avulsos de OS de reparo) em relação ao valor de substituição do parque tecnológico.",
    meta: "≤ 4% do valor de substituição do parque (acumulado anual)",
    referenciaDaMeta:
      "Benchmark internacional (Joint Commission / ECRI) entre 4 e 6% do valor de substituição do parque.",
    formula:
      "(Soma dos contratos ativos no mês + Soma do Custo das OS de reparo de eq. médicos fechadas no mês) / Valor de substituição do parque × 100",
    coletaDeDados:
      "Numerador: contratos da API GlobalThings (GET /api/pbi/v1/contratos via /api/pbi/contratos) — no mês, soma Parcelas.ValorMoeda com DataVencimento no mês; sem parcelas, rateia ValorTotal (ou CustoPrevisto) pela vigência DataInicio→DataFimVigencia/DataFim quando Periodicidade não é mensal. + OS analítica no recorte de gasto-reparo médico. Denominador: valorApi = soma ValorDeSubstituicao de TODOS os equipamentos (incluirCustoSubstituicao=true), persistido — sem override manual nem env. ValorDeAquisicao não entra (outliers). Intervalo rolante de 12 meses.",
    periodicidade: "Mensal",
  },
  "corretivas-por-prioridade": {
    id: "corretivas-por-prioridade",
    nomeDoIndicador: "Corretivas por prioridade",
    ...BASE,
    finalidadeDoIndicador:
      "Acompanhar o volume e a mistura de OS corretivas de equipamentos médicos por Prioridade (Alta / Média / Baixa / Sem prioridade), mês a mês, sem julgamento de prazo.",
    meta: "Acompanhar distribuição (sem meta percentual de prazo neste indicador)",
    referenciaDaMeta:
      "Indicador de volume/distribuição. O cumprimento de prazo do 1º atendimento fica no indicador % 1º atendimento no prazo.",
    formula:
      "Contagem de OS corretivas (Tag médica) com Abertura no intervalo, agrupadas pela Prioridade da OS (texto Alta/Média/Baixa ou horas embutidas 2h/12h/72h; vazio → Sem prioridade). % da mistura = OS do grupo / total no período.",
    coletaDeDados:
      "Effort GlobalThings — API listagem_analitica_das_os. Recorte: isCorretiva(TipoDeManutencao) e Tag no índice de equipamentos médicos. Intervalo rolante de 12 meses (mês de Abertura). Não usa DataLimite, DataDoAtendimento nem Fechamento.",
    periodicidade: "Mensal",
  },
  "sla-primeiro-atendimento": {
    id: "sla-primeiro-atendimento",
    nomeDoIndicador: "% 1º atendimento no prazo (por prioridade)",
    ...BASE,
    finalidadeDoIndicador:
      "Monitorar o cumprimento do tempo até o primeiro atendimento corretivo (Qmentum), por Prioridade da OS — sem usar Fechamento/resolução como evento de prazo.",
    meta: "A definir com a supervisão / Qmentum",
    referenciaDaMeta:
      "Qmentum — tempo de manutenção corretiva. Evento = DataDoAtendimento (1º atendimento). Meta operacional a validar na planilha oficial.",
    formula:
      "% no prazo = (OS com DataDoAtendimento ≤ limite / OS com DataDoAtendimento e limite calculável) × 100. Limite = DataLimiteDoAtendimento se preenchida; senão Abertura + horas da Prioridade (ALTA 2h, MÉDIA 12h, BAIXA 72h, ou horas explícitas). OS sem 1º atendimento ficam fora do denominador (KPI transparente). Fechamento e DataDaSolucao não entram na fórmula.",
    coletaDeDados:
      "Effort GlobalThings — API listagem_analitica_das_os. Recorte: isCorretiva + Tag médica. Intervalo rolante de 12 meses (mês de Abertura). Quebra por Prioridade da OS. Limitação: DataLimiteDoAtendimento costuma vir vazia — o fallback por Prioridade domina.",
    periodicidade: "Mensal",
  },
  "sla-criticidade": {
    id: "sla-criticidade",
    nomeDoIndicador: "% 1º atendimento no prazo (por criticidade do equipamento)",
    ...BASE,
    finalidadeDoIndicador:
      "Monitorar o tempo até o 1º atendimento corretivo alinhado à QMentum, por faixa de criticidade do parque (Crítico / Semicrítico / Não crítico) — sem usar Fechamento.",
    meta: "Crítico ≤ 4h úteis · Semicrítico ≤ 24h úteis · Não crítico ≤ 72h úteis (default; editável depois)",
    referenciaDaMeta:
      "QMentum — metas institucionais por criticidade do equipamento. Horas úteis 8h–17h seg–sex (America/Sao_Paulo), sem feriados nesta versão. Valores default documentados na UI até validação com a supervisão.",
    formula:
      "% no prazo = (OS com DataDoAtendimento e horas úteis ≤ meta da faixa / OS com 1º atendimento e faixa mapeada) × 100. Faixa = Criticidade do cadastro (Tag): ALTA/CRÍTICO→Crítico, MÉDIA/SEMICRÍTICO→Semicrítico, BAIXA/NÃO CRÍTICO→Não crítico. Evento = somente DataDoAtendimento. Fechamento não entra.",
    coletaDeDados:
      "Effort GlobalThings — OS analítica + cadastro de equipamentos (Criticidade). Recorte: isCorretiva + Tag médica. Intervalo rolante 12 meses (mês de Abertura). Limitação: Criticidade vazia → Sem faixa (fora do % por meta).",
    periodicidade: "Mensal",
  },
  "gap-preventiva": {
    id: "gap-preventiva",
    nomeDoIndicador: "Equipamentos sem preventiva no plano",
    ...BASE,
    finalidadeDoIndicador:
      "Listar o parque médico ativo que ainda não tem Preventiva no cronograma — cobertura obrigatória na QMentum. Calibração e TSE aparecem só como informação.",
    meta: "0 equipamentos médicos ativos sem Preventiva no plano (meta operacional)",
    referenciaDaMeta:
      "Regra de negócio: equipamentos precisam de preventiva. Calibração e TSE são extras (não obrigatórios para todos).",
    formula:
      "Sem preventiva = Tag do parque médico ativo sem linha de Preventiva no cronograma (classificação loose: TipoDeManutencao OU PlanoDeManutencao). Tipo vazio não zera cobertura se o nome do Plano classificar.",
    coletaDeDados:
      "API equipamentos (apenasAtivos) + API cronograma na janela operacional (2025–2027 enquanto vigente). Fonte só API.",
    periodicidade: "Sob demanda / reunião",
  },
  "motivos-corretivas": {
    id: "motivos-corretivas",
    nomeDoIndicador: "Motivos das manutenções corretivas",
    ...BASE,
    finalidadeDoIndicador:
      "Monitorar Causa/Ocorrência das corretivas médicas, a recorrência por Tag e o recorte de mau uso (texto + anexos), subsidiando melhorias (PDCA em versão futura).",
    meta: "Acompanhar top causas, Tags recorrentes e corretivas por mau uso (sem meta percentual nesta versão)",
    referenciaDaMeta:
      "QMentum — monitorar motivos e gerar melhorias. Esta tela cobre o monitoramento; plano de ação / PDCA fica como próximo passo.",
    formula:
      "Pareto = contagem de Causa (ou Ocorrencia) nas OS corretivas médicas com Abertura nos últimos 12 meses. Recorrência = contagem por Tag. Mau uso = keywords em Causa/Ocorrencia/ObservacaoDaOS/Servico/Pendencia/JustificativaEncerramento; foto = anexo jpg/png/IMG_ em anexos_os.",
    coletaDeDados:
      "Effort GlobalThings — listagem_analitica_das_os + anexos_os. Recorte: isCorretiva + Tag médica. Qualidade depende do preenchimento de Causa/Ocorrencia no CMMS e do upload de anexos.",
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
