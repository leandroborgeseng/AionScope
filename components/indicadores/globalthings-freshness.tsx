"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, KeyRound, RefreshCw } from "lucide-react";
import { cacheAgeBand, formatCacheDateBRT, textoDadosDesatualizados } from "@/lib/pbi/cache-policy";
import { resumirFreshness } from "@/lib/pbi/freshness";
import type { PbiResult } from "@/lib/pbi/types";

/**
 * Data da cópia da GlobalThings + "Atualizando…" (aria-live) + avisos de idade (âmbar) e de token (vermelho).
 * A indisponibilidade (cópia > 7 dias e atualização falhou, ou sem cópia) é tratada pelo card ("—").
 */
export function GlobalThingsFreshness({ results }: { results: Array<PbiResult<unknown> | undefined> }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const f = resumirFreshness(results);
  const band = f.fetchedAtMs != null ? cacheAgeBand(f.fetchedAtMs, now) : null;

  return (
    <div className="mt-3 space-y-2 text-sm" data-testid="globalthings-freshness">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-aion-muted">
        {f.fetchedAtMs != null ? (
          <span data-testid="globalthings-data">Dados da GlobalThings de {formatCacheDateBRT(f.fetchedAtMs)} (BRT)</span>
        ) : null}
        <span aria-live="polite" aria-atomic="true" className="inline-flex items-center gap-1 text-xs">
          {f.refreshing ? (
            <>
              <RefreshCw className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
              Atualizando…
            </>
          ) : null}
        </span>
      </p>
      {band && band !== "normal" ? (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <strong>{textoDadosDesatualizados(f.fetchedAtMs!)}.</strong> A última cópia da GlobalThings é de {formatCacheDateBRT(f.fetchedAtMs!)} (BRT)
            {f.refreshing ? "; tentando atualizar." : "; a API não respondeu na última tentativa."}
          </span>
        </p>
      ) : null}
      {f.tokenError ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-rose-900">
          <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <strong>Token da GlobalThings recusado ({f.tokenStatus}).</strong> Exibindo a última cópia guardada. Avise o
            administrador para renovar o token.
          </span>
        </p>
      ) : null}
    </div>
  );
}
