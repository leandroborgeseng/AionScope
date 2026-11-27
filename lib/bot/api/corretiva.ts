/**
 * Corretiva na API do bot: toda OS que não é calibração, preventiva ou TSE.
 * Compra, manutenção externa, tipo vazio e OS sem equipamento entram.
 * A oficina da visão por setor continua sendo só engenharia clínica.
 */
import { classifyPlanoEc } from "@/lib/pbi/indicadores-os";

export function ehCorretivaOs(item: { TipoDeManutencao?: string | null; Tipo?: string | null }) {
  return classifyPlanoEc(item.TipoDeManutencao) == null && classifyPlanoEc(item.Tipo) == null;
}
