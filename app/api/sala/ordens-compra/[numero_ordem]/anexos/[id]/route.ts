import { NextResponse } from "next/server";
import { jsonErro, jsonOk } from "@/lib/ordens-compra/http";
import {
  ehImagemAnexo,
  lerBytesAnexo,
  obterAnexo,
  removerAnexoOrdem,
} from "@/lib/ordens-compra/anexos";
import { obterOrdemCompra } from "@/lib/ordens-compra/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ numero_ordem: string; id: string }> };

async function resolver(context: Ctx) {
  const { numero_ordem, id: idRaw } = await context.params;
  const numero = decodeURIComponent(numero_ordem).trim();
  const id = Number(idRaw);
  return { numero, id };
}

/** Visualiza / baixa o arquivo. `?download=1` força attachment. */
export async function GET(request: Request, context: Ctx) {
  const { numero, id } = await resolver(context);
  if (!Number.isInteger(id) || id <= 0) return jsonErro("não encontrado", 404);
  if (!obterOrdemCompra(numero)) return jsonErro("não encontrado", 404);
  const anexo = obterAnexo(numero, id);
  if (!anexo) return jsonErro("não encontrado", 404);

  let bytes: Buffer;
  try {
    bytes = lerBytesAnexo(anexo);
  } catch {
    return jsonErro("arquivo ausente no disco", 404);
  }

  const url = new URL(request.url);
  const forcarDownload = url.searchParams.get("download") === "1";
  const inline = !forcarDownload && (ehImagemAnexo(anexo.content_type) || anexo.content_type === "application/pdf");
  const disposition = `${inline ? "inline" : "attachment"}; filename="${anexo.nome_original.replace(/"/g, "")}"`;

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": anexo.content_type,
      "Content-Length": String(bytes.length),
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Remove anexo (metadado + arquivo). */
export async function DELETE(_request: Request, context: Ctx) {
  const { numero, id } = await resolver(context);
  if (!Number.isInteger(id) || id <= 0) return jsonErro("não encontrado", 404);
  if (!obterOrdemCompra(numero)) return jsonErro("não encontrado", 404);
  const result = removerAnexoOrdem(numero, id);
  if (!result.ok) return jsonErro("não encontrado", 404);
  return jsonOk({ ok: true });
}
