"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SelecaoOsLista({
  title,
  subtitle,
  emptyHint = "Clique em um mês no gráfico para listar as OS correlacionadas.",
  hasSelection,
  onClear,
  filters,
  children,
}: {
  title?: string;
  subtitle?: string;
  emptyHint?: string;
  hasSelection: boolean;
  onClear?: () => void;
  filters?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card className="border-aion-line">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="text-base text-aion-ink">
            {hasSelection && title ? title : "OS da seleção"}
          </CardTitle>
          {hasSelection && subtitle ? (
            <p className="mt-1 text-xs text-aion-muted">{subtitle}</p>
          ) : !hasSelection ? (
            <p className="mt-1 text-xs text-aion-muted">{emptyHint}</p>
          ) : null}
        </div>
        {hasSelection && onClear ? (
          <Button type="button" variant="outline" size="sm" onClick={onClear} className="shrink-0">
            <X className="h-3.5 w-3.5" />
            Limpar seleção
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasSelection ? (
          <div className="rounded-lg border border-dashed border-aion-line bg-aion-mist/40 px-4 py-8 text-center text-sm text-aion-muted">
            {emptyHint}
          </div>
        ) : (
          <>
            {filters ? <div className="flex flex-wrap gap-2">{filters}</div> : null}
            {children}
          </>
        )}
      </CardContent>
    </Card>
  );
}
