/**
 * Correção em lote de contratos (scripts/corrigir-contratos.ts).
 * Puro: valida a entrada, simula as operações em memória (dry-run) e calcula os totais mensais
 * do indicador de custo do parque com a mesma regra da tela (contratoContaNoIndicador).
 * A entrada real fica FORA do repositório (repo público): aqui não há valores nem fornecedores.
 */
import { contratoContaNoIndicador, diaAnterior, isoDiaValido, validarContrato, validarSuspensao } from "./contratos-proprios";
import type { Contrato, ContratoInput } from "./types";

/** Conferência opcional: aborta se o contrato do id não bater (evita aplicar no contrato errado). */
export type Conferir = { valorMensal?: number; fornecedor?: string; equipamento?: string };

export type Operacao =
  | { op: "descricao"; id: string; equipamento?: string; nome?: string; observacao?: string; conferir?: Conferir; nota?: string }
  | { op: "inativar"; id: string; desde: "inicio" | string; conferir?: Conferir; nota?: string }
  | { op: "suspender"; id: string; de: string; ate: string; conferir?: Conferir; nota?: string }
  | { op: "criar"; contrato: ContratoInput; nota?: string };

export type Entrada = { meses: { de: string; ate: string }; operacoes: Operacao[] };

/** Chamada HTTP que o --apply fará (PATCH/POST na API do app). */
export type Chamada = { metodo: "PATCH" | "POST"; caminho: string; body: Record<string, unknown> };

export type Passo = { indice: number; op: Operacao["op"]; id: string; antes: Contrato | null; depois: Contrato; chamada: Chamada };

const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const PLACEHOLDER_RE = /^<.*>$|PENDENTE/i;

export function ehPlaceholder(v: unknown) {
  return typeof v === "string" && PLACEHOLDER_RE.test(v);
}

function conferir(c: Contrato, k: Conferir | undefined): string | null {
  if (!k) return null;
  if (k.valorMensal !== undefined && Math.abs(c.valorMensal - k.valorMensal) > 0.004)
    return `valorMensal ${c.valorMensal} ≠ ${k.valorMensal}`;
  const norm = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
  if (k.fornecedor !== undefined && !norm(c.fornecedor).includes(norm(k.fornecedor))) return `fornecedor "${c.fornecedor}" ≠ "${k.fornecedor}"`;
  if (k.equipamento !== undefined && !norm(c.equipamento).includes(norm(k.equipamento))) return `equipamento "${c.equipamento}" ≠ "${k.equipamento}"`;
  return null;
}

/** Valida a estrutura da entrada. Placeholders (<...> / PENDENTE) são erro: nada roda com dado faltando. */
export function validarEntrada(e: unknown): { ok: true; entrada: Entrada } | { ok: false; erros: string[] } {
  const erros: string[] = [];
  const x = e as Partial<Entrada> | null;
  if (!x || typeof x !== "object") return { ok: false, erros: ["Entrada não é um objeto JSON."] };
  if (!x.meses || !MES_RE.test(String(x.meses.de)) || !MES_RE.test(String(x.meses.ate)) || x.meses.ate < x.meses.de)
    erros.push('meses: informe { "de": "AAAA-MM", "ate": "AAAA-MM" } com ate ≥ de.');
  if (!Array.isArray(x.operacoes) || x.operacoes.length === 0) erros.push("operacoes: lista vazia.");
  (x.operacoes ?? []).forEach((o, i) => {
    const p = `operacoes[${i}] (${(o as Operacao)?.op ?? "?"})`;
    const pend = Object.entries(o ?? {}).filter(([k]) => k !== "nota").flatMap(([k, v]) =>
      v && typeof v === "object" ? Object.entries(v).filter(([, w]) => ehPlaceholder(w)).map(([k2]) => `${k}.${k2}`) : ehPlaceholder(v) ? [k] : [],
    );
    if (pend.length) erros.push(`${p}: campo(s) pendente(s): ${pend.join(", ")}.`);
    switch (o?.op) {
      case "descricao":
        if (!o.id) erros.push(`${p}: id obrigatório.`);
        if (o.equipamento === undefined && o.nome === undefined && o.observacao === undefined) erros.push(`${p}: informe equipamento, nome ou observacao.`);
        break;
      case "inativar":
        if (!o.id) erros.push(`${p}: id obrigatório.`);
        if (o.desde !== "inicio" && !ehPlaceholder(o.desde) && !isoDiaValido(String(o.desde))) erros.push(`${p}: desde deve ser "inicio" ou AAAA-MM-DD.`);
        break;
      case "suspender": {
        if (!o.id) erros.push(`${p}: id obrigatório.`);
        const s = validarSuspensao(o.de, o.ate);
        if (!pend.length && (!s.ok || s.de === null)) erros.push(`${p}: ${s.ok ? "informe de e ate." : s.erro}`);
        break;
      }
      case "criar": {
        if (!pend.length) {
          const v = validarContrato(o.contrato ?? ({} as ContratoInput));
          if (!v.ok) erros.push(`${p}: ${Object.values(v.erros).join(" ")}`);
        }
        break;
      }
      default:
        erros.push(`${p}: op desconhecida (use descricao, inativar, suspender ou criar).`);
    }
  });
  return erros.length ? { ok: false, erros } : { ok: true, entrada: x as Entrada };
}

