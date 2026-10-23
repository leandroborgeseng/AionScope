/**
 * M1 (ciclo 3): regras do proxy /api/pbi/[resource] para quem chama SEM sessão de admin.
 * - Só resources da lista (nome normalizado); desconhecido → 404 sem chamar o PBI.
 * - contratos e anexos-* → 401 inteiro (valores de contrato; LinkAnexo ".../bytoken/...").
 * - Demais: ALLOWLIST por resource (lib/pbi/allowlist-publica.ts), recursiva — todo o resto sai.
 * - Verificação de segurança em runtime: campo da allowlist que case com RE_SUSPEITO_RS,
 *   nome de pessoa ou link também sai e registra aviso (console.warn, sem valores).
 * O corte acontece DEPOIS do cache do PBI (resource:querystring guarda o completo), sempre em cópias.
 */
import { PBI_ENDPOINTS, type PbiResource } from "./catalog";
import { ALLOWLIST_PUBLICA } from "./allowlist-publica";

export const RESOURCES_SO_COM_SESSAO: readonly PbiResource[] = ["contratos", "anexos-equipamento", "anexos-os", "oficina"];

/** Rede de segurança (não é a regra principal): qualquer cara de dinheiro. */
export const RE_SUSPEITO_RS = /(valor|vlr|custo|pre[cç]o|parcela|total|moeda|pgto|pagamento|r\$|brl|reais)/i;
export const RE_CAMPO_PESSOA = /^(responsavel|requisitante|tecnico|abertapor|solicitante|matricula|usuario|nome(pessoa|usuario)?$)/i;
export const RE_CAMPO_LINK = /(link|url|token|href)/i;

/**
 * Exceção explícita da rede de segurança (decisão TL+Designer, M1 ciclo 4): só estes nomes EXATOS
 * (sensível a maiúsculas) passam pela RE_SUSPEITO_RS. "Centro de custo" é nome de unidade/setor, não R$.
 * CentroDeCusto: cronograma, equipamentos, os-analitico (etiquetas e ficha do equipamento).
 * CentrosDeCusto: disp-equipamento(-mes) (filtro de empresa da disponibilidade).
 * Qualquer variação (CustoX, ValorCusto, CentroDeCustoValor, centrodecusto, CentrosDeCustoIds…) continua cortada.
 */
export const EXCECOES_RE_SUSPEITO_RS: ReadonlySet<string> = new Set(["CentroDeCusto", "CentrosDeCusto"]);

export function campoSuspeito(nome: string) {
  return (RE_SUSPEITO_RS.test(nome) && !EXCECOES_RE_SUSPEITO_RS.has(nome)) || RE_CAMPO_PESSOA.test(nome) || RE_CAMPO_LINK.test(nome);
}

/** Nome do resource normalizado (decode + trim + minúsculas); null se não estiver na lista. */
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

const avisados = new Set<string>();
function avisar(resource: string, campo: string) {
  const k = `${resource}:${campo}`;
  if (avisados.has(k)) return;
  avisados.add(k);
  console.warn(`[pbi-proxy] campo "${campo}" de "${resource}" está na allowlist mas parece R$/pessoa/link — removido sem sessão.`);
}

/** Avisos emitidos (para testes). */
export function _avisosAllowlist() {
  return [...avisados];
}

function filtrar(v: unknown, permitidos: ReadonlySet<string>, resource: string): unknown {
  if (Array.isArray(v)) return v.map((x) => filtrar(x, permitidos, resource));
  if (!v || typeof v !== "object") return v;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (!permitidos.has(k)) continue;
    if (campoSuspeito(k)) {
      avisar(resource, k);
      continue;
    }
    out[k] = filtrar(x, permitidos, resource);
  }
  return out;
}

type ComData = { ok: true; data: unknown } & Record<string, unknown>;

/** Cópia só com os campos da allowlist do resource (recursivo). Com sessão, devolve o mesmo objeto. */
export function somenteAllowlist<T>(resource: PbiResource, result: T, logado: boolean, lista = ALLOWLIST_PUBLICA[resource]): T {
  if (logado) return result;
  const r = result as unknown as ComData;
  if (!r || r.ok !== true) return result;
  const permitidos = new Set(lista ?? []);
  return { ...r, data: filtrar(r.data, permitidos, resource), parcialSemSessao: true } as unknown as T;
}
