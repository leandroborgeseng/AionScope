import { exigirBearerOrdens } from "@/lib/ordens-compra/auth";
import { jsonErroValidacao, jsonOk, jsonInvalido, lerJson } from "@/lib/ordens-compra/http";
import { listarOrdensCompra, registrarChamadaApi } from "@/lib/ordens-compra/store";
import { parseListaQuery } from "@/lib/ordens-compra/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const recusa = exigirBearerOrdens(request);
  if (recusa) {
    registrarChamadaApi({ metodo: "GET", rota: "/api/v1/ordens-compra", quantidade: 0, erros: 1, detalhe: "401" });
    return recusa;
  }

  const url = new URL(request.url);
  const parsed = parseListaQuery(url);
  if (!parsed.ok) {
    registrarChamadaApi({
      metodo: "GET",
      rota: "/api/v1/ordens-compra",
      quantidade: 0,
      erros: 1,
      detalhe: parsed.error.erro,
    });
    return jsonErroValidacao(parsed.error);
  }

  const lista = listarOrdensCompra(parsed.filtros);
  registrarChamadaApi({
    metodo: "GET",
    rota: "/api/v1/ordens-compra",
    quantidade: lista.itens.length,
    erros: 0,
  });
  return jsonOk(lista);
}

/** POST neste path não faz parte do contrato; o lote é /ordens-compra/lote. */
export async function POST(request: Request) {
  const recusa = exigirBearerOrdens(request);
  if (recusa) return recusa;
  const body = await lerJson(request);
  if (body && typeof body === "object" && "_invalido" in body) return jsonInvalido();
  return jsonErroValidacao({
    status: 400,
    erro: "validação falhou",
    detalhes: [{ campo: "rota", mensagem: "use POST /api/v1/ordens-compra/lote para envio em lote." }],
  });
}
