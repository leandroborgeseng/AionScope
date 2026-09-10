/**
 * Detecção de corretivas por mau uso / uso indevido a partir de texto da OS + anexos imagem.
 */
import { formatPct, pct } from "./indicators";
import type { AnexoOsItem, OsAnaliticoItem } from "./types";

/** Keywords documentadas na UI — match substring, sem acento, case-insensitive. */
export const MAU_USO_KEYWORDS = [
  "mau uso",
  "maus uso",
  "mau-uso",
  "mal uso",
  "uso indevido",
  "uso inadequado",
  "uso incorreto",
  "erro operacional",
  "neglig",
  "imprud",
  "imperic",
  "vandal",
  "abuso de uso",
  "dano por usuario",
  "dano usuario",
] as const;

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|bmp|heic)(?:\?|#|$|[^a-z0-9])/i;
const IMG_PREFIX_RE = /\bIMG_/i;

export function normalizeMauUsoText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

/** Campos textuais da OS usados na regra (não há Descricao na API analítica). */
export function mauUsoHaystack(item: Pick<
  OsAnaliticoItem,
  "Causa" | "Ocorrencia" | "ObservacaoDaOS" | "Servico" | "Pendencia" | "JustificativaEncerramento"
>) {
  return [
    item.Causa,
    item.Ocorrencia,
    item.ObservacaoDaOS,
    item.Servico,
    item.Pendencia,
    item.JustificativaEncerramento,
  ]
    .map((v) => normalizeMauUsoText(String(v ?? "")))
    .join(" | ");
}

export function matchedMauUsoKeywords(haystack: string): string[] {
  const text = normalizeMauUsoText(haystack);
  return MAU_USO_KEYWORDS.filter((k) => text.includes(normalizeMauUsoText(k)));
}

export function isMauUsoOs(item: OsAnaliticoItem) {
  return matchedMauUsoKeywords(mauUsoHaystack(item)).length > 0;
}

export function isImageAnexo(anexo: string | null | undefined, link?: string | null) {
  const name = anexo ?? "";
  const href = link ?? "";
  // Testa nome e link em separado — concatenar quebrava `\.(ext)$` quando o link vinha depois.
  return IMAGE_EXT_RE.test(`${name} `) || IMAGE_EXT_RE.test(`${href} `) || IMG_PREFIX_RE.test(name) || IMG_PREFIX_RE.test(href);
}

export type AnexosOsIndex = {
  byCodigo: Map<string, AnexoOsItem[]>;
  byId: Map<number, AnexoOsItem[]>;
};

export function buildAnexosOsIndex(anexos: AnexoOsItem[]): AnexosOsIndex {
  const byCodigo = new Map<string, AnexoOsItem[]>();
  const byId = new Map<number, AnexoOsItem[]>();
  for (const a of anexos) {
    const code = String(a.CodigoOS ?? "").trim();
    if (code) {
      const list = byCodigo.get(code) ?? [];
      list.push(a);
      byCodigo.set(code, list);
    }
    if (a.OSId != null) {
      const list = byId.get(a.OSId) ?? [];
      list.push(a);
      byId.set(a.OSId, list);
    }
  }
  return { byCodigo, byId };
}

export function anexosDaOs(item: Pick<OsAnaliticoItem, "OS" | "CodigoSerialOS">, index: AnexosOsIndex) {
  const list = [
    ...(index.byCodigo.get(String(item.OS ?? "").trim()) ?? []),
    ...(index.byId.get(item.CodigoSerialOS) ?? []),
  ];
  return [...new Map(list.map((a) => [`${a.Anexo}|${a.LinkAnexo}`, a])).values()];
}

export function imagensDaOs(item: Pick<OsAnaliticoItem, "OS" | "CodigoSerialOS">, index: AnexosOsIndex) {
  return anexosDaOs(item, index).filter((a) => isImageAnexo(a.Anexo, a.LinkAnexo));
}

export type MauUsoOsRow = {
  os: OsAnaliticoItem;
  keywords: string[];
  anexos: AnexoOsItem[];
  imagens: AnexoOsItem[];
  comFoto: boolean;
};

export type MauUsoResult = {
  rows: MauUsoOsRow[];
  total: number;
  pctDasCorretivas: number | null;
  pctLabel: string;
  comFoto: number;
  keywords: readonly string[];
};

export function buildMauUso(
  corretivasNoIntervalo: OsAnaliticoItem[],
  anexos: AnexoOsItem[],
): MauUsoResult {
  const index = buildAnexosOsIndex(anexos);
  const rows: MauUsoOsRow[] = [];

  for (const os of corretivasNoIntervalo) {
    const keywords = matchedMauUsoKeywords(mauUsoHaystack(os));
    if (!keywords.length) continue;
    const anexosOs = anexosDaOs(os, index);
    const imagens = anexosOs.filter((a) => isImageAnexo(a.Anexo, a.LinkAnexo));
    rows.push({
      os,
      keywords,
      anexos: anexosOs,
      imagens,
      comFoto: imagens.length > 0,
    });
  }

  rows.sort((a, b) => {
    const da = a.os.Abertura ?? "";
    const db = b.os.Abertura ?? "";
    return db.localeCompare(da, "pt-BR") || String(a.os.OS).localeCompare(String(b.os.OS), "pt-BR");
  });

  const p = pct(rows.length, corretivasNoIntervalo.length);
  return {
    rows,
    total: rows.length,
    pctDasCorretivas: p,
    pctLabel: formatPct(p),
    comFoto: rows.filter((r) => r.comFoto).length,
    keywords: MAU_USO_KEYWORDS,
  };
}
