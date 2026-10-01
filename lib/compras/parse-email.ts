export type SituacaoCompra =
  | "aguarda SC"
  | "cobrar Manutenção"
  | "aguarda entrega"
  | "cobrar Compras"
  | "entregue"
  | "vincular a uma OS";

export type CamposExtraidos = {
  os: string | null;
  tag: string | null;
  equipamento: string | null;
  item: string | null;
  setor: string | null;
  sc: string | null;
  entregueEm: string | null;
};

const RE_OS_ASSUNTO = /\[OS\s*(\d{6,12})\]/i;
const RE_SEM_OS = /\[SEM\s*OS\]/i;
const RE_OS_CORPO = /\bOS[:\s#nº°.-]*(\d{6,12})\b/i;
const RE_TAG = /\bHSJ-\d{5}\b/i;
const RE_SC =
  /\bSC\b[\s:#nº°.-]*(\d{3,8})|solicita[çc][ãa]o\s+de\s+compra[\s:#nº°.-]*(\d{3,8})/i;
const RE_ENTREGUE = /ENTREGUE:\s*(\d{2}\/\d{2}\/\d{4})/i;
const RE_EQUIPAMENTO = /Equipamento:\s*([^\n]+)/i;
const RE_SETOR = /Setor:\s*([^\n]+)/i;
const RE_ITEM = /Item(?:\(ns\))?:\s*\n?\s*(?:1\.\s*)?([^\n]+)/i;

export function extrairOs(assunto: string, corpo = ""): string | null {
  if (RE_SEM_OS.test(assunto)) return null;
  const doAssunto = assunto.match(RE_OS_ASSUNTO);
  if (doAssunto?.[1]) return doAssunto[1];
  const doCorpo = corpo.match(RE_OS_CORPO);
  return doCorpo?.[1] ?? null;
}

export function extrairTag(texto: string): string | null {
  const m = texto.match(RE_TAG);
  return m ? m[0].toUpperCase() : null;
}

export function extrairSc(texto: string): string | null {
  const m = texto.match(RE_SC);
  return m?.[1] || m?.[2] || null;
}

export function extrairEntrega(texto: string): string | null {
  const m = texto.match(RE_ENTREGUE);
  if (!m?.[1]) return null;
  const [dd, mm, yyyy] = m[1].split("/");
  if (!dd || !mm || !yyyy) return null;
  return `${yyyy}-${mm}-${dd}`;
}

function limparLinha(valor: string | undefined | null) {
  if (!valor) return null;
  const limpo = valor.replace(/\s+/g, " ").trim();
  return limpo || null;
}

/** Extrai campos do padrão de e-mail da EC (assunto + trecho do corpo). */
export function extrairCamposPedido(assunto: string, corpo = ""): CamposExtraidos {
  const texto = `${assunto}\n${corpo}`;
  const equipamentoLinha = limparLinha(corpo.match(RE_EQUIPAMENTO)?.[1]);
  let equipamento = equipamentoLinha;
  let tag = extrairTag(texto);
  if (equipamentoLinha?.includes("·")) {
    const [nome, talvezTag] = equipamentoLinha.split("·").map((p) => p.trim());
    equipamento = nome || equipamento;
    if (!tag && talvezTag) tag = extrairTag(talvezTag) ?? tag;
  }
  const itemAssunto = assunto.match(/Solicita[çc][ãa]o de compra\s*[–—-]\s*([^–—-]+)/i)?.[1];
  return {
    os: extrairOs(assunto, corpo),
    tag,
    equipamento,
    item: limparLinha(corpo.match(RE_ITEM)?.[1]) || limparLinha(itemAssunto),
    setor: limparLinha(corpo.match(RE_SETOR)?.[1]),
    sc: extrairSc(corpo) || extrairSc(assunto),
    entregueEm: extrairEntrega(corpo),
  };
}

export function listaEnv(name: string, fallback: string[]): string[] {
  const bruta = (process.env[name] ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return bruta.length ? bruta : fallback;
}

export function caixasM365() {
  return listaEnv("M365_CAIXAS", ["leandro.borges@aion.eng.br", "oficina@aion.eng.br"]);
}

export function destinosCompras() {
  return listaEnv("COMPRAS_DESTINOS", ["compras@hsj.com.br", "manutencao@hsj.com.br"]);
}

export function prazoScDiasUteis() {
  const n = Number(process.env.COMPRAS_PRAZO_SC_DIAS_UTEIS ?? 2);
  return Number.isFinite(n) && n > 0 ? n : 2;
}

export function prazoEntregaDias() {
  const n = Number(process.env.COMPRAS_PRAZO_ENTREGA_DIAS ?? 15);
  return Number.isFinite(n) && n > 0 ? n : 15;
}

export function m365Configurado() {
  return Boolean(
    process.env.M365_TENANT_ID?.trim() &&
      process.env.M365_CLIENT_ID?.trim() &&
      process.env.M365_CLIENT_SECRET?.trim(),
  );
}

/** Situação operacional a partir dos marcos e prazos. */
export function situacaoCompra(input: {
  os: string | null;
  enviadoEm: Date | null;
  scNumero: string | null;
  scEm: Date | null;
  entregueEm: Date | null;
  agora?: Date;
}): SituacaoCompra {
  const agora = input.agora ?? new Date();
  if (input.entregueEm) return "entregue";
  if (!input.os) return "vincular a uma OS";
  if (!input.scNumero) {
    if (input.enviadoEm) {
      const dias = (agora.getTime() - input.enviadoEm.getTime()) / 86_400_000;
      if (dias > prazoScDiasUteis()) return "cobrar Manutenção";
    }
    return "aguarda SC";
  }
  const desdeSc = input.scEm ?? input.enviadoEm;
  if (desdeSc) {
    const dias = (agora.getTime() - desdeSc.getTime()) / 86_400_000;
    if (dias > prazoEntregaDias()) return "cobrar Compras";
  }
  return "aguarda entrega";
}
