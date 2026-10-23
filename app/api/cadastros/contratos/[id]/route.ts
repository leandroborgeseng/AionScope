import { exigirSessaoContratos } from "@/lib/auth/contratos-sessao";
import { isoDiaValido, validarContrato, validarSuspensao } from "@/lib/cadastros/contratos-proprios";
import {
  readContrato,
  setContratoAtivo,
  setContratoInativacao,
  setContratoSuspensao,
  upsertContrato,
} from "@/lib/cadastros/store";
import type { ContratoInput } from "@/lib/cadastros/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const naoEncontrado = () => Response.json({ ok: false, message: "Contrato não encontrado." }, { status: 404 });

/**
 * Edição. Body só com { ativo } = inativar/reativar (sem exigir o restante).
 * Body { ativo: false, contaAte } = inativar com data efetiva: conta até o mês de contaAte (YYYY-MM-DD);
 *   contaAte null = não conta em nenhum mês (ex.: fora do escopo desde o início).
 * Body { suspensoDe, suspensoAte } = suspender por período (013); ambos null = remover a suspensão.
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

  const extra = body as Record<string, unknown>;
  if (chaves.includes("contaAte") && extra.ativo !== false) {
    return Response.json(
      { ok: false, message: "contaAte só vale para inativar ({ ativo: false, contaAte }). Para reativar envie apenas { ativo: true }." },
      { status: 400 },
    );
  }
  // { ativo:false, contaAte } — sozinho ou junto com outros campos: a data informada sempre vale.
  let contaAteInformado: { valor: string | null } | null = null;
  if (chaves.includes("contaAte")) {
    const contaAte = extra.contaAte;
    if (contaAte !== null && (typeof contaAte !== "string" || !isoDiaValido(contaAte))) {
      return Response.json({ ok: false, message: "Data efetiva de inativação inválida." }, { status: 400 });
    }
    if (chaves.length === 2) return Response.json({ ok: true, data: setContratoInativacao(id, contaAte as string | null) });
    contaAteInformado = { valor: contaAte as string | null };
  }

  if (chaves.length === 2 && chaves.includes("suspensoDe") && chaves.includes("suspensoAte")) {
    const s = validarSuspensao(extra.suspensoDe, extra.suspensoAte);
    if (!s.ok) return Response.json({ ok: false, message: s.erro }, { status: 400 });
    return Response.json({ ok: true, data: setContratoSuspensao(id, s.de, s.ate) });
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
  const salvo = upsertContrato({ id, ...v.data });
  if (contaAteInformado) return Response.json({ ok: true, data: setContratoInativacao(id, contaAteInformado.valor) });
  return Response.json({ ok: true, data: salvo });
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
