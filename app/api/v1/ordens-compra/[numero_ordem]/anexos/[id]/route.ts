import { NextResponse } from "next/server";
import { exigirBearerOrdens } from "@/lib/ordens-compra/auth";
import {
  ehImagemAnexo,
  lerBytesAnexo,
  obterAnexo,
} from "@/lib/ordens-compra/anexos";
import { jsonErro } from "@/lib/ordens-compra/http";
import { obterOrdemCompra, registrarChamadaApi } from "@/lib/ordens-compra/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ numero_ordem: string; id: string }> };

function rotaDe(numero: string, id: string | number) {
  return `/api/v1/ordens-compra/${encodeURIComponent(numero)}/anexos/${id}`;
}

/** Download / preview com Bearer (robô ou integração). `?download=1` força attachment. */
export async function GET(request: Request, context: Ctx) {
  const { numero_ordem, id: idRaw } = await context.params;
  const numero = decodeURIComponent(numero_ordem).trim();
  const id = Number(idRaw);

  const recusa = exigirBearerOrdens(request);
  if (recusa) {
    registrarChamadaApi({ metodo: "GET", rota: rotaDe(numero, idRaw), quantidade: 0, erros: 1, detalhe: "401" });
    return recusa;
  }
  if (!Number.isInteger(id) || id <= 0) {
    registrarChamadaApi({ metodo: "GET", rota: rotaDe(numero, idRaw), quantidade: 0, erros: 1, detalhe: "404" });
    return jsonErro("não encontrado", 404);
  }
  if (!obterOrdemCompra(numero)) {
    registrarChamadaApi({ metodo: "GET", rota: rotaDe(numero, id), quantidade: 0, erros: 1, detalhe: "404" });
    return jsonErro("não encontrado", 404);
  }
  const anexo = obterAnexo(numero, id);
  if (!anexo) {
    registrarChamadaApi({ metodo: "GET", rota: rotaDe(numero, id), quantidade: 0, erros: 1, detalhe: "404" });
    return jsonErro("não encontrado", 404);
  }

  let bytes: Buffer;
  try {
    bytes = lerBytesAnexo(anexo);
  } catch {
    return jsonErro("arquivo ausente no disco", 404);
  }

  const url = new URL(request.url);
  const forcarDownload = url.searchParams.get("download") === "1";
  const inline =
    !forcarDownload && (ehImagemAnexo(anexo.content_type) || anexo.content_type === "application/pdf");
  const disposition = `${inline ? "inline" : "attachment"}; filename="${anexo.nome_original.replace(/"/g, "")}"`;

  registrarChamadaApi({ metodo: "GET", rota: rotaDe(numero, id), quantidade: 1, erros: 0 });
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
