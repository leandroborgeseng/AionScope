/**
 * Resumo PÚBLICO do indicador custo/parque para a Sala/TV (sem login): só % acumulado, status e meta.
 * Calculado no servidor com a mesma montagem da página (I3). Nenhum valor em R$ (D1).
 */
import { calcularCustoParqueServidor } from "@/lib/indicadores/custo-parque-servidor";
import { custoParqueDemo } from "@/lib/indicadores/fixture-sala-indicadores";
import { resumoCustoParquePublico } from "@/lib/indicadores/resumo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const demo = new URL(request.url).searchParams.get("demo");
  if (demo === "indicadores") {
    return Response.json({ ok: true, data: resumoCustoParquePublico(custoParqueDemo()), erro: null, lidoEm: new Date().toISOString() });
  }
  try {
    const r = await calcularCustoParqueServidor();
    return Response.json({
      ok: true,
      data: resumoCustoParquePublico(r.ind, r.faltandoExtra),
      erro: r.erroLeitura ? "Não foi possível atualizar" : null,
      lidoEm: new Date().toISOString(),
    });
  } catch {
    return Response.json({ ok: false, message: "Não foi possível calcular o indicador." }, { status: 503 });
  }
}
