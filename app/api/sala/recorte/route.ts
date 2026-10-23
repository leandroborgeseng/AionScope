import { NextResponse, type NextRequest } from "next/server";
import { carregarRecorte, isDemoDrill } from "@/lib/ec/sala-recorte-servico";

export const dynamic = "force-dynamic";

/**
 * GET /api/sala/recorte?id=envelhecimento.faixa.d8a15
 * Lista de OS por trás de um número das telas Envelhecimento / Fluxo / Programadas.
 * Só leitura. A contagem do snapshot é o tamanho desta mesma lista (lib/ec/sala-recortes.ts).
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim() ?? "";
  const demo = isDemoDrill(request.nextUrl.searchParams.get("demo"));
  if (!id || id.length > 120) {
    return NextResponse.json({ ok: false, error: "id do recorte ausente" }, { status: 400 });
  }
  try {
    const recorte = await carregarRecorte(id, demo);
    if (!recorte) return NextResponse.json({ ok: false, error: "recorte desconhecido" }, { status: 404 });
    return NextResponse.json({ ok: true, total: recorte.linhas.length, ...recorte });
  } catch (erro) {
    const message = erro instanceof Error ? erro.message : "Falha ao montar o recorte";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
