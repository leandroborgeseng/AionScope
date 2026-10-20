import { exigirSessaoContratos } from "@/lib/auth/contratos-sessao";
import { validarContrato } from "@/lib/cadastros/contratos-proprios";
import { readContrato, setContratoAtivo, upsertContrato } from "@/lib/cadastros/store";
import type { ContratoInput } from "@/lib/cadastros/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const naoEncontrado = () => Response.json({ ok: false, message: "Contrato não encontrado." }, { status: 404 });

/**
 * Edição. Body só com { ativo } = inativar/reativar (sem exigir o restante).
 * Qualquer outra edição valida o contrato inteiro — tipo obrigatório (D3).
 */
export async function PATCH(request: Request, context: Ctx) {
  const recusa = exigirSessaoContratos(request);
  if (recusa) return recusa;

  const { id } = await context.params;
  let body: Partial<ContratoInput>;
  try {
    body = (await request.json()) as Partial<ContratoInput>;
  } catch {
    return Response.json({ ok: false, message: "JSON inválido." }, { status: 400 });
  }

  const current = readContrato(id);
  if (!current) return naoEncontrado();

  const chaves = Object.keys(body ?? {});
  if (chaves.length === 1 && chaves[0] === "ativo" && typeof body.ativo === "boolean") {
    return Response.json({ ok: true, data: setContratoAtivo(id, body.ativo) });
  }

  const pick = <K extends keyof ContratoInput>(k: K, atual: ContratoInput[K]) =>
    (k in body ? body[k] : atual) as ContratoInput[K];
  const merged: ContratoInput = {
    nome: pick("nome", current.nome),
    fornecedor: pick("fornecedor", current.fornecedor),
    valorMensal: pick("valorMensal", current.valorMensal),
    inicio: pick("inicio", current.inicio),
    fim: pick("fim", current.fim),
    ativo: pick("ativo", current.ativo),
    observacao: pick("observacao", current.observacao),
    tipo: pick("tipo", current.tipo),
    equipamento: pick("equipamento", current.equipamento),
    numero: pick("numero", current.numero),
  };

  const v = validarContrato(merged);
  if (!v.ok) {
    return Response.json({ ok: false, message: "Revise os campos destacados.", erros: v.erros }, { status: 400 });
  }
  return Response.json({ ok: true, data: upsertContrato({ id, ...v.data }) });
}

/** DELETE = inativar. Não há exclusão física. */
export async function DELETE(request: Request, context: Ctx) {
  const recusa = exigirSessaoContratos(request);
  if (recusa) return recusa;
  const { id } = await context.params;
  const data = setContratoAtivo(id, false);
  if (!data) return naoEncontrado();
  return Response.json({ ok: true, data });
}
