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

// ---------------------------------------------------------------------------
// Inativação com data (migração 010 — coluna inativado_em)

const MESES_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Data/hora atual em America/Sao_Paulo no formato ISO com offset (ex.: 2026-10-20T21:50:00-03:00). */
export function agoraBRTIso(agora: Date = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(agora)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}-03:00`;
}

/** Mês (0–11) e ano da inativação, lidos da parte de data (já em BRT). */
export function mesDaInativacao(inativadoEm: string | null | undefined): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})-\d{2}/.exec(inativadoEm ?? "");
  return m ? { year: Number(m[1]), month: Number(m[2]) - 1 } : null;
}

function isoMes(year: number, month: number, dia: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Regra do indicador de custo do parque (aceite C1–C5):
 * - só tipo MANUTENCAO (Locação / sem tipo nunca);
 * - mês inteiro se a vigência cobre ≥ 1 dia do mês (fim inclusivo, datas BRT);
 * - inativo conta nos meses ≤ mês de inativado_em; inativo sem data não conta.
 * `month` é 0–11.
 */
export function contratoContaNoIndicador(
  c: Pick<Contrato, "tipo" | "valorMensal" | "inicio" | "fim" | "ativo" | "inativadoEm" | "suspensoDe" | "suspensoAte">,
  year: number,
  month: number,
) {
  if (c.tipo !== "MANUTENCAO") return false;
  if (!(c.valorMensal > 0)) return false;
  const primeiro = isoMes(year, month, 1);
  const ultimo = isoMes(year, month, new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  if (c.inicio && c.inicio > ultimo) return false;
  if (c.fim && c.fim < primeiro) return false;
  if (!c.ativo) {
    const ina = mesDaInativacao(c.inativadoEm);
    if (!ina) return false;
    if (year * 12 + month > ina.year * 12 + ina.month) return false;
  }
  // Suspensão (013): o mês sai só se a suspensão cobre todos os dias do mês dentro da vigência.
  if (c.suspensoDe && c.suspensoAte) {
    const a = c.inicio && c.inicio > primeiro ? c.inicio : primeiro;
    const b = c.fim && c.fim < ultimo ? c.fim : ultimo;
    if (c.suspensoDe <= a && c.suspensoAte >= b) return false;
  }
  return true;
}

/** Estaria no indicador neste mês se não fosse a suspensão. */
export function contratoSuspensoNoMes(
  c: Pick<Contrato, "tipo" | "valorMensal" | "inicio" | "fim" | "ativo" | "inativadoEm" | "suspensoDe" | "suspensoAte">,
  year: number,
  month: number,
) {
  if (!c.suspensoDe || !c.suspensoAte) return false;
  return !contratoContaNoIndicador(c, year, month) && contratoContaNoIndicador({ ...c, suspensoDe: null, suspensoAte: null }, year, month);
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "Retorna em" (1º dia que volta a contar) = dia seguinte ao fim da suspensão. */
export function diaSeguinte(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Valida suspensão: ambas nulas (limpar) ou ambas datas válidas com fim ≥ início. */
export function validarSuspensao(de: unknown, ate: unknown): { ok: true; de: string | null; ate: string | null } | { ok: false; erro: string } {
  if ((de === null || de === undefined) && (ate === null || ate === undefined)) return { ok: true, de: null, ate: null };
  if (typeof de !== "string" || !isoDiaValido(de)) return { ok: false, erro: "Data de início da suspensão inválida." };
  if (typeof ate !== "string" || !isoDiaValido(ate)) return { ok: false, erro: "Data de retorno da suspensão inválida." };
  if (ate < de) return { ok: false, erro: MSG_RETORNO_ANTES };
  // Suspensão vale por mês inteiro: de → dia 1 do mês; ate → último dia do mês.
  const [ya, ma] = ate.split("-").map(Number);
  const fimMes = new Date(Date.UTC(ya, ma, 0)).toISOString().slice(0, 10);
  return { ok: true, de: `${de.slice(0, 7)}-01`, ate: fimMes };
}

/** Dia anterior (YYYY-MM-DD). */
export function diaAnterior(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/** Selo (UX): "Suspenso até jul/27" = mês em que volta a contar; null se não suspenso em `hoje`. */
export function rotuloSuspensao(c: Pick<Contrato, "suspensoDe" | "suspensoAte">, hoje: string = hojeBRT()) {
  if (!c.suspensoDe || !c.suspensoAte || hoje < c.suspensoDe || hoje > c.suspensoAte) return null;
  const r = diaSeguinte(c.suspensoAte);
  return `Suspenso até ${MESES_CURTOS[Number(r.slice(5, 7)) - 1]}/${r.slice(2, 4)}`;
}

export const MSG_RETORNO_ANTES = "A data de retorno deve ser depois do início da suspensão.";

function nomeContrato(c: Pick<Contrato, "fornecedor" | "equipamento" | "nome">) {
  return [c.fornecedor, c.equipamento].filter(Boolean).join(" – ") || c.nome;
}

export function textoConfirmarInativar(
  c: Pick<Contrato, "fornecedor" | "equipamento" | "nome">,
  agora: Date = new Date(),
) {
  const ina = mesDaInativacao(agoraBRTIso(agora))!;
  return `Inativar ${nomeContrato(c)}? Ele deixa de contar no indicador a partir do mês seguinte. Os meses até ${MESES_PT[ina.month]}/${ina.year} continuam no acumulado.`;
}

export function textoConfirmarReativar(c: Pick<Contrato, "fornecedor" | "equipamento" | "nome">) {
  return `Reativar ${nomeContrato(c)}? Ele volta a contar em toda a vigência.`;
}

/** Rótulo da lista de inativos. */
export function rotuloInativado(c: Pick<Contrato, "ativo" | "inativadoEm">) {
  if (c.ativo) return null;
  const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(c.inativadoEm ?? "");
  return d ? `Inativado em ${d[3]}/${d[2]}/${d[1]}` : "Inativado (sem data)";
}
