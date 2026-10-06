import type { Metadata } from "next";
import { InvestimentosParqueRelatorio } from "@/components/sala/investimentos-parque-relatorio";

export const metadata: Metadata = {
  title: "Investimentos do parque · Ciclo de vida",
};

export default function InvestimentosParquePage() {
  return <InvestimentosParqueRelatorio />;
}
