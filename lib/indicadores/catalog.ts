export const INDICADORES_HUB_HREF = "/indicadores";

export const INDICADORES = [
  {
    href: "/indicadores/os-abertas-fechadas",
    label: "OS abertas × fechadas",
    blurb: "Volume da oficina de Engenharia Clínica: entrada × execução por mês (coberto, déficit e superávit).",
  },
  {
    href: "/indicadores/gasto-reparo-equipamentos-medicos",
    label: "Gasto mensal com reparo de eq. médicos",
    blurb: "Soma do Custo das OS de reparo de equipamentos médicos fechadas no intervalo.",
  },
  {
    href: "/indicadores/manutencoes-planejadas-executadas",
    label: "Manutenções planejadas × executadas",
    blurb: "Preventivas, calibrações e TSE: plano do cronograma × OS fechadas, mês a mês (coberto, déficit e superávit).",
  },
  {
    href: "/indicadores/custo-manutencao-parque",
    label: "Custo manutenção / valor do parque",
    blurb: "Contratos + avulsos de OS ÷ valor de substituição (API: todos os equipamentos).",
  },
  {
    href: "/indicadores/corretivas-por-prioridade",
    label: "Corretivas por prioridade",
    blurb: "Volume de OS corretivas de eq. médicos por Prioridade (Alta / Média / Baixa / Sem prioridade), mês a mês — sem prazo.",
  },
  {
    href: "/indicadores/sla-primeiro-atendimento",
    label: "% 1º atendimento no prazo",
    blurb: "SLA do primeiro atendimento (DataDoAtendimento ≤ limite), por Prioridade. Não usa Fechamento.",
  },
  {
    href: "/indicadores/sla-criticidade",
    label: "% 1º atendimento × criticidade",
    blurb: "SLA QMentum por faixa do parque (Crítico / Semicrítico / Não crítico) em horas úteis. Evento = DataDoAtendimento.",
  },
] as const;

export const CADASTROS_HUB_HREF = "/cadastros";

export const CADASTROS = [
  {
    href: "/cadastros/parque",
    label: "Valor do parque",
    blurb: "Soma ValorDeSubstituicao de todos os equipamentos (API).",
  },
  {
    href: "/cadastros/contratos",
    label: "Contratos",
    blurb: "Contratos de manutenção (API GlobalThings).",
  },
  {
    href: "/cadastros/terceiros",
    label: "Equipamentos de terceiros",
    blurb: "Situação TERCEIRO… (API, somente leitura): valor de substituição, anexos e preventivas.",
  },
] as const;

export type IndicadorNavItem = (typeof INDICADORES)[number];
