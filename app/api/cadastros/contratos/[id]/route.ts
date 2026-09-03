import { normalizeContratoInput } from "@/lib/cadastros/contratos";
import { deleteContrato, readContratos, upsertContrato } from "@/lib/cadastros/store";
import type { ContratoInput } from "@/lib/cadastros/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let body: Partial<ContratoInput>;
  try {
    body = (await request.json()) as Partial<ContratoInput>;
  } catch {
    return Response.json({ ok: false, message: "JSON inválido." }, { status: 400 });
  }

  const contratos = readContratos();
  const current = contratos.find((c) => c.id === id);
  if (!current) {
    return Response.json({ ok: false, message: "Contrato não encontrado." }, { status: 404 });
  }

  const merged: ContratoInput = {
    nome: body.nome ?? current.nome,
    fornecedor: body.fornecedor !== undefined ? body.fornecedor : current.fornecedor,
    valorMensal: body.valorMensal ?? current.valorMensal,
    inicio: body.inicio !== undefined ? body.inicio : current.inicio,
    fim: body.fim !== undefined ? body.fim : current.fim,
    ativo: body.ativo !== undefined ? body.ativo : current.ativo,
    observacao: body.observacao !== undefined ? body.observacao : current.observacao,
  };

  const normalized = normalizeContratoInput(merged);
  if ("error" in normalized) {
    return Response.json({ ok: false, message: normalized.error }, { status: 400 });
  }

  const updated = { id, ...normalized };
  upsertContrato(updated);
  return Response.json({ ok: true, data: updated });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!deleteContrato(id)) {
    return Response.json({ ok: false, message: "Contrato não encontrado." }, { status: 404 });
  }
  return Response.json({ ok: true, data: { id } });
}
