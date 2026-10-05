import { exigirBearerOrdens } from "@/lib/ordens-compra/auth";
import {
  gravarAnexoOrdem,
  listarAnexosOrdem,
} from "@/lib/ordens-compra/anexos";
import { jsonErro, jsonErroValidacao, jsonOk } from "@/lib/ordens-compra/http";
import { obterOrdemCompra, registrarChamadaApi } from "@/lib/ordens-compra/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ numero_ordem: string }> };

function rotaDe(numero: string) {
  return `/api/v1/ordens-compra/${encodeURIComponent(numero)}/anexos`;
}

async function numeroDe(context: Ctx) {
  const { numero_ordem } = await context.params;
  return decodeURIComponent(numero_ordem).trim();
}

/** Lista anexos (Bearer). */
export async function GET(request: Request, context: Ctx) {
  const numero = await numeroDe(context);
  const recusa = exigirBearerOrdens(request);
  if (recusa) {
    registrarChamadaApi({ metodo: "GET", rota: rotaDe(numero), quantidade: 0, erros: 1, detalhe: "401" });
    return recusa;
  }
  if (!obterOrdemCompra(numero)) {
    registrarChamadaApi({ metodo: "GET", rota: rotaDe(numero), quantidade: 0, erros: 1, detalhe: "404" });
    return jsonErro("não encontrado", 404);
  }
  const anexos = listarAnexosOrdem(numero);
  registrarChamadaApi({ metodo: "GET", rota: rotaDe(numero), quantidade: anexos.length, erros: 0 });
  return jsonOk({ anexos });
}

/**
 * Upload do robô: multipart campo `arquivo`/`file`.
 * Opcional: `email_message_id`, `descricao` (texto). Não altera o upsert da OC.
 */
export async function POST(request: Request, context: Ctx) {
  const numero = await numeroDe(context);
  const recusa = exigirBearerOrdens(request);
  if (recusa) {
    registrarChamadaApi({ metodo: "POST", rota: rotaDe(numero), quantidade: 0, erros: 1, detalhe: "401" });
    return recusa;
  }
  if (!obterOrdemCompra(numero)) {
    registrarChamadaApi({ metodo: "POST", rota: rotaDe(numero), quantidade: 0, erros: 1, detalhe: "404" });
    return jsonErro("não encontrado", 404);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    registrarChamadaApi({
      metodo: "POST",
      rota: rotaDe(numero),
      quantidade: 0,
      erros: 1,
      detalhe: "multipart inválido",
    });
    return jsonErroValidacao({
      status: 400,
      erro: "validação falhou",
      detalhes: [{ campo: "corpo", mensagem: "multipart/form-data inválido." }],
    });
  }

  const entry = form.get("arquivo") ?? form.get("file");
  if (!entry || typeof entry === "string") {
    registrarChamadaApi({ metodo: "POST", rota: rotaDe(numero), quantidade: 0, erros: 1, detalhe: "sem arquivo" });
    return jsonErroValidacao({
      status: 400,
      erro: "validação falhou",
      detalhes: [{ campo: "arquivo", mensagem: "envie o campo arquivo (ou file)." }],
    });
  }

  const emailRaw = form.get("email_message_id");
  const email_message_id =
    typeof emailRaw === "string" && emailRaw.trim() ? emailRaw.trim() : null;
  const descRaw = form.get("descricao");
  const descricao = typeof descRaw === "string" && descRaw.trim() ? descRaw.trim() : null;

  const file = entry as File;
  const bytes = Buffer.from(await file.arrayBuffer());
  const result = gravarAnexoOrdem({
    numero_ordem: numero,
    nome: file.name || "anexo",
    contentType: file.type || null,
    bytes,
    fonte: "email_robot",
    email_message_id,
    descricao,
  });
  if (!result.ok) {
    registrarChamadaApi({
      metodo: "POST",
      rota: rotaDe(numero),
      quantidade: 0,
      erros: 1,
      detalhe: result.error.erro,
    });
    return jsonErroValidacao(result.error);
  }
  registrarChamadaApi({ metodo: "POST", rota: rotaDe(numero), quantidade: 1, erros: 0, detalhe: "criado" });
  return jsonOk(result.anexo, 201);
}
