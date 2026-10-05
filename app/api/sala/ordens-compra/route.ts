import { jsonErro, jsonErroValidacao, jsonInvalido, jsonOk, lerJson } from "@/lib/ordens-compra/http";
import { editarOrdemSala, listarOrdensCompra, obterOrdemCompra } from "@/lib/ordens-compra/store";
import { parseListaQuery, parseSalaPatch } from "@/lib/ordens-compra/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Lista para a UI da Sala (sem API key do robô). */
export async function GET(request: Request) {
  const parsed = parseListaQuery(new URL(request.url));
  if (!parsed.ok) return jsonErroValidacao(parsed.error);
  return jsonOk(listarOrdensCompra(parsed.filtros));
}

/**
 * Edita campos da Sala (categoria, OS, entrega, fora_escopo, duplicada)
 * e marca-os em editado_manualmente para o robô não sobrescrever.
 */
export async function PATCH(request: Request) {
  const body = await lerJson(request);
  if (body && typeof body === "object" && "_invalido" in body) return jsonInvalido();
  const numero =
    body && typeof body === "object" && "numero_ordem" in body
      ? String((body as { numero_ordem: unknown }).numero_ordem ?? "").trim()
      : "";
  if (!numero) {
    return jsonErroValidacao({
      status: 400,
      erro: "validação falhou",
      detalhes: [{ campo: "numero_ordem", mensagem: "obrigatório." }],
    });
  }
  const parsed = parseSalaPatch(body);
  if (!parsed.ok) return jsonErroValidacao(parsed.error);
  if (!obterOrdemCompra(numero)) return jsonErro("não encontrado", 404);
  const ordem = editarOrdemSala(numero, parsed.patch);
  return jsonOk(ordem);
}
