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
] as const;

export type IndicadorNavItem = (typeof INDICADORES)[number];
