/** Checklist QMentum — Gestão de Equipamentos (8 itens da planilha). */

export type QmentumStatus = "Coberto" | "Parcial" | "Fora";

export type QmentumChecklistItem = {
  id: number;
  titulo: string;
  status: QmentumStatus;
  /** O que a auditoria costuma olhar. */
  auditoriaOlha: string;
  /** O que o AionScope mostra hoje. */
  appMostra: string;
  href?: string;
  linkLabel?: string;
};

export const QMENTUM_HUB_HREF = "/qmentum";

export const QMENTUM_CHECKLIST: QmentumChecklistItem[] = [
  {
    id: 1,
    titulo: "Fluxo de movimentação de equipamentos",
    status: "Fora",
    auditoriaOlha:
      "Quem solicita, autoriza, retira, destino, como a EC fica sabendo e retorno ao setor.",
    appMostra:
      "Fora — processo CMMS. A API só expõe o setor atual do equipamento, sem histórico nem workflow de transferência.",
  },
  {
    id: 2,
    titulo: "Motivos das corretivas → melhorias",
    status: "Parcial",
    auditoriaOlha:
      "Por que quebra, recorrência por Tag, erro operacional, instalação, fim de vida, falha de preventiva.",
    appMostra:
      "Pareto de Causa/Ocorrência + recorrência por Tag (últimos 12 meses). PDCA / plano de ação ainda não — placeholder honesto na tela.",
    href: "/qmentum/motivos-corretivas",
    linkLabel: "Abrir motivos das corretivas",
  },
  {
    id: 3,
    titulo: "Gestão de equipamentos de terceiros",
    status: "Coberto",
    auditoriaOlha: "Responsável, preventiva, calibração, contrato, laudos e validade.",
    appMostra:
      "Leitura em /cadastros/terceiros (Situação TERCEIRO, anexos, preventivas). Contratos dependem de PBI_TOKEN_CONTRATOS.",
    href: "/cadastros/terceiros",
    linkLabel: "Abrir equipamentos de terceiros",
  },
  {
    id: 4,
    titulo: "Cronograma de preventiva para gestores",
    status: "Coberto",
    auditoriaOlha: "O que será atendido, quando, situação e pendências — acompanhamento simultâneo.",
    appMostra: "Cronograma anual + Sala operacional. Pendências de compra em /compras.",
    href: "/cronograma",
    linkLabel: "Abrir cronograma",
  },
  {
    id: 5,
    titulo: "Registro de manutenções e calibrações",
    status: "Parcial",
    auditoriaOlha: "Histórico + evidência (laudos/certificados) com método definido pela instituição.",
    appMostra:
      "Auditoria de leitura (cronograma × OS). Gravação e laudos com data ficam no GlobalThings — o app não grava no CMMS.",
    href: "/indicadores/manutencoes-planejadas-executadas",
    linkLabel: "Abrir planejadas × executadas",
  },
  {
    id: 6,
    titulo: "Tempo de corretiva × criticidade do equipamento",
    status: "Parcial",
    auditoriaOlha: "Meta por crítico / semicrítico / não crítico (horas úteis) até o 1º atendimento.",
    appMostra:
      "Novo: % 1º atendimento no prazo por criticidade do parque (horas úteis). Mantém o indicador por Prioridade da OS.",
    href: "/indicadores/sla-criticidade",
    linkLabel: "Abrir SLA por criticidade",
  },
  {
    id: 7,
    titulo: "Cumprimento das preventivas (+ gap no plano)",
    status: "Coberto",
    auditoriaOlha:
      "Indicador estrela: aderência ao plano. Equipamentos precisam de preventiva; calibração/TSE são extras informativos.",
    appMostra:
      "Planejadas × executadas + lista de parque médico ativo sem Preventiva no cronograma (janela do plano).",
    href: "/qmentum/sem-preventiva",
    linkLabel: "Abrir gap sem preventiva",
  },
  {
    id: 8,
    titulo: "Treino de bomba de infusão",
    status: "Fora",
    auditoriaOlha: "Quem treinou, quando, equipe e quem falta.",
    appMostra: "Fora — fora das APIs PBI. Domínio de educação permanente / RH.",
  },
];

export const QMENTUM_NAV = [
  {
    href: "/qmentum/sem-preventiva",
    label: "Sem preventiva no plano",
    blurb: "Parque médico ativo sem Preventiva no cronograma (calibração/TSE informativos).",
  },
  {
    href: "/qmentum/motivos-corretivas",
    label: "Motivos das corretivas",
    blurb: "Pareto Causa/Ocorrência e recorrência por Tag (12 meses).",
  },
  {
    href: "/indicadores/sla-criticidade",
    label: "SLA 1º atendimento × criticidade",
    blurb: "% no prazo por faixa do parque (horas úteis). Evento = DataDoAtendimento.",
  },
] as const;
