export const INDICADORES_HUB_HREF = "/indicadores";

export const INDICADORES = [
  {
    href: "/indicadores/os-abertas-fechadas",
    label: "OS abertas × fechadas",
    blurb:
      "Ano vigente (Jan–Dez): volume da oficina de Engenharia Clínica — entrada × execução por mês (coberto, déficit e superávit).",
  },
  {
    href: "/indicadores/oficinas-plano-abertas-fechadas",
    label: "Preventivas · abertas × fechadas por oficina",
    blurb:
      "Preventiva, Calibração e TSE (+ consolidado): gráfico com barras abertas×fechadas + %, e trabalho ainda aberto nos meses à frente. Drill-down das OS.",
  },
  {
    href: "/etiquetas",
    label: "Etiquetas · plano (Niimbot B1)",
    blurb:
      "OS abertas Prev/Cal/TSE → etiquetas com realização, próxima e QR da ficha vida. Preview, PNG e impressão Web Bluetooth na B1.",
  },
  {
    href: "/indicadores/gasto-reparo-equipamentos-medicos",
    label: "Gasto mensal com reparo de eq. médicos",
    blurb: "Soma do Custo das OS de reparo de equipamentos médicos fechadas no intervalo.",
  },
  {
    href: "/indicadores/custo-manutencao-parque",
    label: "Custo manutenção / valor do parque",
    blurb: "Custo de OS de reparo ÷ valor de substituição do parque (sem contratos — fora do plano da Sala).",
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
  {
    href: "/indicadores/treinamentos-bombas",
    label: "Treinamentos · bombas B. Braun",
    blurb:
      "Listas 2025/2026, taxa de reciclagem por setor, horas·homem e composição da turma. PDFs de evidência com acesso restrito (LGPD).",
  },
] as const;

export const CADASTROS_HUB_HREF = "/cadastros";

export const CADASTROS = [
  {
    href: "/cadastros/contratos",
    label: "Contratos",
    blurb: "Cadastro local / API (fora do plano da Sala TV). Não entra no KPI de custo/parque.",
  },
  {
    href: "/cadastros/parque",
    label: "Valor do parque",
    blurb: "Soma ValorDeSubstituicao de todos os equipamentos (API).",
  },
  {
    href: "/cadastros/terceiros",
    label: "Equipamentos de terceiros",
    blurb: "Situação TERCEIRO… (API, somente leitura): valor de substituição, anexos e preventivas.",
  },
] as const;

export type IndicadorNavItem = (typeof INDICADORES)[number];
