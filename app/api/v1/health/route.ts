import { jsonOk } from "@/lib/ordens-compra/http";
import {
  diagnosticoPersistencia,
  gravarStampVolume,
  lerStampVolume,
} from "@/lib/db/persistencia";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Health + diagnóstico de persistência (Railway volume).
 * GET /api/v1/health
 * GET /api/v1/health?persistencia=1  → detalhe de paths/writable
 * GET /api/v1/health?stamp=1        → grava stamp no volume (teste pós-redeploy)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const querPersistencia = url.searchParams.has("persistencia") || url.searchParams.has("verbose");
  const querStamp = url.searchParams.has("stamp");

  const persistencia = diagnosticoPersistencia();
  let stamp = lerStampVolume();
  if (querStamp) {
    stamp = gravarStampVolume() ?? stamp;
  }

  if (!querPersistencia && !querStamp) {
    return jsonOk({
      status: persistencia.ok ? "ok" : "degraded",
      persistencia_ok: persistencia.ok,
      ephemeral: persistencia.ephemeral,
      ordens_compra: persistencia.ordensCompra,
    });
  }

  return jsonOk({
    status: persistencia.ok ? "ok" : "degraded",
    persistencia,
    stamp,
    dica: persistencia.ok
      ? "Volume parece OK — dados devem sobreviver ao redeploy."
      : "Configure Volume em /data + DATABASE_PATH=/data/aionscope.sqlite e faça redeploy. Depois reenvie a API/uploads.",
  });
}
