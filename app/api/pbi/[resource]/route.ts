import { NextRequest } from "next/server";
import { PBI_ENDPOINTS, type PbiResource } from "@/lib/pbi/catalog";
import { fetchPbi } from "@/lib/pbi/client";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ resource: string }> },
) {
  const { resource } = await context.params;
  if (!(resource in PBI_ENDPOINTS)) {
    return Response.json({ ok: false, status: 404, message: `Recurso inválido: ${resource}` }, { status: 404 });
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

  const result = await fetchPbi(resource as PbiResource, params);
  const httpStatus = result.ok ? 200 : result.disabled ? 200 : result.status && result.status >= 400 ? 502 : 500;
  return Response.json(result, { status: httpStatus });
}
