import { NextResponse } from "next/server";
import { exigirSessaoAdmin } from "@/lib/auth/contratos-sessao";
import {
  anosEvidenciaConhecidos,
  LIMITE_EVIDENCIA_BYTES,
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
  // Grava PDF no volume: exige a sessão de administrador (#13) além do token de evidências.
  const negado = exigirSessaoAdmin(request);
  if (negado) return negado;
  if (!tokenEvidenciaValido(request)) {
    return recusarEvidencia();
  }

  // A1: recusa antes de ler o corpo quando o Content-Length já passa do limite.
  const declarado = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declarado) && declarado > LIMITE_EVIDENCIA_BYTES + 64 * 1024) return muitoGrande();

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

  if (arquivo.size > LIMITE_EVIDENCIA_BYTES) return muitoGrande();
  const bytes = Buffer.from(await arquivo.arrayBuffer());
  try {
    salvarEvidenciaPdf(ano, bytes); // A3: o caminho no servidor não volta na resposta.
    return NextResponse.json({
      ok: true,
      ano,
      bytes: bytes.length,
      status: statusEvidencias(request),
    });
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "falha ao gravar" },
      { status: 400 },
    );
  }
}

function muitoGrande() {
  return NextResponse.json({ erro: `arquivo acima de ${LIMITE_EVIDENCIA_BYTES / (1024 * 1024)} MB` }, { status: 413 });
}
