import { NextResponse, type NextRequest } from "next/server";
import {
  buscarDetalheOsApi,
  comTimeout,
  isDemoDrill,
  TempoEsgotadoError,
} from "@/lib/ec/sala-recorte-servico";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 8_000;

/**
 * GET /api/sala/os-detalhe?numero=XXXX
 * Detalhe da OS buscado na API no clique (D-SD1). Falha/timeout → 502/504;
 * o cliente cai no cache do recorte com o aviso "dados do cache".
 */
export async function GET(request: NextRequest) {
  const numero = request.nextUrl.searchParams.get("numero")?.trim() ?? "";
  const demo = isDemoDrill(request.nextUrl.searchParams.get("demo"));
  if (!numero || numero.length > 40) {
    return NextResponse.json({ ok: false, error: "número da OS ausente" }, { status: 400 });
  }
  try {
    const detalhe = await comTimeout(buscarDetalheOsApi(numero, demo), TIMEOUT_MS);
    if (!detalhe) return NextResponse.json({ ok: false, error: "OS não encontrada na API" }, { status: 404 });
    return NextResponse.json({ ok: true, fonte: "api", detalhe });
  } catch (erro) {
    const timeout = erro instanceof TempoEsgotadoError;
    const message = erro instanceof Error ? erro.message : "Falha ao buscar a OS";
    return NextResponse.json({ ok: false, error: message }, { status: timeout ? 504 : 502 });
  }
}
