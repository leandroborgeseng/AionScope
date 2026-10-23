import { headers } from "next/headers";
import { PainelTreinamentosView } from "@/components/treinamentos/painel-treinamentos";
import { statusEvidencias } from "@/lib/treinamentos/evidencias";
import { AVISO_TREINAMENTOS_INDISPONIVEIS, carregarPainelTreinamentos, carregarParticipantes } from "@/lib/treinamentos/load";

export const dynamic = "force-dynamic";

export default async function TreinamentosBombasPage() {
  const painel = carregarPainelTreinamentos();
  if (!painel) {
    return (
      <div role="status" data-testid="aviso-treinamentos" className="m-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {AVISO_TREINAMENTOS_INDISPONIVEIS}
      </div>
    );
  }
  const participantes = carregarParticipantes();
  const h = await headers();
  const cookie = h.get("cookie") ?? "";
  const status = statusEvidencias(new Request("http://local/status", { headers: { cookie } }));

  return (
    <PainelTreinamentosView
      painel={painel}
      participantes={participantes}
      evidencias={{
        tokenObrigatorio: status.tokenObrigatorio,
        anos: status.anos,
        liberado: status.liberado,
      }}
    />
  );
}
