import { getDb } from "@/lib/db/client";
import { CAMPOS_ORDEM, type CategoriaOrdem, type EditadoManualmente, type ItemOrdem, type ListaFiltros, type ListaOrdens, type OrdemCompra, type ParsedOrdem } from "./types";

type OrdemRow = {
  numero_ordem: string;
  status: string | null;
  categoria: string | null;
  data_pedido: string | null;
  data_ordem: string | null;
  valor_total: string | null;
  fornecedor: string | null;
  numero_orcamento: string | null;
  numero_os: string | null;
  setor_equipamento: string | null;
  origem: string | null;
  solicitante: string | null;
  assunto_email: string | null;
  email_message_id: string | null;
  anexo_origem: string | null;
  confianca: string | null;
  observacoes: string | null;
  ordens_relacionadas: string | null;
  fonte: string;
  editado_manualmente: string;
  created_at: string;
  updated_at: string;
};

type ItemRow = {
  descricao: string | null;
  quantidade: string | null;
  unidade: string | null;
  valor_unitario: string | null;
  valor_total: string | null;
  codigo: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function parseEditado(raw: string | null): EditadoManualmente {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw) as EditadoManualmente;
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function parseRelacionadas(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.map((x) => String(x)) : null;
  } catch {
    return null;
  }
}

