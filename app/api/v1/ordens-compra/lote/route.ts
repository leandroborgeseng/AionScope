import { exigirBearerOrdens } from "@/lib/ordens-compra/auth";
import { jsonErroValidacao, jsonInvalido, jsonOk, lerJson } from "@/lib/ordens-compra/http";
import { registrarChamadaApi, upsertOrdemCompra } from "@/lib/ordens-compra/store";
import { parseLote, parseOrdemCompra } from "@/lib/ordens-compra/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const recusa = exigirBearerOrdens(request);
  if (recusa) {
    registrarChamadaApi({
      metodo: "POST",
      rota: "/api/v1/ordens-compra/lote",
      quantidade: 0,
      erros: 1,
      detalhe: "401",
    });
    return recusa;
  }

  const body = await lerJson(request);
  if (body && typeof body === "object" && "_invalido" in body) {
    registrarChamadaApi({
      metodo: "POST",
      rota: "/api/v1/ordens-compra/lote",
      quantidade: 0,
      erros: 1,
      detalhe: "JSON inválido",
    });
    return jsonInvalido();
  }

  const lote = parseLote(body);
  if (!lote.ok) {
    registrarChamadaApi({
      metodo: "POST",
      rota: "/api/v1/ordens-compra/lote",
      quantidade: 0,
      erros: 1,
      detalhe: lote.error.erro,
    });
    return jsonErroValidacao(lote.error);
  }

  let criadas = 0;
  let atualizadas = 0;
  const erros: { numero_ordem: string | null; mensagem: string }[] = [];

  for (const raw of lote.ordens) {
    const parsed = parseOrdemCompra(raw);
    if (!parsed.ok) {
      const numero =
        raw && typeof raw === "object" && "numero_ordem" in raw
          ? String((raw as { numero_ordem: unknown }).numero_ordem ?? "") || null
          : null;
      const mensagem = parsed.error.detalhes.map((d) => `${d.campo}: ${d.mensagem}`).join("; ");
      erros.push({ numero_ordem: numero, mensagem });
      continue;
    }
    const result = upsertOrdemCompra(parsed.data);
    if (result.created) criadas += 1;
    else atualizadas += 1;
  }

  registrarChamadaApi({
    metodo: "POST",
    rota: "/api/v1/ordens-compra/lote",
    quantidade: criadas + atualizadas,
    erros: erros.length,
  });

  return jsonOk({ criadas, atualizadas, erros });
}
