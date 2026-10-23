import { NextRequest } from "next/server";
import { PBI_ENDPOINTS } from "@/lib/pbi/catalog";
import { fetchPbi } from "@/lib/pbi/client";
import { sessaoContratosValida } from "@/lib/auth/contratos-sessao";
import { RESOURCES_SO_COM_SESSAO, resourceExato, somenteAllowlist } from "@/lib/pbi/proxy-publico";

export const dynamic = "force-dynamic";
// Nunca reaproveitar fetch/route cache do Next entre requisições (a resposta depende do cookie).
export const revalidate = 0;
export const fetchCache = "force-no-store";

// A resposta depende do cookie de sessão: nunca cachear em proxy/CDN compartilhado.
const SEM_CACHE = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ resource: string }> },
) {
  const { resource: bruto } = await context.params;
  // Nome CRU idêntico a uma chave da lista (param e segmento da URL ainda codificado); senão 404 sem chamar o PBI (e sem ecoar o nome).
  const segmentoCru = request.nextUrl.pathname.split("/").pop();
  const resource = resourceExato(bruto, segmentoCru);
  if (!resource || !(resource in PBI_ENDPOINTS)) {
    return Response.json({ ok: false, status: 404, message: "Recurso inválido." }, { status: 404, headers: SEM_CACHE });
  }
  const logado = sessaoContratosValida(request);
  if (!logado && RESOURCES_SO_COM_SESSAO.includes(resource)) {
    return Response.json({ ok: false, message: "Entre com a senha de administrador." }, { status: 401, headers: SEM_CACHE });
  }

  const params = new URLSearchParams(request.nextUrl.searchParams);
  if (resource === "disp-equipamento-mes" && !params.get("empresasId")) {
    const defaults = (process.env.PBI_DEFAULT_EMPRESA_IDS ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    for (const id of defaults) params.append("empresasId", id);
  }
  if ((resource === "oficina" || resource === "disp-equipamento-mes") && !params.get("empresasId") && !params.get("companyId")) {
    const defaults = (process.env.PBI_DEFAULT_EMPRESA_IDS ?? "").split(",").map((v) => v.trim()).filter(Boolean);
    if (resource === "oficina" && defaults[0]) params.set("companyId", defaults[0]);
  }

  const completo = await fetchPbi(resource, params);
  // M1: sem sessão de admin, só a allowlist do resource sai (cópia; o cache guarda o completo).
  const result = somenteAllowlist(resource, completo, logado);
  const httpStatus = result.ok ? 200 : result.disabled ? 200 : result.status && result.status >= 400 ? 502 : 500;
  // A resposta depende do cookie de sessão: nunca cachear em proxy/CDN compartilhado.
  return Response.json(result, { status: httpStatus, headers: SEM_CACHE });
}
