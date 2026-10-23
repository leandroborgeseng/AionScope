/**
 * M1 (ampliado): regras do proxy /api/pbi/[resource] para quem chama SEM sessão de admin.
 * - Só resources da lista (nome normalizado); desconhecido → 404 sem chamar o PBI.
 * - contratos e anexos-* → 401 inteiro (valores de contrato; LinkAnexo ".../bytoken/...").
 * - Demais: remove campos em R$ (lista explícita + regra /^(valor|custo|preco)/i) e nomes de
 *   pessoas, recursivamente. Com sessão, nada muda.
 * O corte acontece DEPOIS do cache do PBI (resource:querystring guarda o completo), sempre em cópias.
 */
import { PBI_ENDPOINTS, type PbiResource } from "./catalog";

export const RESOURCES_SO_COM_SESSAO: readonly PbiResource[] = ["contratos", "anexos-equipamento", "anexos-os"];

export const CAMPOS_RS = [
  "Custo", "Valor", "ValorTotal", "CustoPrevisto", "CustoRealizado", "ValorMoeda", "ValorPgto",
  "ValorDeSubstituicao", "ValorDeAquisicao",
] as const;
export const RE_CAMPO_RS = /^(valor|custo|pre[cç]o)/i;

export const CAMPOS_PESSOA = [
  "Responsavel", "Requisitante", "TecnicoResolvedor", "AbertaPor", "MatriculaResponsavel", "MatriculaResolvedor",
] as const;
export const RE_CAMPO_PESSOA = /^(responsavel|requisitante|tecnico|abertapor|solicitante|matricula|usuario)/i;

const RS = new Set(CAMPOS_RS.map((c) => c.toLowerCase()));
const PESSOA = new Set(CAMPOS_PESSOA.map((c) => c.toLowerCase()));

/** Links com token embutido (".../bytoken/...") dão acesso direto ao arquivo. */
export const RE_CAMPO_LINK_TOKEN = /^link/i;

export function campoProibidoSemSessao(nome: string) {
  const n = nome.toLowerCase();
  return RS.has(n) || RE_CAMPO_RS.test(nome) || PESSOA.has(n) || RE_CAMPO_PESSOA.test(nome) || RE_CAMPO_LINK_TOKEN.test(nome);
}

/** Nome do resource normalizado (trim + minúsculas); null se não estiver na lista. */
export function normalizarResource(bruto: string): PbiResource | null {
  let s = bruto;
  try {
    s = decodeURIComponent(bruto);
  } catch {
    return null;
  }
  const n = s.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(PBI_ENDPOINTS, n) ? (n as PbiResource) : null;
}

function limpar(v: unknown, removidos: Set<string>): unknown {
  if (Array.isArray(v)) return v.map((x) => limpar(x, removidos));
  if (!v || typeof v !== "object") return v;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (campoProibidoSemSessao(k)) {
      removidos.add(k);
      continue;
    }
    out[k] = limpar(x, removidos);
  }
  return out;
}

type ComData = { ok: true; data: unknown } & Record<string, unknown>;

/** Cópia sem campos em R$ nem nomes de pessoas (só `data`; metadados como cache ficam). */
export function semCamposSensiveis<T>(result: T, logado: boolean): T {
  if (logado) return result;
  const r = result as unknown as ComData;
  if (!r || r.ok !== true) return result;
  const removidos = new Set<string>();
  const data = limpar(r.data, removidos);
  return { ...r, data, camposOcultos: [...removidos].sort() } as unknown as T;
}

/** @deprecated nome antigo (ciclo 1). */
export const semCamposRs = <T,>(_resource: PbiResource, result: T, logado: boolean) => semCamposSensiveis(result, logado);
