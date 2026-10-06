import { NextResponse, type NextRequest } from "next/server";
import { buscarOsAbertasEc, obterOsDetalhePorNumero } from "@/lib/ec/os-abertas";

export const dynamic = "force-dynamic";

/**
 * GET /api/sala/os-abertas?q=2026
 * Sugestões de OS abertas da EC para vincular OC ↔ OS.
 *
 * GET /api/sala/os-abertas?numero=202609698
 * Detalhe/status de uma OS específica (aberta ou fechada) para aviso no vínculo.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const numero = request.nextUrl.searchParams.get("numero")?.trim() ?? "";
  const limiteRaw = Number(request.nextUrl.searchParams.get("limit") ?? "20");
  const limite = Number.isFinite(limiteRaw) ? Math.min(50, Math.max(1, Math.floor(limiteRaw))) : 20;

  try {
    if (numero) {
      const detalhe = await obterOsDetalhePorNumero(numero);
      if (!detalhe) {
        return NextResponse.json({ ok: true, encontrado: false, detalhe: null });
      }
      return NextResponse.json({
        ok: true,
        encontrado: true,
        detalhe,
        avisoFechada: !detalhe.aberto,
      });
    }

    const itens = await buscarOsAbertasEc(q, limite);
    return NextResponse.json({ ok: true, q, total: itens.length, itens });
  } catch (erro) {
    const message = erro instanceof Error ? erro.message : "Falha ao buscar OS abertas";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
