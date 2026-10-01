/** Horas escritas no texto do Effort. Ex.: "ALTA (2HS)", "MÉDIA (MÁX. 12 HS)". */
export function horasNoTexto(texto: string | null | undefined): number | null {
  const match = (texto ?? "").match(/(\d+)\s*h/i);
  if (!match) return null;
  const horas = Number(match[1]);
  return Number.isFinite(horas) && horas > 0 ? horas : null;
}

/** Criticidade do equipamento prevalece. Sem número nela, usa a prioridade da OS. */
export function metaHorasEsforco(
  criticidadeEquipamento: string | null | undefined,
  prioridadeOs: string | null | undefined,
) {
  return horasNoTexto(criticidadeEquipamento) ?? horasNoTexto(prioridadeOs);
}

export function rotuloCriticidade(texto: string | null | undefined) {
  const valor = (texto ?? "").trim();
  if (!valor) return "Sem criticidade";
  const horas = horasNoTexto(valor);
  const nome = valor.split("(")[0]?.trim() || valor;
  return horas ? `${nome} ${horas}h` : nome;
}
