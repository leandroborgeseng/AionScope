"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion } from "@/components/ui/accordion";
import { OrigemCampo } from "@/components/indicadores/chart-fullscreen";
import {
  QMENTUM_CHECKLIST,
  QMENTUM_NAV,
  type QmentumStatus,
} from "@/lib/qmentum/checklist";

function toneStatus(status: QmentumStatus): "ok" | "warn" | "danger" {
  if (status === "Coberto") return "ok";
  if (status === "Parcial") return "warn";
  return "danger";
}

export function QmentumHubView() {
  const cobertos = QMENTUM_CHECKLIST.filter((i) => i.status === "Coberto").length;
  const parciais = QMENTUM_CHECKLIST.filter((i) => i.status === "Parcial").length;
  const fora = QMENTUM_CHECKLIST.filter((i) => i.status === "Fora").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="QMentum — Gestão de Equipamentos"
        description="Checklist dos 8 itens da auditoria: o que olham × o que o AionScope mostra. Status honesto (Coberto / Parcial / Fora)."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-emerald-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-aion-muted">Coberto</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-800">{cobertos}</p>
        </Card>
        <Card className="border-amber-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-aion-muted">Parcial</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-800">{parciais}</p>
        </Card>
        <Card className="border-rose-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-aion-muted">Fora</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-rose-800">{fora}</p>
        </Card>
      </div>

      <div className="space-y-3">
        {QMENTUM_CHECKLIST.map((item) => (
          <Card key={item.id} className="border-aion-line">
            <CardHeader className="space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-aion-blue">
                    Item {item.id}
                  </p>
                  <CardTitle className="mt-0.5 text-base text-aion-ink">{item.titulo}</CardTitle>
                </div>
                <Badge tone={toneStatus(item.status)}>{item.status}</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Auditoria olha
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-aion-ink/80">{item.auditoriaOlha}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    App mostra
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-aion-ink/80">{item.appMostra}</p>
                </div>
              </div>
              {item.href || item.links?.length ? (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="inline-flex w-fit text-sm font-medium text-aion-blue underline-offset-2 hover:underline"
                    >
                      {item.linkLabel ?? "Abrir tela"} →
                    </Link>
                  ) : null}
                  {(item.links ?? []).map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="inline-flex w-fit text-sm font-medium text-aion-blue underline-offset-2 hover:underline"
                    >
                      {link.label} →
                    </Link>
                  ))}
                </div>
              ) : null}
            </CardHeader>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-aion-muted">
          Atalhos da reunião
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {QMENTUM_NAV.map((item) => (
            <Link key={item.href} href={item.href} className="group block rounded-xl focus-visible:outline-none">
              <Card className="h-full border-aion-line transition-colors group-hover:border-aion-blue/40 group-hover:bg-aion-mist/50 group-focus-visible:ring-2 group-focus-visible:ring-aion-blue/35">
                <CardHeader className="p-4">
                  <CardTitle className="text-sm text-aion-ink group-hover:text-aion-blue">
                    {item.label}
                  </CardTitle>
                  <CardDescription className="mt-1 text-xs leading-relaxed">{item.blurb}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <Accordion
        items={[
          {
            id: "origem",
            title: "De onde vêm os dados",
            children: (
              <dl className="grid gap-3 sm:grid-cols-2">
                <OrigemCampo label="Escopo">
                  Checklist estático dos 8 requisitos QMentum × rotas e APIs já usadas no AionScope.
                </OrigemCampo>
                <OrigemCampo label="Contratos">
                  Se <code className="text-xs">PBI_TOKEN_CONTRATOS</code> estiver ausente, a tela de contratos
                  avisa com clareza — não inventamos cobertura.
                </OrigemCampo>
                <OrigemCampo label="Itens Fora">
                  Movimentação (workflow CMMS) e treino de bomba (fora das APIs) ficam marcados Fora de propósito.
                </OrigemCampo>
                <OrigemCampo label="Regra de negócio">
                  Equipamentos precisam de preventiva. Calibração e TSE são extras informativos.
                </OrigemCampo>
              </dl>
            ),
          },
        ]}
      />
    </div>
  );
}
