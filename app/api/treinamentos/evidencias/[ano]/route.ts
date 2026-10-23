import { createReadStream, statSync } from "fs";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { exigirSessaoAdmin } from "@/lib/auth/contratos-sessao";
import {
  caminhoEvidencia,
  evidenciaExiste,
  recusarEvidencia,
  tokenEvidenciaValido,
} from "@/lib/treinamentos/evidencias";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ ano: string }> };

/**
 * PDFs das listas de presença. O de 2026 contém CPF/e-mail — nunca público.
 * A4: exige a sessão de administrador SEMPRE (mesmo sem token configurado) e, se houver,
 * TREINAMENTOS_EVIDENCIAS_TOKEN (Bearer, ?token= ou cookie). 401 sem dados.
 */
export async function GET(request: Request, ctx: Ctx) {
  const negado = exigirSessaoAdmin(request);
  if (negado) return negado;
  if (!tokenEvidenciaValido(request)) {
    return recusarEvidencia();
  }

  const { ano } = await ctx.params;
  if (!/^\d{4}$/.test(ano) || !evidenciaExiste(ano)) {
    return NextResponse.json({ erro: "evidência não encontrada" }, { status: 404 });
  }

  const caminho = caminhoEvidencia(ano)!;
  const stat = statSync(caminho);
  const stream = createReadStream(caminho);
  const web = Readable.toWeb(stream) as ReadableStream;

  return new NextResponse(web, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(stat.size),
      "Content-Disposition": `inline; filename="${ano}_lista_presenca_bomba_infusao.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
