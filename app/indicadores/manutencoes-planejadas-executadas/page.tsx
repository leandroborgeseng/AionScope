import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Indicador desativado: a API PBI não expõe data de emissão do laudo.
 * Executado por Fechamento/DataDaSolucao distorce o cumprimento e compromete a auditoria.
 * Lib `lib/pbi/manutencoes-planejadas.ts` permanece para reativação quando houver campo confiável.
 */
export default function ManutencoesPlanejadasDesativadoPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Manutenções planejadas × executadas"
        description="Indicador desativado até a API expor data de emissão do laudo."
      />

      <div
        role="status"
        className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950"
      >
        <p className="font-semibold">KPI indisponível — não usar como cumprimento oficial</p>
        <p className="mt-1 text-amber-900/90">
          Em <code className="text-xs">os-analitico</code> não há campo de emissão de laudo; em{" "}
          <code className="text-xs">anexos_os</code> / <code className="text-xs">anexos_equipamento</code>{" "}
          só existe <code className="text-xs">DataHoraInclusao</code> (upload), sem padrão confiável de
          data no nome do arquivo. Contar “executado” pelo fechamento da OS distorce o número.
        </p>
      </div>

      <Card className="border-aion-line">
        <CardHeader className="space-y-3 p-5">
          <CardTitle className="text-base text-aion-ink">Evidências alternativas</CardTitle>
          <CardDescription className="text-sm leading-relaxed text-aion-ink/70">
            Enquanto a data de laudo não vier na API, use o cronograma e o gap de preventiva no plano.
          </CardDescription>
          <div className="flex flex-wrap gap-4 pt-1">
            <Link
              href="/cronograma"
              className="text-sm font-medium text-aion-blue underline-offset-2 hover:underline"
            >
              Abrir cronograma →
            </Link>
            <Link
              href="/qmentum/sem-preventiva"
              className="text-sm font-medium text-aion-blue underline-offset-2 hover:underline"
            >
              Parque sem preventiva no plano →
            </Link>
            <Link
              href="/indicadores"
              className="text-sm font-medium text-aion-ink/70 underline-offset-2 hover:underline"
            >
              Voltar aos indicadores →
            </Link>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
