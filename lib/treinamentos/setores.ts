/**
 * Mapa editável de padronização de setores (listas manuscritas 2025 → rótulo canônico).
 * Chaves em minúsculas, sem acento.
 */
const MAPA_SETOR: Record<string, string> = {
  "uti a": "UTI Adulto 1",
  "cti a": "UTI Adulto 1",
  "uti 1": "UTI Adulto 1",
  "uti adulto 1": "UTI Adulto 1",
  "uti 2": "UTI Adulto 2",
  "uti ii": "UTI Adulto 2",
  "uti ad 2": "UTI Adulto 2",
  "uti adulto 2": "UTI Adulto 2",
  "uti neo": "UTI Neonatal / Infantil",
  utin: "UTI Neonatal / Infantil",
  "uti infantil": "UTI Neonatal / Infantil",
  "uti neonatal / infantil": "UTI Neonatal / Infantil",
  "ala clinica": "Ala 1 – Clínica Médica",
  "ala clínica": "Ala 1 – Clínica Médica",
  "clinica medica": "Ala 1 – Clínica Médica",
  "clínica médica": "Ala 1 – Clínica Médica",
  "unidade clinica": "Ala 1 – Clínica Médica",
  "unidade clínica": "Ala 1 – Clínica Médica",
  "ala 1 – clinica medica": "Ala 1 – Clínica Médica",
  "ala 1 – clínica médica": "Ala 1 – Clínica Médica",
  "unidade 2": "Ala 2",
  "ala 2": "Ala 2",
  "unidade 3": "Ala 3",
  "ala 3": "Ala 3",
  "unidade 5": "Ala 5",
  "ala 5": "Ala 5",
  eda: "Endoscopia",
  endoscopia: "Endoscopia",
  "h.d": "Hospital Dia",
  hd: "Hospital Dia",
  "hospital dia": "Hospital Dia",
};

function semAcento(valor: string) {
  return valor.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Aplica o mapa de padronização; devolve o próprio texto se já canônico / desconhecido. */
export function padronizarSetor(setor: string | null | undefined): string | null {
  if (setor == null) return null;
  const limpo = setor.trim();
  if (!limpo) return null;
  const chave = semAcento(limpo).toLowerCase().replace(/\s+/g, " ");
  return MAPA_SETOR[chave] ?? limpo;
}

export function mapaPadronizacaoSetores() {
  return { ...MAPA_SETOR };
}
