export function semAcento(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR")
    .trim();
}

export function texto(value: string | null | undefined) {
  return (value ?? "").trim();
}

export function parseMoeda(value: string | null | undefined): number | null {
  const raw = texto(value);
  if (!raw) return null;
  const normalizado = raw.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

export type ClasseManutencao =
  | "corretiva"
  | "preventiva"
  | "calibracao"
  | "tse"
  | "compra"
  | "externa"
  | "treinamento"
  | "devolucao"
  | "outro";

export function classeManutencao(tipo: string | null | undefined): ClasseManutencao {
  const valor = semAcento(tipo);
  if (!valor) return "outro";
  if (valor.includes("DEVOLU")) return "devolucao";
  if (valor.includes("CALIBR")) return "calibracao";
  if (valor.includes("SEGURANCA ELETRICA") || valor.includes("TSE")) return "tse";
  if (valor.includes("PREVENT")) return "preventiva";
  if (valor.includes("COMPRA")) return "compra";
  if (valor.includes("EXTERNA") || valor.includes("ASSISTENCIA TECNICA")) return "externa";
  if (valor.includes("TREIN") || valor.includes("ORIENTAC")) return "treinamento";
  if (valor.includes("CORRET")) return "corretiva";
  return "outro";
}

export function classeDemanda(classe: ClasseManutencao) {
  return classe === "corretiva" || classe === "compra" || classe === "externa" || classe === "devolucao" || classe === "outro";
}
