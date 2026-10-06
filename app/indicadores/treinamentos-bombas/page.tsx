import { PainelTreinamentosView } from "@/components/treinamentos/painel-treinamentos";
import { evidenciasTokenConfigurado } from "@/lib/treinamentos/evidencias";
import { carregarPainelTreinamentos, carregarParticipantes } from "@/lib/treinamentos/load";

export const dynamic = "force-dynamic";

export default function TreinamentosBombasPage() {
  const painel = carregarPainelTreinamentos();
  const participantes = carregarParticipantes();

  return (
    <PainelTreinamentosView
      painel={painel}
      participantes={participantes}
      evidenciasConfiguradas={evidenciasTokenConfigurado()}
    />
  );
}
