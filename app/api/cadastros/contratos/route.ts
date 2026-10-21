import { randomUUID } from "crypto";
import { exigirSessaoContratos } from "@/lib/auth/contratos-sessao";
import { validarContrato } from "@/lib/cadastros/contratos-proprios";
import { readContratos, upsertContrato } from "@/lib/cadastros/store";
import type { ContratoInput } from "@/lib/cadastros/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Leitura segue aberta como as demais telas (login global fica para o backlog). */
export async function GET() {
  return Response.json({ ok: true, data: readContratos() });
}

export async function POST(request: Request) {
  const recusa = exigirSessaoContratos(request);
  if (recusa) return recusa;

  let body: ContratoInput;
  try {
    body = (await request.json()) as ContratoInput;
  } catch {
    return Response.json({ ok: false, message: "JSON inválido." }, { status: 400 });
  }

  const v = validarContrato({ ...body, ativo: true });
  if (!v.ok) {
    return Response.json({ ok: false, message: "Revise os campos destacados.", erros: v.erros }, { status: 400 });
  }
  const created = upsertContrato({ id: randomUUID(), ...v.data });
  return Response.json({ ok: true, data: created }, { status: 201 });
}
