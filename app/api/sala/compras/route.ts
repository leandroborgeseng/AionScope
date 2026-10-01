import { NextResponse } from "next/server";
import { m365Configurado } from "@/lib/compras/parse-email";
import {
  apagarCompra,
  atualizarCompra,
  criarCompraManual,
  emailsDaCompra,
  listarCompras,
  obterCompra,
  type CompraManualInput,
} from "@/lib/compras/store";
import { sincronizarCompras } from "@/lib/compras/sync";
import { invalidarCacheSnapshot } from "@/lib/ec/montar-snapshot";

export const dynamic = "force-dynamic";

function corpoManual(body: Record<string, unknown>): CompraManualInput {
  return {
    os: body.os != null ? String(body.os) : undefined,
    tag: body.tag != null ? String(body.tag) : undefined,
    equipamento: body.equipamento != null ? String(body.equipamento) : undefined,
    item: body.item != null ? String(body.item) : undefined,
    setor: body.setor != null ? String(body.setor) : undefined,
    solicitante_caixa: body.solicitante_caixa != null ? String(body.solicitante_caixa) : undefined,
    enviado_em: body.enviado_em != null ? String(body.enviado_em) : undefined,
    sc_numero: body.sc_numero != null ? String(body.sc_numero) : undefined,
    sc_em: body.sc_em != null ? String(body.sc_em) : undefined,
    entregue_em: body.entregue_em != null ? String(body.entregue_em) : undefined,
    origem_entrega: body.origem_entrega != null ? String(body.origem_entrega) : undefined,
    revisado_por: body.revisado_por != null ? String(body.revisado_por) : undefined,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sync = url.searchParams.get("sync") === "1";
  let syncResult = null;
  if (sync) {
    syncResult = await sincronizarCompras({ forcar: true });
    invalidarCacheSnapshot();
  }
  const compras = listarCompras();
  return NextResponse.json({
    configurado: m365Configurado(),
    sync: syncResult,
    compras: compras.map((c) => ({
      ...c,
      emails: emailsDaCompra(c.id),
      origem: c.conversation_id?.startsWith("manual:") ? "manual" : c.conversation_id ? "email" : "manual",
    })),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const acao = String(body.acao ?? "criar");

  try {
    if (acao === "sync") {
      const sync = await sincronizarCompras({ forcar: true });
      invalidarCacheSnapshot();
      return NextResponse.json(sync);
    }
    if (acao === "criar") {
      const id = criarCompraManual(corpoManual(body));
      invalidarCacheSnapshot();
      return NextResponse.json({ ok: true, id, compra: obterCompra(id) });
    }
    if (acao === "atualizar") {
      const id = String(body.id ?? "");
      if (!id) return NextResponse.json({ ok: false, message: "id obrigatório." }, { status: 400 });
      const compra = atualizarCompra(id, corpoManual(body));
      invalidarCacheSnapshot();
      return NextResponse.json({ ok: true, compra });
    }
    if (acao === "apagar") {
      const id = String(body.id ?? "");
      if (!id) return NextResponse.json({ ok: false, message: "id obrigatório." }, { status: 400 });
      apagarCompra(id);
      invalidarCacheSnapshot();
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, message: "Ação inválida." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Falha ao gravar pedido." },
      { status: 400 },
    );
  }
}
