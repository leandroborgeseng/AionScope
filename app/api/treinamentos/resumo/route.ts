import { NextResponse } from "next/server";
import { AVISO_TREINAMENTOS_INDISPONIVEIS, carregarPainelTreinamentos } from "@/lib/treinamentos/load";

export const runtime = "nodejs";

/** Agregados sem nomes — seguro para Sala TV. */
export async function GET() {
  try {
    const painel = carregarPainelTreinamentos();
    if (!painel) return NextResponse.json({ erro: AVISO_TREINAMENTOS_INDISPONIVEIS }, { status: 503 });
    return NextResponse.json(painel, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "falha ao carregar treinamentos";
    return NextResponse.json({ erro: mensagem }, { status: 500 });
  }
}
