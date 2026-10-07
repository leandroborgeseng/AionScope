import { NextResponse } from "next/server";
import { statusEvidencias } from "@/lib/treinamentos/evidencias";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Estado das evidências PDF para o painel (sem servir o arquivo). */
export async function GET(request: Request) {
  const status = statusEvidencias(request);
  return NextResponse.json({
    tokenObrigatorio: status.tokenObrigatorio,
    anos: status.anos,
    liberado: status.liberado,
  });
}
