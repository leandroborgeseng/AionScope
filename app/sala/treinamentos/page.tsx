import { SalaApp } from "@/components/sala-tv/sala-app";
import { carregarPainelTreinamentos } from "@/lib/treinamentos/load";

export const dynamic = "force-dynamic";

export default function Page() {
  const painel = carregarPainelTreinamentos();
  return <SalaApp telaFixa="treinamentos" painelTreinamentos={painel} />;
}
