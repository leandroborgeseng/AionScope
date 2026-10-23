import { exigirSessaoEscritaSala } from "@/lib/auth/sala-escrita";
import { NextResponse } from "next/server";
import {
  apagarFeriado,
  encerrarAlerta,
  encerrarAquisicao,
  encerrarImpedimento,
  encerrarObra,
} from "@/lib/db/sala-registros";
import { invalidarCacheSnapshot } from "@/lib/ec/montar-snapshot";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ tipo: string; id: string }> },
) {
  const recusa = exigirSessaoEscritaSala(request);
  if (recusa) return recusa;
  const { tipo, id } = await context.params;
  try {
    if (tipo === "impedimento") encerrarImpedimento(id);
    else if (tipo === "aquisicao") encerrarAquisicao(id);
    else if (tipo === "obra") encerrarObra(id);
    else if (tipo === "alerta") encerrarAlerta(id);
    else if (tipo === "feriado") apagarFeriado(id);
    else return NextResponse.json({ ok: false, message: "Tipo inválido." }, { status: 400 });
    invalidarCacheSnapshot();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Falha ao remover." },
      { status: 400 },
    );
  }
}
