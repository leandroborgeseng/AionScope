/** Next.js: roda uma vez ao subir o servidor. Inicia a renovação agendada da cópia da GlobalThings. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // F6: semeia /data/treinamentos com os arquivos do repo só se faltarem (nunca sobrescreve).
  try {
    const { semearTreinamentosSeFaltar } = await import("./lib/treinamentos/load");
    semearTreinamentosSeFaltar();
  } catch {
    /* sem volume: o app sobe e mostra aviso */
  }
  if (process.env.PBI_SCHEDULER === "off") return;
  const { startPbiScheduler } = await import("./lib/pbi/scheduler");
  startPbiScheduler();
}