function rowParaOrdem(row: OrdemRow, itens: ItemOrdem[]): OrdemCompra {
  return {
    numero_ordem: row.numero_ordem,
    status: (row.status as OrdemCompra["status"]) ?? null,
    categoria: (row.categoria as OrdemCompra["categoria"]) ?? null,
    data_pedido: row.data_pedido,
    data_ordem: row.data_ordem,
    valor_total: row.valor_total,
    fornecedor: row.fornecedor,
    numero_orcamento: row.numero_orcamento,
    numero_os: row.numero_os,
    setor_equipamento: row.setor_equipamento,
    origem: (row.origem as OrdemCompra["origem"]) ?? null,
    solicitante: row.solicitante,
    assunto_email: row.assunto_email,
    email_message_id: row.email_message_id,
    anexo_origem: row.anexo_origem,
    confianca: (row.confianca as OrdemCompra["confianca"]) ?? null,
    observacoes: row.observacoes,
    ordens_relacionadas: parseRelacionadas(row.ordens_relacionadas),
    itens,
    fonte: row.fonte,
    editado_manualmente: parseEditado(row.editado_manualmente),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function itensDaOrdem(numero: string): ItemOrdem[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT descricao, quantidade, unidade, valor_unitario, valor_total, codigo
       FROM ordem_itens WHERE numero_ordem = ? ORDER BY posicao ASC, id ASC`,
    )
    .all(numero) as ItemRow[];
}

function substituirItens(numero: string, itens: ItemOrdem[]) {
  const db = getDb();
  db.prepare("DELETE FROM ordem_itens WHERE numero_ordem = ?").run(numero);
  const insert = db.prepare(
    `INSERT INTO ordem_itens (
      numero_ordem, descricao, quantidade, unidade, valor_unitario, valor_total, codigo, posicao
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  itens.forEach((item, posicao) => {
    insert.run(
      numero,
      item.descricao,
      item.quantidade,
      item.unidade,
      item.valor_unitario,
      item.valor_total,
      item.codigo,
      posicao,
    );
  });
}

function obterRow(numero: string): OrdemRow | undefined {
  return getDb().prepare("SELECT * FROM ordens_compra WHERE numero_ordem = ?").get(numero) as
    | OrdemRow
    | undefined;
}

export function obterOrdemCompra(numero: string): OrdemCompra | undefined {
  const row = obterRow(numero);
  if (!row) return undefined;
  return rowParaOrdem(row, itensDaOrdem(numero));
}

function valoresInsert(parsed: ParsedOrdem, agora: string) {
  const c = parsed.campos;
  return {
    numero_ordem: parsed.numero_ordem,
    status: c.status ?? null,
    categoria: c.categoria ?? null,
    data_pedido: c.data_pedido ?? null,
    data_ordem: c.data_ordem ?? null,
    valor_total: c.valor_total ?? null,
    fornecedor: c.fornecedor ?? null,
    numero_orcamento: c.numero_orcamento ?? null,
    numero_os: c.numero_os ?? null,
    setor_equipamento: c.setor_equipamento ?? null,
    origem: c.origem ?? null,
    solicitante: c.solicitante ?? null,
    assunto_email: c.assunto_email ?? null,
    email_message_id: c.email_message_id ?? null,
    anexo_origem: c.anexo_origem ?? null,
    confianca: c.confianca ?? null,
    observacoes: c.observacoes ?? null,
    ordens_relacionadas: c.ordens_relacionadas ? JSON.stringify(c.ordens_relacionadas) : null,
    fonte: "email_robot",
    editado_manualmente: "{}",
    created_at: agora,
    updated_at: agora,
  };
}

export function upsertOrdemCompra(parsed: ParsedOrdem): { created: boolean; ordem: OrdemCompra } {
  const db = getDb();
  const agora = nowIso();
  return db.transaction(() => {
    const existente = obterRow(parsed.numero_ordem);
    if (!existente) {
      db.prepare(
        `INSERT INTO ordens_compra (
          numero_ordem, status, categoria, data_pedido, data_ordem, valor_total, fornecedor,
          numero_orcamento, numero_os, setor_equipamento, origem, solicitante, assunto_email,
          email_message_id, anexo_origem, confianca, observacoes, ordens_relacionadas, fonte,
          editado_manualmente, created_at, updated_at
        ) VALUES (
          @numero_ordem, @status, @categoria, @data_pedido, @data_ordem, @valor_total, @fornecedor,
          @numero_orcamento, @numero_os, @setor_equipamento, @origem, @solicitante, @assunto_email,
          @email_message_id, @anexo_origem, @confianca, @observacoes, @ordens_relacionadas, @fonte,
          @editado_manualmente, @created_at, @updated_at
        )`,
      ).run(valoresInsert(parsed, agora));
      if (parsed.itens) substituirItens(parsed.numero_ordem, parsed.itens);
      return { created: true, ordem: obterOrdemCompra(parsed.numero_ordem)! };
    }

    const protegido = parseEditado(existente.editado_manualmente);
    const merged: Record<string, unknown> = { ...existente, updated_at: agora };

    for (const nome of CAMPOS_ORDEM) {
      if (!Object.prototype.hasOwnProperty.call(parsed.campos, nome)) continue;
      if (protegido[nome]) continue;
      const valor = parsed.campos[nome];
      merged[nome] = nome === "ordens_relacionadas" ? (valor ? JSON.stringify(valor) : null) : (valor ?? null);
    }

    db.prepare(
      `UPDATE ordens_compra SET
        status = @status,
        categoria = @categoria,
        data_pedido = @data_pedido,
        data_ordem = @data_ordem,
        valor_total = @valor_total,
        fornecedor = @fornecedor,
        numero_orcamento = @numero_orcamento,
        numero_os = @numero_os,
        setor_equipamento = @setor_equipamento,
        origem = @origem,
        solicitante = @solicitante,
        assunto_email = @assunto_email,
        email_message_id = @email_message_id,
        anexo_origem = @anexo_origem,
        confianca = @confianca,
        observacoes = @observacoes,
        ordens_relacionadas = @ordens_relacionadas,
        updated_at = @updated_at
      WHERE numero_ordem = @numero_ordem`,
    ).run({ ...merged, numero_ordem: parsed.numero_ordem });

    if (parsed.itens && !protegido.itens) {
      substituirItens(parsed.numero_ordem, parsed.itens);
    }

    return { created: false, ordem: obterOrdemCompra(parsed.numero_ordem)! };
  })();
}

export function editarCategoriaManualmente(numero: string, categoria: CategoriaOrdem): OrdemCompra | undefined {
  const db = getDb();
  const existente = obterRow(numero);
  if (!existente) return undefined;
  const flags = parseEditado(existente.editado_manualmente);
  flags.categoria = true;
  db.prepare(
    `UPDATE ordens_compra SET categoria = ?, editado_manualmente = ?, updated_at = ? WHERE numero_ordem = ?`,
  ).run(categoria, JSON.stringify(flags), nowIso(), numero);
  return obterOrdemCompra(numero);
}

/** Contagem total de OCs formais (robô) — usada na TV para apontar a tela certa. */
export function contarOrdensCompra(): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM ordens_compra").get() as { n: number }).n;
}

export function listarOrdensCompra(filtros: ListaFiltros): ListaOrdens {
  const db = getDb();
  const where: string[] = [];
  const params: unknown[] = [];

  if (filtros.desde) {
    where.push("updated_at >= ?");
    params.push(filtros.desde);
  }
  if (filtros.categoria) {
    where.push("categoria = ?");
    params.push(filtros.categoria);
  }
  if (filtros.fornecedor) {
    where.push("LOWER(IFNULL(fornecedor, '')) LIKE ?");
    params.push(`%${filtros.fornecedor.toLowerCase()}%`);
  }
  if (filtros.mes) {
    where.push("(IFNULL(data_pedido, '') LIKE ? OR IFNULL(data_ordem, '') LIKE ?)");
    params.push(`${filtros.mes}%`, `${filtros.mes}%`);
  }
  if (filtros.os) {
    where.push("IFNULL(numero_os, '') LIKE ?");
    params.push(`%${filtros.os}%`);
  }
  if (filtros.sem_valor) {
    where.push("(valor_total IS NULL OR TRIM(valor_total) = '')");
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM ordens_compra ${clause}`).get(...params) as { n: number })
    .n;
  const offset = (filtros.page - 1) * filtros.page_size;
  const rows = db
    .prepare(
      `SELECT * FROM ordens_compra ${clause} ORDER BY COALESCE(data_ordem, data_pedido, updated_at) DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, filtros.page_size, offset) as OrdemRow[];

  const itens = rows.map((row) => rowParaOrdem(row, itensDaOrdem(row.numero_ordem)));
  return { itens, page: filtros.page, page_size: filtros.page_size, total };
}

export function registrarChamadaApi(info: {
  metodo: string;
  rota: string;
  quantidade: number;
  erros: number;
  detalhe?: string;
}) {
  getDb()
    .prepare(
      `INSERT INTO ordens_compra_api_log (created_at, metodo, rota, quantidade, erros, detalhe)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(nowIso(), info.metodo, info.rota, info.quantidade, info.erros, info.detalhe ?? null);
}
