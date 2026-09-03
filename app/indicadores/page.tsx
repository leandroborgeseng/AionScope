import { PageHeader } from "@/components/shell/page-header";

export default function IndicadoresEmConstrucaoPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Indicadores"
        description="Em construção. Os blocos antigos (criticidade, tempo, preventiva/TSE) saíram da navegação para validar um indicador de cada vez."
      />
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        <p>
          A home tem <strong>OS abertas × fechadas</strong> e <strong>gasto mensal com reparo de eq. médicos</strong>.
          Os demais indicadores voltam depois da conferência com o GlobalThings.
        </p>
      </div>
    </div>
  );
}
