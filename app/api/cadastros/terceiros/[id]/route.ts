import { normalizeTerceiroInput } from "@/lib/cadastros/terceiros";
import {
  deleteEquipamentoTerceiro,
  readEquipamentosTerceiros,
  upsertEquipamentoTerceiro,
} from "@/lib/cadastros/store";
import type { EquipamentoTerceiroInput } from "@/lib/cadastros/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let body: Partial<EquipamentoTerceiroInput>;
  try {
    body = (await request.json()) as Partial<EquipamentoTerceiroInput>;
  } catch {
    return Response.json({ ok: false, message: "JSON inválido." }, { status: 400 });
  }

  const current = readEquipamentosTerceiros().find((item) => item.id === id);
  if (!current) {
    return Response.json({ ok: false, message: "Registro não encontrado." }, { status: 404 });
  }

  const merged: EquipamentoTerceiroInput = {
    tag: body.tag ?? current.tag,
    descricao: body.descricao !== undefined ? body.descricao : current.descricao,
    medicoResponsavel:
      body.medicoResponsavel !== undefined ? body.medicoResponsavel : current.medicoResponsavel,
    setor: body.setor !== undefined ? body.setor : current.setor,
    observacao: body.observacao !== undefined ? body.observacao : current.observacao,
    ativo: body.ativo !== undefined ? body.ativo : current.ativo,
  };

  const normalized = normalizeTerceiroInput(merged);
  if ("error" in normalized) {
    return Response.json({ ok: false, message: normalized.error }, { status: 400 });
  }

  const tagKey = normalized.tag.toLocaleUpperCase("pt-BR");
  const conflict = readEquipamentosTerceiros().find(
    (item) =>
      item.id !== id && item.tag.trim().toLocaleUpperCase("pt-BR") === tagKey,
  );
  if (conflict) {
    return Response.json(
      { ok: false, message: `Já existe acompanhamento local para a Tag ${normalized.tag}.` },
      { status: 409 },
    );
  }

  const updated = upsertEquipamentoTerceiro({
    id,
    tag: normalized.tag,
    descricao: normalized.descricao,
    medicoResponsavel: normalized.medicoResponsavel,
    setor: normalized.setor,
    observacao: normalized.observacao,
    ativo: normalized.ativo !== false,
    createdAt: current.createdAt,
  });
  return Response.json({ ok: true, data: updated });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!deleteEquipamentoTerceiro(id)) {
    return Response.json({ ok: false, message: "Registro não encontrado." }, { status: 404 });
  }
  return Response.json({ ok: true, data: { id } });
}
