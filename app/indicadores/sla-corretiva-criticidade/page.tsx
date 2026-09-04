import { redirect } from "next/navigation";

/** Rota antiga → % 1º atendimento no prazo (por prioridade). */
export default function SlaCorretivaCriticidadeRedirect() {
  redirect("/indicadores/sla-primeiro-atendimento");
}
