import { randomUUID } from "crypto";
import { normalizeContratoInput } from "@/lib/cadastros/contratos";
import { readContratos, upsertContrato } from "@/lib/cadastros/store";
import type { ContratoInput } from "@/lib/cadastros/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const contratos = readContratos();
  return Response.json({ ok: true, data: contratos });
}

export async function POST(request: Request) {
  let body: ContratoInput;
  try {
    body = (await request.json()) as ContratoInput;
  } catch {
    return Response.json({ ok: false, message: "JSON inválido." }, { status: 400 });
  }

  const normalized = normalizeContratoInput(body);
  if ("error" in normalized) {
    return Response.json({ ok: false, message: normalized.error }, { status: 400 });
  }

  const created = { id: randomUUID(), ...normalized };
  upsertContrato(created);
  return Response.json({ ok: true, data: created }, { status: 201 });
}
