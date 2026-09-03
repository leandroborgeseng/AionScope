import { randomUUID } from "crypto";
import { normalizeTerceiroInput } from "@/lib/cadastros/terceiros";
import { readEquipamentosTerceiros, upsertEquipamentoTerceiro } from "@/lib/cadastros/store";
import type { EquipamentoTerceiroInput } from "@/lib/cadastros/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const items = readEquipamentosTerceiros();
  return Response.json({ ok: true, data: items });
}

export async function POST(request: Request) {
  let body: EquipamentoTerceiroInput;
  try {
    body = (await request.json()) as EquipamentoTerceiroInput;
  } catch {
    return Response.json({ ok: false, message: "JSON inválido." }, { status: 400 });
  }

  const normalized = normalizeTerceiroInput(body);
  if ("error" in normalized) {
    return Response.json({ ok: false, message: normalized.error }, { status: 400 });
  }

  const tagKey = normalized.tag.toLocaleUpperCase("pt-BR");
  const existing = readEquipamentosTerceiros().find(
    (item) => item.tag.trim().toLocaleUpperCase("pt-BR") === tagKey,
  );
  if (existing) {
    return Response.json(
      { ok: false, message: `Já existe acompanhamento local para a Tag ${normalized.tag}.` },
      { status: 409 },
    );
  }

  const created = upsertEquipamentoTerceiro({
    id: randomUUID(),
    tag: normalized.tag,
    descricao: normalized.descricao,
    medicoResponsavel: normalized.medicoResponsavel,
    setor: normalized.setor,
    observacao: normalized.observacao,
    ativo: normalized.ativo !== false,
  });
  return Response.json({ ok: true, data: created }, { status: 201 });
}
