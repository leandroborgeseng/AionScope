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
    blurb: "Contratos + avulsos de OS ÷ valor de substituição (API todos os equipamentos; override manual opcional).",
  },
  {
    href: "/indicadores/sla-corretiva-criticidade",
    label: "% Corretivas no prazo (criticidade)",
    blurb: "Qmentum item 6: cumprimento do SLA de atendimento corretivo, quebrado por criticidade do equipamento / prioridade da OS.",
  },
] as const;

export const CADASTROS_HUB_HREF = "/cadastros";

export const CADASTROS = [
  {
    href: "/cadastros/parque",
    label: "Valor do parque",
    blurb: "Soma da API (todos os equipamentos) com override manual opcional.",
  },
  {
    href: "/cadastros/contratos",
    label: "Contratos",
    blurb: "Despesa mensal de contratos de manutenção.",
  },
  {
    href: "/cadastros/terceiros",
    label: "Equipamentos de terceiros",
    blurb: "Situação TERCEIRO…: valor de substituição, anexos, preventivas e acompanhamento local.",
  },
] as const;

export type IndicadorNavItem = (typeof INDICADORES)[number];
