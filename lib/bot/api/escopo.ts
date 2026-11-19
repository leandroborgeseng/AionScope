/**
 * Recorte da API do bot: engenharia clínica e equipamentos médicos.
 *
 * Oficina principal: comparação normalizada (sem acento, sem caixa, espaços
 * extras colapsados) exatamente igual a ENGENHARIA CLINICA.
 *
 * A cópia também traz preventivas e calibrações de equipamento médico em
 * oficinas próprias, já usadas no volume de plano (`lib/pbi/volume-ec.ts`):
 * PREVENTIVA EQUIPAMENTOS e CALIBRACAO DE EQUIPAMENTOS. Essas duas entram
 * no mesmo recorte. Refrigeração, predial, obras e "PREVENTIVAS (MANUTENÇÃO)"
 * ficam de fora — o nome não é igual a nenhum dos três.
 *
 * A visão /os/por-setor é mais estreita: só a oficina ENGENHARIA CLINICA.
 */
import { texto } from "@/lib/ec/texto";
import type { CronogramaItem } from "@/lib/pbi/types";
import { normalizarChave } from "./chave";

export const OFICINA_EC = "ENGENHARIA CLINICA";

/** Preventiva e calibração de equipamento médico que não usam o nome da EC. */
export const OFICINAS_PLANO_MEDICO = ["PREVENTIVA EQUIPAMENTOS", "CALIBRACAO DE EQUIPAMENTOS"] as const;

const ESCOPO = new Set<string>([OFICINA_EC, ...OFICINAS_PLANO_MEDICO]);

export function oficinaEngenhariaClinicaExata(oficina: string | null | undefined) {
  return normalizarChave(oficina) === OFICINA_EC;
}

export function oficinaNoEscopoBot(oficina: string | null | undefined) {
  return ESCOPO.has(normalizarChave(oficina));
}

/** Cronograma da cópia não tem oficina no tipo. Se o campo vier preenchido, vale o recorte. */
export function cronogramaNoEscopoBot(item: CronogramaItem) {
  const oficina = texto((item as CronogramaItem & { Oficina?: string }).Oficina);
  if (!oficina) return true;
  return oficinaNoEscopoBot(oficina);
}
