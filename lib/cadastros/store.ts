import { getDb } from "@/lib/db/client";
import type {
  Contrato,
  ParqueEscopo,
  ParqueFonte,
  ParqueMeta,
} from "./types";

type ParqueRow = {
  valor_manual: number | null;
  valor_api: number | null;
  escopo: string;
  fonte: string;
  atualizado_em: string | null;
  atualizado_por: string | null;
  valor_manual_referencia: number | null;
  notas: string | null;
};

type ContratoRow = {
  id: string;
  nome: string;
  fornecedor: string | null;
  valor_mensal: number;
  inicio: string | null;
  fim: string | null;
  ativo: number;
  observacao: string | null;
};

const EMPTY_PARQUE: ParqueMeta = {
  valorSubstituicaoManual: null,
  valorApi: null,
  fonte: "api",
  escopo: "todos",
  atualizadoEm: null,
  atualizadoPor: null,
  valorManualReferencia: 57_000_000,
  notas: null,
};

function mapParque(row: ParqueRow | undefined): ParqueMeta {
  if (!row) return { ...EMPTY_PARQUE };
  return {
    valorSubstituicaoManual:
      row.valor_manual != null && Number.isFinite(row.valor_manual) ? row.valor_manual : null,
    valorApi: row.valor_api != null && Number.isFinite(row.valor_api) ? row.valor_api : null,
    fonte: row.fonte === "manual" ? "manual" : "api",
    escopo: row.escopo === "medicos" ? "medicos" : "todos",
    atualizadoEm: row.atualizado_em,
    atualizadoPor: row.atualizado_por,
    valorManualReferencia:
      row.valor_manual_referencia != null && Number.isFinite(row.valor_manual_referencia)
        ? row.valor_manual_referencia
        : 57_000_000,
    notas: row.notas,
  };
}

function mapContrato(row: ContratoRow): Contrato {
  return {
    id: row.id,
    nome: row.nome,
    fornecedor: row.fornecedor ?? undefined,
    valorMensal: row.valor_mensal,
    inicio: row.inicio,
    fim: row.fim,
    ativo: row.ativo === 1,
    observacao: row.observacao ?? undefined,
  };
}

export function readParqueMeta(): ParqueMeta {
  const db = getDb();
  const row = db.prepare("SELECT * FROM parque_meta WHERE id = 1").get() as ParqueRow | undefined;
  return mapParque(row);
}

export function writeParqueMeta(meta: Partial<ParqueMeta> & { fonte?: ParqueFonte; escopo?: ParqueEscopo }): ParqueMeta {
  const db = getDb();
  const current = readParqueMeta();
  const next: ParqueMeta = {
    valorSubstituicaoManual:
      meta.valorSubstituicaoManual !== undefined
        ? meta.valorSubstituicaoManual
        : current.valorSubstituicaoManual,
    valorApi: meta.valorApi !== undefined ? meta.valorApi : current.valorApi,
    fonte: meta.fonte ?? current.fonte,
    escopo: meta.escopo ?? current.escopo,
    atualizadoEm: meta.atualizadoEm !== undefined ? meta.atualizadoEm : current.atualizadoEm,
    atualizadoPor:
      meta.atualizadoPor !== undefined ? meta.atualizadoPor : (current.atualizadoPor ?? null),
    valorManualReferencia:
      meta.valorManualReferencia !== undefined
        ? meta.valorManualReferencia
        : current.valorManualReferencia,
    notas: meta.notas !== undefined ? meta.notas : current.notas,
  };

  db.prepare(
    `INSERT INTO parque_meta (
      id, valor_manual, valor_api, escopo, fonte, atualizado_em, atualizado_por,
      valor_manual_referencia, notas
    ) VALUES (
      1, @valor_manual, @valor_api, @escopo, @fonte, @atualizado_em, @atualizado_por,
      @valor_manual_referencia, @notas
    )
    ON CONFLICT(id) DO UPDATE SET
      valor_manual = excluded.valor_manual,
      valor_api = excluded.valor_api,
      escopo = excluded.escopo,
      fonte = excluded.fonte,
      atualizado_em = excluded.atualizado_em,
      atualizado_por = excluded.atualizado_por,
      valor_manual_referencia = excluded.valor_manual_referencia,
      notas = excluded.notas`,
  ).run({
    valor_manual: next.valorSubstituicaoManual,
    valor_api: next.valorApi,
    escopo: next.escopo,
    fonte: next.fonte,
    atualizado_em: next.atualizadoEm,
    atualizado_por: next.atualizadoPor ?? null,
    valor_manual_referencia: next.valorManualReferencia,
    notas: next.notas ?? null,
  });

  return next;
}

