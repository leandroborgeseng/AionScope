import { NextResponse } from "next/server";
import {
  anosEvidenciaConhecidos,
  recusarEvidencia,
  salvarEvidenciaPdf,
  statusEvidencias,
  tokenEvidenciaValido,
} from "@/lib/treinamentos/evidencias";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Upload das listas PDF para o volume persistente.
 * Form: ano=2025|2026 + arquivo (PDF).
 */
export async function POST(request: Request) {
  if (!tokenEvidenciaValido(request)) {
    return recusarEvidencia();
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ erro: "multipart inválido" }, { status: 400 });
  }

  const ano = String(form.get("ano") ?? "").trim();
  if (!anosEvidenciaConhecidos().includes(ano)) {
    return NextResponse.json({ erro: "ano inválido (use 2025 ou 2026)" }, { status: 400 });
  }

  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ erro: "campo arquivo obrigatório" }, { status: 400 });
  }

  const bytes = Buffer.from(await arquivo.arrayBuffer());
  try {
    const destino = salvarEvidenciaPdf(ano, bytes);
    return NextResponse.json({
      ok: true,
      ano,
      bytes: bytes.length,
      destino,
      status: statusEvidencias(request),
    });
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "falha ao gravar" },
      { status: 400 },
    );
  }
}
