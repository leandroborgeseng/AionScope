import { headers } from "next/headers";
import { PainelTreinamentosView } from "@/components/treinamentos/painel-treinamentos";
import { statusEvidencias } from "@/lib/treinamentos/evidencias";
import { carregarPainelTreinamentos, carregarParticipantes } from "@/lib/treinamentos/load";

export const dynamic = "force-dynamic";

export default async function TreinamentosBombasPage() {
  const painel = carregarPainelTreinamentos();
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
