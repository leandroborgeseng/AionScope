import { persistenciaPublica } from "@/lib/db/persistencia-publica";
import { jsonOk } from "@/lib/ordens-compra/http";
import {
  diagnosticoPersistencia,
} from "@/lib/db/persistencia";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** SHA curto do commit em execução (Railway injeta RAILWAY_GIT_COMMIT_SHA). */
function commitAtual(): string | null {
  const sha = (process.env.RAILWAY_GIT_COMMIT_SHA ?? "").trim();
  return /^[0-9a-f]{7,40}$/i.test(sha) ? sha.slice(0, 7) : null;
}

/**
 * Health + diagnóstico de persistência (Railway volume).
 * GET /api/v1/health
 * GET /api/v1/health?persistencia=1  → detalhe de paths/writable
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const querPersistencia = url.searchParams.has("persistencia") || url.searchParams.has("verbose");

  const persistencia = diagnosticoPersistencia();

  if (!querPersistencia) {
    return jsonOk({
      status: persistencia.ok ? "ok" : "degraded",
      commit: commitAtual(),
      persistencia_ok: persistencia.ok,
      ephemeral: persistencia.ephemeral,
      ordens_compra: persistencia.ordensCompra,
    });
  }

  return jsonOk({
    status: persistencia.ok ? "ok" : "degraded",
    persistencia: persistenciaPublica(persistencia),
    dica: persistencia.ok
      ? "Volume parece OK — dados devem sobreviver ao redeploy."
      : "Configure Volume em /data + DATABASE_PATH=/data/aionscope.sqlite e faça redeploy. Depois reenvie a API/uploads.",
  });
}
