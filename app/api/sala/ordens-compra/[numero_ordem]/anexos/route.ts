import { jsonErro, jsonErroValidacao, jsonOk } from "@/lib/ordens-compra/http";
import {
  gravarAnexoOrdem,
  listarAnexosOrdem,
} from "@/lib/ordens-compra/anexos";
import { obterOrdemCompra } from "@/lib/ordens-compra/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ numero_ordem: string }> };

async function numeroDe(context: Ctx) {
  const { numero_ordem } = await context.params;
  return decodeURIComponent(numero_ordem).trim();
}

/** Lista anexos da OC (UI Sala). */
export async function GET(_request: Request, context: Ctx) {
  const numero = await numeroDe(context);
  if (!obterOrdemCompra(numero)) return jsonErro("não encontrado", 404);
  return jsonOk({ anexos: listarAnexosOrdem(numero) });
}

/** Upload manual (multipart: campo `arquivo` ou `file`). */
export async function POST(request: Request, context: Ctx) {
  const numero = await numeroDe(context);
  if (!obterOrdemCompra(numero)) return jsonErro("não encontrado", 404);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonErroValidacao({
      status: 400,
      erro: "validação falhou",
      detalhes: [{ campo: "corpo", mensagem: "multipart/form-data inválido." }],
    });
  }

  const entry = form.get("arquivo") ?? form.get("file");
  if (!entry || typeof entry === "string") {
    return jsonErroValidacao({
      status: 400,
      erro: "validação falhou",
      detalhes: [{ campo: "arquivo", mensagem: "envie o campo arquivo (ou file)." }],
    });
  }

  const file = entry as File;
  const bytes = Buffer.from(await file.arrayBuffer());
  const result = gravarAnexoOrdem({
    numero_ordem: numero,
    nome: file.name || "anexo",
    contentType: file.type || null,
    bytes,
    fonte: "manual",
  });
  if (!result.ok) return jsonErroValidacao(result.error);
  return jsonOk(result.anexo, 201);
}
