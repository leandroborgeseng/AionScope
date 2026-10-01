/**
 * Amostra cada API PBI configurada no .env.local.
 * Grava só em docs/sala/api-samples/ (gitignored). Não imprime tokens.
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { addMonths, format } from "date-fns";
import { fetchPbi } from "../lib/pbi/client";
import { PBI_ENDPOINTS, type PbiResource } from "../lib/pbi/catalog";
import { nowInSaoPaulo } from "../lib/pbi/dates";
import { EMPTY_FILTERS, toUpstreamParams, type DashboardFilters } from "../lib/pbi/filters";

const OUT_DIR = "docs/sala/api-samples";

type Job = {
  nome: string;
  resource: PbiResource;
  params: URLSearchParams;
};

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    let raw = "";
    try {
      raw = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const line of raw.split(/\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq);
      if (!(key in process.env)) {
        process.env[key] = trimmed.slice(eq + 1).replace(/^"|"$/g, "");
      }
    }
  }
}

function rowsOf(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.filter((row) => row && typeof row === "object") as Record<string, unknown>[];
  if (data && typeof data === "object") return [data as Record<string, unknown>];
  return [];
}

function inferType(values: unknown[]): string {
  const present = values.filter((v) => v != null && v !== "");
  if (!present.length) return "vazio";
  const kinds = new Set(present.map((v) => (Array.isArray(v) ? "array" : typeof v)));
  if (kinds.size > 1) return [...kinds].sort().join("|");
  const kind = [...kinds][0];
  if (kind === "string") {
    const sample = String(present[0]);
    if (/^\d{2}\/\d{2}\/\d{4}/.test(sample) || /^\d{4}-\d{2}-\d{2}/.test(sample)) return "data";
    if (/^-?\d+([.,]\d+)?$/.test(sample.trim()) && present.every((v) => /^-?\d+([.,]\d+)?$/.test(String(v).trim()))) {
      return "numero-texto";
    }
    return "texto";
  }
  return kind ?? "desconhecido";
}

function clip(value: unknown): unknown {
  if (typeof value === "string" && value.length > 240) return `${value.slice(0, 240)}…`;
  if (Array.isArray(value)) return value.slice(0, 3).map(clip);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 12)) out[k] = clip(v);
    return out;
  }
  return value;
}

function summarize(rows: Record<string, unknown>[]) {
  const keys = new Set<string>();
  for (const row of rows) for (const key of Object.keys(row)) keys.add(key);

  const colunas = [...keys].sort().map((coluna) => {
    const values = rows.map((row) => row[coluna]);
    const nulos = values.filter((v) => v == null || v === "").length;
    const textos = values
      .filter((v) => typeof v === "string")
      .map((v) => (v as string).trim())
      .filter(Boolean);
    const freq = new Map<string, number>();
    for (const text of textos) {
      if (text.length > 80) continue;
      freq.set(text, (freq.get(text) ?? 0) + 1);
    }
    const distintos = [...freq.entries()].sort((a, b) => b[1] - a[1]);
    const exemplo = values.find((v) => v != null && v !== "");
    return {
      coluna,
      tipo: inferType(values),
      nulosPct: rows.length ? Math.round((nulos / rows.length) * 1000) / 10 : 100,
      distintos: distintos.length,
      amostraDistintos: distintos.slice(0, 10).map(([valor, qtd]) => ({ valor, qtd })),
      exemplo: clip(exemplo ?? null),
    };
  });

  return {
    totalLinhas: rows.length,
    colunas,
    exemploLinhas: rows.slice(0, 20).map((row) => {
      const clipped: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) clipped[k] = clip(v);
      return clipped;
    }),
  };
}

function jobs(filters: DashboardFilters): Job[] {
  const wide = { periodo: "DoisAnosAtuais", qtdPorPagina: "100000" };
  return [
    { nome: "CRONOGRAMA", resource: "cronograma", params: toUpstreamParams("cronograma", filters) },
    { nome: "TIPO_MANUTENCAO", resource: "tipo-manutencao", params: toUpstreamParams("tipo-manutencao", filters) },
    { nome: "OS_ANALITICO", resource: "os-analitico", params: toUpstreamParams("os-analitico", filters, wide) },
    { nome: "OS_ANALITICO_RESUMIDO", resource: "os-resumida", params: toUpstreamParams("os-resumida", filters, wide) },
    {
      nome: "EQUIPAMENTOS",
      resource: "equipamentos",
      params: toUpstreamParams("equipamentos", filters, {
        apenasAtivos: "false",
        incluirComponentes: "false",
        incluirCustoSubstituicao: "true",
      }),
    },
    { nome: "TMEF", resource: "tmef", params: toUpstreamParams("tmef", filters) },
    { nome: "TPM", resource: "tpm", params: toUpstreamParams("tpm", filters) },
    { nome: "DISP_EQUIPAMENTO", resource: "disp-equipamento", params: toUpstreamParams("disp-equipamento", filters) },
    {
      nome: "DISP_EQUIPAMENTO_MES",
      resource: "disp-equipamento-mes",
      params: toUpstreamParams("disp-equipamento-mes", filters),
    },
    { nome: "MONITOR_REACAO", resource: "monitor-reacao", params: toUpstreamParams("monitor-reacao", filters) },
    { nome: "MONITOR_ATENDIMENTO", resource: "monitor-atendimento", params: toUpstreamParams("monitor-atendimento", filters) },
    { nome: "ANEXOS_EQUIPAMENTO", resource: "anexos-equipamento", params: new URLSearchParams() },
    { nome: "ANEXOS_OS", resource: "anexos-os", params: new URLSearchParams() },
    { nome: "OFICINA", resource: "oficina", params: toUpstreamParams("oficina", filters) },
  ];
}

async function main() {
  loadEnv();
  if (!process.env.PBI_TOKEN_OS_ANALITICO) {
    console.error("PBI_TOKEN_OS_ANALITICO ausente. Configure .env.local.");
    process.exit(1);
  }
  if (process.env.PBI_TOKEN_CONTRATOS) {
    console.log("CONTRATOS tem token; a Fase 1 pede para pular. Não consultado.");
  } else {
    console.log("CONTRATOS sem token. Pulado.");
  }

  const today = nowInSaoPaulo();
  const filters: DashboardFilters = {
    ...EMPTY_FILTERS,
    from: format(addMonths(today, -12), "yyyy-MM-dd"),
    to: format(today, "yyyy-MM-dd"),
    tipoManutencao: "Todos",
    somenteMedicos: false,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const indice: Array<Record<string, unknown>> = [];

  for (const job of jobs(filters)) {
    const tokenEnv = PBI_ENDPOINTS[job.resource].tokenEnv;
    if (!process.env[tokenEnv]) {
      console.log(`${job.nome} sem token (${tokenEnv}). Pulado.`);
      indice.push({ nome: job.nome, ok: false, motivo: "token ausente" });
      continue;
    }
    process.stdout.write(`${job.nome}… `);
    const result = await fetchPbi<unknown>(job.resource, job.params);
    if (!result.ok) {
      console.log(`falhou ${result.status ?? "rede"}`);
      const payload = {
        nome: job.nome,
        resource: job.resource,
        ok: false,
        status: result.status,
        message: result.message,
        geradoEm: new Date().toISOString(),
      };
      writeFileSync(`${OUT_DIR}/${job.nome}.json`, JSON.stringify(payload, null, 2));
      indice.push({ nome: job.nome, ok: false, status: result.status });
      continue;
    }
    const summary = summarize(rowsOf(result.data));
    writeFileSync(
      `${OUT_DIR}/${job.nome}.json`,
      JSON.stringify(
        {
          nome: job.nome,
          resource: job.resource,
          ok: true,
          consulta: job.params.toString(),
          totalInformado: result.total ?? summary.totalLinhas,
          geradoEm: result.cachedAt,
          ...summary,
        },
        null,
        2,
      ),
    );
    console.log(`${summary.totalLinhas} linhas, ${summary.colunas.length} colunas`);
    indice.push({ nome: job.nome, ok: true, linhas: summary.totalLinhas, colunas: summary.colunas.length });
  }

  writeFileSync(`${OUT_DIR}/_indice.json`, JSON.stringify({ geradoEm: new Date().toISOString(), indice }, null, 2));
  console.log("pronto", OUT_DIR);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "falha");
  process.exit(1);
});
