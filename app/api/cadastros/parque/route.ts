import { atualizarParqueDaApi } from "@/lib/cadastros/parque-api";
import { readParqueMeta, resolveValorParque } from "@/lib/cadastros/store";
import type { ParqueMeta } from "@/lib/cadastros/types";
import { getDatabaseFilePath } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parquePayload(meta: ParqueMeta) {
  const resolved = resolveValorParque(meta);
  return {
    ...meta,
    valorEfetivo: resolved.valor,
    fonteEfetiva: resolved.fonte,
    /** @deprecated alias — manual removido */
    valorEfetivoManual: null,
    fonteManual: null,
    databasePath: getDatabaseFilePath(),
  };
}

export async function GET() {
  const meta = readParqueMeta();
  return Response.json({
    ok: true,
    data: parquePayload(meta),
  });
}

/** Atualiza valorApi a partir da soma de substituição (todos os equipamentos). */
export async function POST(request: Request) {
  let atualizadoPor: string | null = null;
  try {
    const body = (await request.json()) as { atualizadoPor?: string };
    atualizadoPor = body.atualizadoPor?.trim() || null;
  } catch {
    /* body opcional */
  }

  const result = await atualizarParqueDaApi({ atualizadoPor });
  if ("error" in result) {
    return Response.json({ ok: false, message: result.error }, { status: result.status });
  }

  return Response.json({
    ok: true,
    data: {
      ...parquePayload(result.meta),
      resumoApi: {
        nTotal: result.resumo.nTotal,
        nMedicos: result.resumo.nMedicos,
        substituicaoTodos: result.resumo.substituicao.todos.total,
        substituicaoMedicos: result.resumo.substituicao.medicos.total,
      },
    },
  });
}
