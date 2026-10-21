/**
 * Importação idempotente dos contratos do CSV de 20/10/2026 (sem dependência do Next).
 * Chave natural: csv-20-10:<n>, n = linha de dados (1..16, sem o cabeçalho).
 * Reimportação não sobrescreve contratos já existentes (preserva edições feitas na tela).
 */
import { createHash, randomUUID } from "crypto";
import type Database from "better-sqlite3";
import { parseTipo } from "./contratos-proprios";
import type { TipoContrato } from "./types";

export const CSV_20_10_SHA256 = "4a7ad4ccfb1bc6fc65610603873fef12172c080202d6de5cde719f043252b11d";
export const CHAVE_PREFIXO = "csv-20-10";
export const VIGENCIA_INICIO = "2026-01-01";
/** Fim inclusivo em BRT. */
export const VIGENCIA_FIM = "2027-01-01";
export const ESPERADO = {
  MANUTENCAO: { qtde: 10, centavos: 12_400_414 },
  LOCACAO: { qtde: 6, centavos: 4_209_486 },
  TOTAL: { qtde: 16, centavos: 16_609_900 },
} as const;

export type LinhaCsv = {
  n: number;
  chave: string;
  fornecedor: string;
  equipamento: string;
  valorCentavos: number;
  tipo: TipoContrato;
};

export function sha256(buf: Buffer | string) {
  return createHash("sha256").update(buf).digest("hex");
}

function centavos(valor: string, n: number) {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(valor.trim());
  if (!m) throw new Error(`Linha ${n}: valor_mensal inválido.`);
  return Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0"));
}

export function parseCsvContratos(conteudo: string, prefixo = CHAVE_PREFIXO): LinhaCsv[] {
  const linhas = conteudo.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  const cab = linhas.shift()?.split(";").map((c) => c.trim().toLowerCase());
  if (!cab || cab.join(";") !== "fornecedor;equipamento;valor_mensal;tipo") {
    throw new Error("Cabeçalho inesperado (esperado fornecedor;equipamento;valor_mensal;tipo).");
  }
  return linhas.map((l, i) => {
    const n = i + 1;
    const cols = l.split(";");
    if (cols.length !== 4) throw new Error(`Linha ${n}: esperado 4 colunas.`);
    const tipo = parseTipo(cols[3]);
    if (!tipo) throw new Error(`Linha ${n}: tipo inválido.`);
    const fornecedor = cols[0].trim();
    const equipamento = cols[1].trim();
    if (!fornecedor || !equipamento) throw new Error(`Linha ${n}: fornecedor/equipamento vazio.`);
    const valorCentavos = centavos(cols[2], n);
    if (valorCentavos <= 0) throw new Error(`Linha ${n}: valor deve ser > 0.`);
    return { n, chave: `${prefixo}:${n}`, fornecedor, equipamento, valorCentavos, tipo };
  });
}

export function totaisLinhas(linhas: Array<{ tipo: TipoContrato; valorCentavos: number }>) {
  const t = { MANUTENCAO: { qtde: 0, centavos: 0 }, LOCACAO: { qtde: 0, centavos: 0 }, TOTAL: { qtde: 0, centavos: 0 } };
  for (const l of linhas) {
    t[l.tipo].qtde += 1;
    t[l.tipo].centavos += l.valorCentavos;
    t.TOTAL.qtde += 1;
    t.TOTAL.centavos += l.valorCentavos;
  }
  return t;
}

export function totaisConferem(t: ReturnType<typeof totaisLinhas>, esperado = ESPERADO) {
  return (["MANUTENCAO", "LOCACAO", "TOTAL"] as const).every(
    (k) => t[k].qtde === esperado[k].qtde && t[k].centavos === esperado[k].centavos,
  );
}

export function formatCentavos(c: number) {
  return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function migration009Aplicada(db: Database.Database) {
  const cols = new Set((db.prepare("PRAGMA table_info(contratos)").all() as Array<{ name: string }>).map((c) => c.name));
  return ["tipo", "equipamento", "numero", "chave_importacao"].every((c) => cols.has(c));
}

export type ResultadoImportacao = { inseridos: string[]; existentes: string[] };

/** Planeja (dryRun) ou executa a importação em transação. */
export function importarContratos(db: Database.Database, linhas: LinhaCsv[], opts: { dryRun: boolean }): ResultadoImportacao {
  const res: ResultadoImportacao = { inseridos: [], existentes: [] };
  const temColuna = migration009Aplicada(db);
  if (!opts.dryRun && !temColuna) {
    throw new Error("Migration 009 não aplicada neste banco. Suba a versão nova do app antes de importar.");
  }
  const existe = temColuna ? db.prepare("SELECT id FROM contratos WHERE chave_importacao = ?") : null;
  const ins = opts.dryRun
    ? null
    : db.prepare(`INSERT INTO contratos (
        id, nome, fornecedor, valor_mensal, inicio, fim, ativo, observacao, tipo, equipamento, numero, chave_importacao,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, NULL, ?, ?, ?)`);
  const run = () => {
    const now = new Date().toISOString();
    for (const l of linhas) {
      if (existe?.get(l.chave)) {
        res.existentes.push(l.chave);
        continue;
      }
      res.inseridos.push(l.chave);
      ins?.run(
        randomUUID(),
        `${l.equipamento} – ${l.fornecedor}`,
        l.fornecedor,
        l.valorCentavos / 100,
        VIGENCIA_INICIO,
        VIGENCIA_FIM,
        "Importado do CSV de 20/10/2026",
        l.tipo,
        l.equipamento,
        l.chave,
        now,
        now,
      );
    }
  };
  if (opts.dryRun) run();
  else db.transaction(run)();
  return res;
}

/** Totais no banco dos contratos com a chave da importação. */
export function totaisImportadosNoBanco(db: Database.Database, prefixo = CHAVE_PREFIXO) {
  if (!migration009Aplicada(db)) return totaisLinhas([]);
  const rows = db
    .prepare("SELECT tipo, valor_mensal FROM contratos WHERE chave_importacao LIKE ?")
    .all(`${prefixo}:%`) as Array<{ tipo: TipoContrato; valor_mensal: number }>;
  return totaisLinhas(rows.map((r) => ({ tipo: r.tipo, valorCentavos: Math.round(r.valor_mensal * 100) })));
}