/** Simula as operações sobre a lista atual. Não muda nada fora da memória. */
export function planejar(contratos: Contrato[], entrada: Entrada): { ok: true; passos: Passo[]; final: Contrato[] } | { ok: false; erros: string[] } {
  const mapa = new Map(contratos.map((c) => [c.id, { ...c }]));
  const passos: Passo[] = [];
  const erros: string[] = [];
  entrada.operacoes.forEach((o, i) => {
    if (o.op === "criar") {
      const v = validarContrato(o.contrato);
      if (!v.ok) return void erros.push(`operacoes[${i}]: contrato inválido.`);
      const novo: Contrato = { id: `(novo-${i})`, ...v.data, inativadoEm: null, suspensoDe: null, suspensoAte: null };
      mapa.set(novo.id, novo);
      passos.push({ indice: i, op: o.op, id: novo.id, antes: null, depois: novo, chamada: { metodo: "POST", caminho: "/api/cadastros/contratos", body: { ...o.contrato } } });
      return;
    }
    const atual = mapa.get(o.id);
    if (!atual) return void erros.push(`operacoes[${i}] (${o.op}): contrato id ${o.id} não encontrado.`);
    const dif = conferir(atual, o.conferir);
    if (dif) return void erros.push(`operacoes[${i}] (${o.op}) id ${o.id}: conferência falhou — ${dif}.`);
    const antes = { ...atual };
    let depois: Contrato;
    let chamada: Chamada;
    const caminho = `/api/cadastros/contratos/${encodeURIComponent(o.id)}`;
    if (o.op === "descricao") {
      const equipamento = o.equipamento ?? atual.equipamento ?? null;
      // Mantém o formato do nome atual (importado ou da tela): só troca o trecho do equipamento antigo.
      const nome =
        o.nome ??
        (o.equipamento !== undefined && atual.equipamento && atual.nome.includes(atual.equipamento)
          ? atual.nome.replace(atual.equipamento, o.equipamento)
          : atual.nome);
      depois = { ...atual, equipamento, nome, observacao: o.observacao ?? atual.observacao };
      const body: Record<string, unknown> = { equipamento, nome };
      if (o.observacao !== undefined) body.observacao = o.observacao;
      chamada = { metodo: "PATCH", caminho, body };
    } else if (o.op === "inativar") {
      const contaAte = o.desde === "inicio" ? null : diaAnterior(o.desde);
      depois = { ...atual, ativo: false, inativadoEm: contaAte ? `${contaAte}T23:59:59-03:00` : null };
      chamada = { metodo: "PATCH", caminho, body: { ativo: false, contaAte } };
    } else {
      depois = { ...atual, suspensoDe: o.de, suspensoAte: o.ate };
      chamada = { metodo: "PATCH", caminho, body: { suspensoDe: o.de, suspensoAte: o.ate } };
    }
    mapa.set(o.id, depois);
    passos.push({ indice: i, op: o.op, id: o.id, antes, depois, chamada });
  });
  return erros.length ? { ok: false, erros } : { ok: true, passos, final: [...mapa.values()] };
}

export function listarMeses(de: string, ate: string) {
  const out: Array<{ chave: string; year: number; month: number }> = [];
  let [y, m] = de.split("-").map(Number);
  const [y2, m2] = ate.split("-").map(Number);
  while (y * 12 + m <= y2 * 12 + m2) {
    out.push({ chave: `${y}-${String(m).padStart(2, "0")}`, year: y, month: m - 1 });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

export type TotalMes = { mes: string; qtde: number; valor: number };

/** Totais mensais do indicador (só contratos; OS ficam de fora). */
export function totaisMensais(contratos: Contrato[], de: string, ate: string): TotalMes[] {
  return listarMeses(de, ate).map(({ chave, year, month }) => {
    const conta = contratos.filter((c) => contratoContaNoIndicador(c, year, month));
    return { mes: chave, qtde: conta.length, valor: Math.round(conta.reduce((s, c) => s + c.valorMensal, 0) * 100) / 100 };
  });
}
