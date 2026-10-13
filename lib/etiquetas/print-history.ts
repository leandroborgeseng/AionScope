/** Histórico local de etiquetas já impressas (tag + mês). */

export type PrintHistoryEntry = {
  tag: string;
  monthKey: string;
  printedAt: string;
  setor?: string;
};

const STORAGE_KEY = "aionscope.etiquetas.print-history.v1";

function normalizeTag(tag: string): string {
  return tag.trim().toLocaleUpperCase("pt-BR");
}

export function printHistoryKey(tag: string, monthKey: string): string {
  return `${normalizeTag(tag)}|${monthKey}`;
}

export function loadPrintHistory(): PrintHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is PrintHistoryEntry =>
        Boolean(e) &&
        typeof e === "object" &&
        typeof (e as PrintHistoryEntry).tag === "string" &&
        typeof (e as PrintHistoryEntry).monthKey === "string" &&
        typeof (e as PrintHistoryEntry).printedAt === "string",
    );
  } catch {
    return [];
  }
}

export function savePrintHistory(entries: PrintHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function historyMapFromEntries(entries: PrintHistoryEntry[]): Map<string, PrintHistoryEntry> {
  const map = new Map<string, PrintHistoryEntry>();
  for (const e of entries) {
    map.set(printHistoryKey(e.tag, e.monthKey), e);
  }
  return map;
}

/** Marca tag impressa em cada mês selecionado. */
export function markPrinted(
  tags: string[],
  monthKeys: string[],
  opts?: { setor?: string; at?: Date },
): PrintHistoryEntry[] {
  const at = (opts?.at ?? new Date()).toISOString();
  const prev = loadPrintHistory();
  const map = historyMapFromEntries(prev);
  for (const tag of tags) {
    const t = normalizeTag(tag);
    if (!t) continue;
    for (const monthKey of monthKeys) {
      if (!monthKey) continue;
      map.set(printHistoryKey(t, monthKey), {
        tag: t,
        monthKey,
        printedAt: at,
        setor: opts?.setor,
      });
    }
  }
  const next = [...map.values()].sort((a, b) => b.printedAt.localeCompare(a.printedAt));
  savePrintHistory(next);
  return next;
}

export function clearPrintHistory(): PrintHistoryEntry[] {
  savePrintHistory([]);
  return [];
}

export function unmarkPrinted(tag: string, monthKeys: string[]): PrintHistoryEntry[] {
  const t = normalizeTag(tag);
  const drop = new Set(monthKeys.map((m) => printHistoryKey(t, m)));
  const next = loadPrintHistory().filter((e) => !drop.has(printHistoryKey(e.tag, e.monthKey)));
  savePrintHistory(next);
  return next;
}

/** True se a tag já foi impressa em **todos** os meses filtrados. */
export function isPrintedForMonths(
  map: Map<string, PrintHistoryEntry>,
  tag: string,
  monthKeys: string[],
): boolean {
  if (!monthKeys.length) return false;
  const t = normalizeTag(tag);
  return monthKeys.every((m) => map.has(printHistoryKey(t, m)));
}

/** True se foi impressa em **algum** dos meses filtrados. */
export function isPrintedInAnyMonth(
  map: Map<string, PrintHistoryEntry>,
  tag: string,
  monthKeys: string[],
): boolean {
  if (!monthKeys.length) return false;
  const t = normalizeTag(tag);
  return monthKeys.some((m) => map.has(printHistoryKey(t, m)));
}
