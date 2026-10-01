import { randomUUID } from "crypto";
import { getDb } from "@/lib/db/client";
import { situacaoCompra, type SituacaoCompra } from "./parse-email";

export type CompraRow = {
  id: string;
  os: string | null;
  tag: string | null;
  equipamento: string | null;
  item: string | null;
  setor: string | null;
  solicitante_caixa: string | null;
  enviado_em: string | null;
  sc_numero: string | null;
  sc_em: string | null;
  entregue_em: string | null;
  origem_entrega: string | null;
  situacao: SituacaoCompra;
  conversation_id: string | null;
  revisado_por: string | null;
  created_at: string;
  updated_at: string;
};

export type CompraEmailRow = {
  id: string;
  compra_id: string;
  message_id: string;
  direcao: "enviado" | "recebido";
  data: string;
  de: string | null;
  para: string | null;
  assunto: string | null;
  trecho: string | null;
  created_at: string;
};

function nowIso() {
  return new Date().toISOString();
}

function parseIso(valor: string | null | undefined) {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function recalcularSituacao(row: CompraRow, agora = new Date()): SituacaoCompra {
  return situacaoCompra({
    os: row.os,
    enviadoEm: parseIso(row.enviado_em),
    scNumero: row.sc_numero,
    scEm: parseIso(row.sc_em),
    entregueEm: parseIso(row.entregue_em),
    agora,
  });
}

export function listarCompras(opts?: { abertas?: boolean }): CompraRow[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM compra ORDER BY COALESCE(enviado_em, created_at) DESC")
    .all() as CompraRow[];
  const agora = new Date();
  const atualizadas = rows.map((row) => {
    const situacao = recalcularSituacao(row, agora);
    if (situacao !== row.situacao) {
      db.prepare("UPDATE compra SET situacao = ?, updated_at = ? WHERE id = ?").run(
        situacao,
        nowIso(),
        row.id,
      );
      return { ...row, situacao };
    }
    return row;
  });
  if (opts?.abertas) {
    return atualizadas.filter((row) => row.situacao !== "entregue");
  }
  return atualizadas;
}

export function emailsDaCompra(compraId: string): CompraEmailRow[] {
  return getDb()
    .prepare("SELECT * FROM compra_email WHERE compra_id = ? ORDER BY data ASC")
    .all(compraId) as CompraEmailRow[];
}

export function obterDelta(caixa: string, pasta: string) {
  return getDb()
    .prepare("SELECT * FROM graph_delta WHERE caixa = ? AND pasta = ?")
    .get(caixa, pasta) as { delta_link: string | null } | undefined;
}

export function salvarDelta(caixa: string, pasta: string, deltaLink: string | null) {
  const db = getDb();
  const agora = nowIso();
  const existente = db
    .prepare("SELECT id FROM graph_delta WHERE caixa = ? AND pasta = ?")
    .get(caixa, pasta) as { id: string } | undefined;
  if (existente) {
    db.prepare("UPDATE graph_delta SET delta_link = ?, atualizado_em = ? WHERE id = ?").run(
      deltaLink,
      agora,
      existente.id,
    );
    return;
  }
  db.prepare(
    "INSERT INTO graph_delta (id, caixa, pasta, delta_link, atualizado_em) VALUES (?, ?, ?, ?, ?)",
  ).run(randomUUID(), caixa, pasta, deltaLink, agora);
}

export function messageJaVisto(messageId: string) {
  return Boolean(
    getDb().prepare("SELECT id FROM compra_email WHERE message_id = ?").get(messageId),
  );
}

export function compraPorConversation(conversationId: string | null | undefined) {
  if (!conversationId) return null;
  return getDb()
    .prepare("SELECT * FROM compra WHERE conversation_id = ?")
    .get(conversationId) as CompraRow | undefined;
}

export function upsertCompraEnviada(input: {
  conversationId: string;
  messageId: string;
  data: string;
  de: string;
  para: string;
  assunto: string;
  trecho: string;
  os: string | null;
  tag: string | null;
  equipamento: string | null;
  item: string | null;
  setor: string | null;
  solicitanteCaixa: string;
}) {
  const db = getDb();
  if (messageJaVisto(input.messageId)) return compraPorConversation(input.conversationId)?.id ?? null;

  let compra = compraPorConversation(input.conversationId);
  const agora = nowIso();
  if (!compra) {
    const id = randomUUID();
    const situacao = situacaoCompra({
      os: input.os,
      enviadoEm: parseIso(input.data),
      scNumero: null,
      scEm: null,
      entregueEm: null,
    });
    db.prepare(
      `INSERT INTO compra (
        id, os, tag, equipamento, item, setor, solicitante_caixa, enviado_em,
        sc_numero, sc_em, entregue_em, origem_entrega, situacao, conversation_id,
        revisado_por, created_at, updated_at
      ) VALUES (
        @id, @os, @tag, @equipamento, @item, @setor, @solicitante_caixa, @enviado_em,
        NULL, NULL, NULL, NULL, @situacao, @conversation_id, NULL, @created_at, @updated_at
      )`,
    ).run({
      id,
      os: input.os,
      tag: input.tag,
      equipamento: input.equipamento,
      item: input.item,
      setor: input.setor,
      solicitante_caixa: input.solicitanteCaixa,
      enviado_em: input.data,
      situacao,
      conversation_id: input.conversationId,
      created_at: agora,
      updated_at: agora,
    });
    compra = db.prepare("SELECT * FROM compra WHERE id = ?").get(id) as CompraRow;
  } else {
    db.prepare(
      `UPDATE compra SET
        os = COALESCE(os, @os),
        tag = COALESCE(tag, @tag),
        equipamento = COALESCE(equipamento, @equipamento),
        item = COALESCE(item, @item),
        setor = COALESCE(setor, @setor),
        solicitante_caixa = COALESCE(solicitante_caixa, @solicitante_caixa),
        enviado_em = COALESCE(enviado_em, @enviado_em),
        updated_at = @updated_at
      WHERE id = @id`,
    ).run({
      id: compra.id,
      os: input.os,
      tag: input.tag,
      equipamento: input.equipamento,
      item: input.item,
      setor: input.setor,
      solicitante_caixa: input.solicitanteCaixa,
      enviado_em: input.data,
      updated_at: agora,
    });
  }

  db.prepare(
    `INSERT INTO compra_email (
      id, compra_id, message_id, direcao, data, de, para, assunto, trecho, created_at
    ) VALUES (?, ?, ?, 'enviado', ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    compra!.id,
    input.messageId,
    input.data,
    input.de,
    input.para,
    input.assunto,
    input.trecho,
    agora,
  );

  const atual = db.prepare("SELECT * FROM compra WHERE id = ?").get(compra!.id) as CompraRow;
  const situacao = recalcularSituacao(atual);
  db.prepare("UPDATE compra SET situacao = ?, updated_at = ? WHERE id = ?").run(
    situacao,
    agora,
    atual.id,
  );
  return atual.id;
}

export function aplicarRespostaRecebida(input: {
  conversationId: string;
  messageId: string;
  data: string;
  de: string;
  para: string;
  assunto: string;
  trecho: string;
  sc: string | null;
  entregueEm: string | null;
}) {
  const db = getDb();
  if (messageJaVisto(input.messageId)) return null;
  const compra = compraPorConversation(input.conversationId);
  if (!compra) return null;

  const agora = nowIso();
  db.prepare(
    `INSERT INTO compra_email (
      id, compra_id, message_id, direcao, data, de, para, assunto, trecho, created_at
    ) VALUES (?, ?, ?, 'recebido', ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    compra.id,
    input.messageId,
    input.data,
    input.de,
    input.para,
    input.assunto,
    input.trecho,
    agora,
  );

  db.prepare(
    `UPDATE compra SET
      sc_numero = COALESCE(sc_numero, @sc),
      sc_em = CASE WHEN sc_numero IS NULL AND @sc IS NOT NULL THEN @data ELSE sc_em END,
      entregue_em = COALESCE(entregue_em, @entregue),
      origem_entrega = CASE
        WHEN entregue_em IS NULL AND @entregue IS NOT NULL THEN 'email'
        ELSE origem_entrega
      END,
      updated_at = @updated_at
    WHERE id = @id`,
  ).run({
    id: compra.id,
    sc: input.sc,
    data: input.data,
    entregue: input.entregueEm,
    updated_at: agora,
  });

  const atual = db.prepare("SELECT * FROM compra WHERE id = ?").get(compra.id) as CompraRow;
  const situacao = recalcularSituacao(atual);
  db.prepare("UPDATE compra SET situacao = ?, updated_at = ? WHERE id = ?").run(
    situacao,
    agora,
    atual.id,
  );
  return atual.id;
}

export function vincularOs(compraId: string, os: string) {
  const db = getDb();
  const agora = nowIso();
  db.prepare("UPDATE compra SET os = ?, updated_at = ? WHERE id = ?").run(os.trim(), agora, compraId);
  const atual = db.prepare("SELECT * FROM compra WHERE id = ?").get(compraId) as CompraRow | undefined;
  if (!atual) return;
  const situacao = recalcularSituacao(atual);
  db.prepare("UPDATE compra SET situacao = ?, updated_at = ? WHERE id = ?").run(situacao, agora, compraId);
}

export function corrigirSc(compraId: string, sc: string, scEm?: string) {
  const db = getDb();
  const agora = nowIso();
  db.prepare("UPDATE compra SET sc_numero = ?, sc_em = COALESCE(?, sc_em, ?), updated_at = ? WHERE id = ?").run(
    sc.trim(),
    scEm ?? null,
    agora,
    agora,
    compraId,
  );
  const atual = db.prepare("SELECT * FROM compra WHERE id = ?").get(compraId) as CompraRow | undefined;
  if (!atual) return;
  const situacao = recalcularSituacao(atual);
  db.prepare("UPDATE compra SET situacao = ?, updated_at = ? WHERE id = ?").run(situacao, agora, compraId);
}

export function marcarEntregue(compraId: string, entregueEm: string, origem = "manual") {
  const db = getDb();
  const agora = nowIso();
  db.prepare(
    "UPDATE compra SET entregue_em = ?, origem_entrega = ?, situacao = 'entregue', updated_at = ? WHERE id = ?",
  ).run(entregueEm, origem, agora, compraId);
}
