import { exigirBearerOrdens } from "@/lib/ordens-compra/auth";
import { jsonErro, jsonErroValidacao, jsonInvalido, jsonOk, lerJson } from "@/lib/ordens-compra/http";
import { obterOrdemCompra, registrarChamadaApi, upsertOrdemCompra } from "@/lib/ordens-compra/store";
import { parseOrdemCompra } from "@/lib/ordens-compra/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function rotaDe(numero: string) {
  return `/api/v1/ordens-compra/${encodeURIComponent(numero)}`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ numero_ordem: string }> },
) {
  const recusa = exigirBearerOrdens(request);
  const { numero_ordem } = await context.params;
  const numero = decodeURIComponent(numero_ordem);
  if (recusa) {
    registrarChamadaApi({ metodo: "GET", rota: rotaDe(numero), quantidade: 0, erros: 1, detalhe: "401" });
    return recusa;
  }
  const ordem = obterOrdemCompra(numero);
  if (!ordem) {
    registrarChamadaApi({ metodo: "GET", rota: rotaDe(numero), quantidade: 0, erros: 1, detalhe: "404" });
    return jsonErro("não encontrado", 404);
  }
  registrarChamadaApi({ metodo: "GET", rota: rotaDe(numero), quantidade: 1, erros: 0 });
  return jsonOk(ordem);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ numero_ordem: string }> },
) {
  const recusa = exigirBearerOrdens(request);
  const { numero_ordem } = await context.params;
  const numero = decodeURIComponent(numero_ordem);
  if (recusa) {
    registrarChamadaApi({ metodo: "PUT", rota: rotaDe(numero), quantidade: 0, erros: 1, detalhe: "401" });
    return recusa;
  }

  const body = await lerJson(request);
  if (body && typeof body === "object" && "_invalido" in body) {
    registrarChamadaApi({ metodo: "PUT", rota: rotaDe(numero), quantidade: 0, erros: 1, detalhe: "JSON inválido" });
    return jsonInvalido();
  }

  const parsed = parseOrdemCompra(body, numero);
  if (!parsed.ok) {
    registrarChamadaApi({
      metodo: "PUT",
      rota: rotaDe(numero),
      quantidade: 0,
      erros: 1,
      detalhe: parsed.error.erro,
    });
    return jsonErroValidacao(parsed.error);
  }

  const result = upsertOrdemCompra(parsed.data);
  registrarChamadaApi({
    metodo: "PUT",
    rota: rotaDe(numero),
    quantidade: 1,
    erros: 0,
    detalhe: result.created ? "criada" : "atualizada",
  });
  return jsonOk(result.ordem, result.created ? 201 : 200);
}
