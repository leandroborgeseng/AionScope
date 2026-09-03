import { atualizarParqueDaApi } from "@/lib/cadastros/parque-api";
import { readParqueMeta, resolveValorParque, writeParqueMeta } from "@/lib/cadastros/store";
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
    /** @deprecated alias */
    valorEfetivoManual: resolved.fonte === "manual" || resolved.fonte === "env" ? resolved.valor : null,
    fonteManual: resolved.fonte === "manual" || resolved.fonte === "env" ? resolved.fonte : null,
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

export async function PUT(request: Request) {
  let body: Partial<ParqueMeta> & {
    valorSubstituicaoManual?: number | null;
    atualizadoPor?: string | null;
    limparManual?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, message: "JSON inválido." }, { status: 400 });
  }

  const current = readParqueMeta();
  let valorManual = current.valorSubstituicaoManual;

  if (body.limparManual) {
    valorManual = null;
  } else if (body.valorSubstituicaoManual !== undefined) {
    const raw = body.valorSubstituicaoManual;
    if (raw == null || raw === ("" as unknown)) {
      valorManual = null;
    } else {
      const n = typeof raw === "number" ? raw : Number(String(raw).replace(/\./g, "").replace(",", "."));
      if (!Number.isFinite(n) || n < 0) {
        return Response.json({ ok: false, message: "Valor de substituição inválido." }, { status: 400 });
      }
      valorManual = n === 0 ? null : n;
    }
  }

  const next = writeParqueMeta({
    valorSubstituicaoManual: valorManual,
    valorApi: current.valorApi,
    fonte: valorManual != null && valorManual > 0 ? "manual" : "api",
    escopo: current.escopo || "todos",
    atualizadoEm: new Date().toISOString(),
    atualizadoPor: body.atualizadoPor?.trim() || null,
    valorManualReferencia: current.valorManualReferencia ?? 57_000_000,
    notas: current.notas,
  });

  return Response.json({
    ok: true,
    data: parquePayload(next),
  });
}
