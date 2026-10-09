import { NextResponse } from "next/server";
import { carregarEvolucaoHistorica } from "@/lib/ec/carregar-evolucao";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snap = await carregarEvolucaoHistorica();
    return NextResponse.json(snap);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao montar evolução histórica";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
