/**
 * Regras do cadastro próprio de contratos (sem GlobalThings).
 * Puro (sem banco/React) para ser usado na API, na tela e nos testes.
 */
import type { Contrato, ContratoInput, TipoContrato } from "./types";

export const TIPOS_CONTRATO: TipoContrato[] = ["MANUTENCAO", "LOCACAO"];
export const TIPO_LABEL: Record<TipoContrato, string> = { MANUTENCAO: "Manutenção", LOCACAO: "Locação" };
export const SEM_TIPO_LABEL = "Sem tipo";
export const MSG_FIM_ANTES_INICIO = "A data final deve ser igual ou posterior à inicial";

export function labelTipo(tipo: string | null | undefined) {
  return tipo === "MANUTENCAO" || tipo === "LOCACAO" ? TIPO_LABEL[tipo] : SEM_TIPO_LABEL;
}

/** Aceita "MANUTENCAO", "Manutenção", "manutencao" etc. */
export function parseTipo(value: unknown): TipoContrato | null {
  const s = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
  return s === "MANUTENCAO" || s === "LOCACAO" ? s : null;
}

export function isoDiaValido(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/** Hoje (YYYY-MM-DD) no fuso America/Sao_Paulo. */
export function hojeBRT(agora: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

export type SituacaoVigencia = "Vigente" | "Vencido" | "A iniciar" | "Sem vigência";

/** Fim é inclusivo em BRT: fim=2027-01-01 → Vigente em 01/01/2027, Vencido em 02/01/2027. */
export function situacaoVigencia(c: Pick<Contrato, "inicio" | "fim">, hoje: string = hojeBRT()): SituacaoVigencia {
  if (!c.inicio && !c.fim) return "Sem vigência";
  if (c.inicio && hoje < c.inicio) return "A iniciar";
  if (c.fim && hoje > c.fim) return "Vencido";
  return "Vigente";
}

export function formatDataBR(iso: string | null | undefined) {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export type ErrosCampo = Partial<Record<"fornecedor" | "tipo" | "valorMensal" | "inicio" | "fim" | "nome", string>>;
export type ContratoValido = Omit<Contrato, "id" | "chaveImportacao">;

function texto(v: unknown) {
  const s = String(v ?? "").trim();
  return s || null;
}

function numero(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  const s = String(v).trim();
  if (!s) return null;
  // aceita "1.234,56" (pt-BR) e "1234.56"
  const norm = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(norm);
  return Number.isNaN(n) ? NaN : n;
}

/** Validação de criação/edição (tipo obrigatório; valor > 0; início obrigatório; fim ≥ início). */
export function validarContrato(input: ContratoInput): { ok: true; data: ContratoValido } | { ok: false; erros: ErrosCampo } {
  const erros: ErrosCampo = {};
  const fornecedor = texto(input.fornecedor);
  if (!fornecedor) erros.fornecedor = "Informe o fornecedor.";

  const tipo = parseTipo(input.tipo);
  if (!tipo) erros.tipo = "Escolha o tipo: Manutenção ou Locação.";

  const valor = numero(input.valorMensal);
  if (valor === null) erros.valorMensal = "Informe o valor mensal.";
  else if (!Number.isFinite(valor) || valor <= 0) erros.valorMensal = "Informe um valor maior que zero.";

  const inicio = texto(input.inicio);
  const fim = texto(input.fim);
  if (!inicio) erros.inicio = "Informe a data de início.";
  else if (!isoDiaValido(inicio)) erros.inicio = "Data de início inválida.";
  if (fim && !isoDiaValido(fim)) erros.fim = "Data final inválida.";
  if (inicio && fim && !erros.inicio && !erros.fim && fim < inicio) erros.fim = MSG_FIM_ANTES_INICIO;

  const equipamento = texto(input.equipamento);
  const nome = texto(input.nome) ?? ([equipamento, fornecedor].filter(Boolean).join(" – ") || null);

  if (Object.keys(erros).length > 0 || !nome) {
    if (!nome && !erros.fornecedor) erros.nome = "Informe o nome do contrato.";
    return { ok: false, erros };
  }

  return {
    ok: true,
    data: {
      nome,
      fornecedor: fornecedor!,
      valorMensal: Math.round(valor! * 100) / 100,
      inicio,
      fim,
      ativo: input.ativo !== false,
      observacao: texto(input.observacao) ?? undefined,
      tipo,
      equipamento,
      numero: texto(input.numero),
    },
  };
}

export function totaisPorTipo(contratos: Contrato[]) {
  const t = {
    MANUTENCAO: { qtde: 0, valor: 0 },
    LOCACAO: { qtde: 0, valor: 0 },
    SEM_TIPO: { qtde: 0, valor: 0 },
    TOTAL: { qtde: 0, valor: 0 },
  };
  for (const c of contratos) {
    const k = c.tipo === "MANUTENCAO" || c.tipo === "LOCACAO" ? c.tipo : "SEM_TIPO";
    t[k].qtde += 1;
    t[k].valor += c.valorMensal;
    t.TOTAL.qtde += 1;
    t.TOTAL.valor += c.valorMensal;
  }
  for (const k of Object.keys(t) as Array<keyof typeof t>) t[k].valor = Math.round(t[k].valor * 100) / 100;
  return t;
}