export function readContratos(): Contrato[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM contratos ORDER BY nome COLLATE NOCASE ASC")
    .all() as ContratoRow[];
  return rows.map(mapContrato);
}

export function writeContratos(contratos: Contrato[]): Contrato[] {
  const db = getDb();
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM contratos").run();
    const insert = db.prepare(
      `INSERT INTO contratos (
        id, nome, fornecedor, valor_mensal, inicio, fim, ativo, observacao, created_at, updated_at
      ) VALUES (
        @id, @nome, @fornecedor, @valor_mensal, @inicio, @fim, @ativo, @observacao, @created_at, @updated_at
      )`,
    );
    for (const c of contratos) {
      insert.run({
        id: c.id,
        nome: c.nome,
        fornecedor: c.fornecedor ?? null,
        valor_mensal: c.valorMensal,
        inicio: c.inicio ?? null,
        fim: c.fim ?? null,
        ativo: c.ativo ? 1 : 0,
        observacao: c.observacao ?? null,
        created_at: now,
        updated_at: now,
      });
    }
  });
  tx();
  return readContratos();
}

export function upsertContrato(contrato: Contrato): Contrato {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = db.prepare("SELECT created_at FROM contratos WHERE id = ?").get(contrato.id) as
    | { created_at: string }
    | undefined;
  db.prepare(
    `INSERT INTO contratos (
      id, nome, fornecedor, valor_mensal, inicio, fim, ativo, observacao, created_at, updated_at
    ) VALUES (
      @id, @nome, @fornecedor, @valor_mensal, @inicio, @fim, @ativo, @observacao, @created_at, @updated_at
    )
    ON CONFLICT(id) DO UPDATE SET
      nome = excluded.nome,
      fornecedor = excluded.fornecedor,
      valor_mensal = excluded.valor_mensal,
      inicio = excluded.inicio,
      fim = excluded.fim,
      ativo = excluded.ativo,
      observacao = excluded.observacao,
      updated_at = excluded.updated_at`,
  ).run({
    id: contrato.id,
    nome: contrato.nome,
    fornecedor: contrato.fornecedor ?? null,
    valor_mensal: contrato.valorMensal,
    inicio: contrato.inicio ?? null,
    fim: contrato.fim ?? null,
    ativo: contrato.ativo ? 1 : 0,
    observacao: contrato.observacao ?? null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  });
  return contrato;
}

export function deleteContrato(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM contratos WHERE id = ?").run(id);
  return result.changes > 0;
}

/**
 * Precedência do denominador:
 * 1. Override manual (> 0), se salvo explicitamente
 * 2. Env PARQUE_VALOR_SUBSTITUICAO (deploy)
 * 3. valorApi persistido (soma todos os equipamentos)
 * 4. null — caller pode usar soma live da API
 */
export function resolveValorParque(meta: ParqueMeta): {
  valor: number | null;
  fonte: "manual" | "env" | "api" | null;
} {
  if (
    meta.valorSubstituicaoManual != null &&
    Number.isFinite(meta.valorSubstituicaoManual) &&
    meta.valorSubstituicaoManual > 0
  ) {
    return { valor: meta.valorSubstituicaoManual, fonte: "manual" };
  }
  const envRaw = process.env.PARQUE_VALOR_SUBSTITUICAO?.trim();
  if (envRaw) {
    const n = Number(envRaw.replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n) && n > 0) return { valor: n, fonte: "env" };
  }
  if (meta.valorApi != null && Number.isFinite(meta.valorApi) && meta.valorApi > 0) {
    return { valor: meta.valorApi, fonte: "api" };
  }
  return { valor: null, fonte: null };
}

/** @deprecated use resolveValorParque */
export function resolveValorParqueManual(meta: ParqueMeta) {
  return resolveValorParque(meta);
}
